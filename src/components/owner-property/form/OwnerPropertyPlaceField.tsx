'use client';

/**
 * @fileoverview **ΔΙΕΥΘΥΝΣΗ → ΣΗΜΕΙΟ ΣΤΟΝ ΧΑΡΤΗ** — με την ακρίβειά της, ή μια ειλικρινής άρνηση.
 * @related ADR-777 §7 (Α5 · Α14) · lib/geocoding/geocoding-service · components/search/PlaceSearchBox
 * @module components/owner-property/form/OwnerPropertyPlaceField
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΚΑΜΙΑ ΝΕΑ ΜΗΧΑΝΗ ΓΕΩΚΩΔΙΚΟΠΟΙΗΣΗΣ — ΚΑΙ ΤΟ ΙΔΙΟ ΛΕΞΙΛΟΓΙΟ ΑΠΟΤΥΧΙΑΣ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Καλείται το **υπάρχον** `geocodeAddressDetailed`, ακριβώς όπως το κάνουν ο
 * `PlaceSearchBox` της οθόνης 1 και ο `DemandPlaceResolver` της Α9: κουβαλά ήδη
 * **cache + in-flight dedup** και επιστρέφει **διακριτή** ετυμηγορία — ώστε το *«δεν
 * υπάρχει τέτοια διεύθυνση»* να μη συγχέεται με *«μας έκοψε ο ρυθμιστής»*. Η πρώτη
 * λέει στον άνθρωπο να **ξαναγράψει**, η δεύτερη να **ξαναδοκιμάσει**.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΙ ΚΡΑΤΑΜΕ ΠΑΡΑΠΑΝΩ ΑΠΟ ΤΗ ΖΗΤΗΣΗ — ΚΑΙ ΓΙΑΤΙ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ο `DemandPlaceResolver` κρατά **σημείο + ακτίνα** και **πετά το κείμενο**. Εδώ
 * κρατάμε **δύο ακόμη** πράγματα, και καθένα έχει λόγο:
 *
 * | Τι | Γιατί |
 * |---|---|
 * | το **κείμενο** (`label`) | Η ζήτηση λέει *«ψάχνω γύρω από εκεί»* — το κείμενο είναι **αναζήτηση**. Η προσφορά λέει *«το ακίνητό μου **είναι** εκεί»* — είναι **η δήλωση του ανθρώπου για το δικό του πράγμα**, και οφείλει να τη βλέπει αυτούσια. ⛔ **Δεν ταξιδεύει στη δημόσια αγγελία** (κλειστό σχήμα) |
 * | η **ακρίβεια** (`accuracy`) | **Είναι ολόκληρη η Α5**: το σχήμα στον χάρτη *είναι* η ακρίβεια. Χωρίς αυτήν, μια διεύθυνση που ο γεωκωδικοποιητής έλυσε σε **κέντρο πόλης** θα ζωγραφιζόταν ως **ακριβής πινέζα** — ψέμα που μοιάζει με γνώση |
 *
 * ⚠️ **Η ακρίβεια ΔΕΝ μαντεύεται όταν λείπει.** Το `null` σημαίνει «κάποιος **έβαλε**
 * το σημείο» ⇒ προέλευση `manual` (δες `addressToPositionCandidate`). Ένα
 * `accuracy: 'center'` ως προεπιλογή θα ήταν ψέμα **προς την ασφαλή κατεύθυνση**: θα
 * έκρυβε γνώση που έχουμε.
 */

import React from 'react';
import dynamic from 'next/dynamic';
import { useFormContext } from 'react-hook-form';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { usePlaceResolver, type ResolvedPlace } from '@/hooks/geo/usePlaceResolver';
import type { PlaceFocus } from '@/lib/geo/geocoding-focus';
import { PlaceIdentityField } from '@/components/geo/PlaceIdentityField';
import { ResolvedPlaceConfirmation } from '@/components/geo/ResolvedPlaceConfirmation';
import { FormFieldset } from '@/components/shared/forms/form-field-primitives';
import type { OwnerPropertyFormValues } from '@/lib/owner-property/owner-property-form-values';
import { addressToPositionCandidate } from '@/services/listings/public-listing-position';
import type { ListingPosition } from '@/types/public-listing';

import { OwnerPlaceAnswerField } from './OwnerPropertyFields';

const NS = 'property-market';
const K = `${NS}:offer`;

/**
 * **Σφραγίδα-φρουρός: η θέση εδώ ΔΕΝ αποθηκεύεται, άρα δεν έχει «πότε».**
 *
 * 🔑 Το `addressToPositionCandidate` απαιτεί `locatedAt` γιατί οι **αποθηκευμένες**
 * θέσεις το χρειάζονται *(ποια πηγή υπερισχύει)*. Εδώ η θέση ζει **όσο η οθόνη** και
 * καταναλώνεται από **έναν** κριτή που διαβάζει μόνο `point` + `accuracy`.
 *
 * ⚠️ **Ονομασμένη σταθερά, ποτέ ωμό `new Date(0)` στη θέση κλήσης** *(ADR-716: «αριθμός
 * με κρυμμένο νόημα»)*: ένα σκέτο `new Date(0).toISOString()` σε δύο σημεία διαβάζεται
 * ως *«δεδομένο από το 1970»* — και το ίδιο ιδίωμα υπάρχει ήδη, ανώνυμο, στο
 * `AddressPublicShapeBadge`.
 */
const EPHEMERAL_LOCATED_AT = new Date(0).toISOString();

/**
 * 🔴 **ΔΥΝΑΜΙΚΟ, ΚΑΙ ΤΟ ΕΠΙΒΑΛΕ ΜΕΤΡΗΣΗ — ΟΧΙ ΠΡΟΒΛΕΨΗ** *(ADR-846 Φάση 6 · CHECK 3.34)*.
 *
 * Με **στατική** εισαγωγή, η κλειστότητα της σελίδας **του ιδιώτη**
 * *(`(me)/offers/[offerId]`)* πέρασε το ταβάνι της: **18.964 > 18.370 bytes**. Και η
 * πύλη είχε δίκιο για τον σωστό λόγο — δεν ήταν αριθμός, ήταν **σημασία**: ο ιδιώτης
 * που ανεβάζει το σπίτι του κατέβαζε τη βιτρίνα του γραφείου, τα διοικητικά
 * αποτυπώματα και τον κριτή κάλυψης, για δυνατότητα που **δεν τον αφορά ποτέ**.
 *
 * ⚠️ **Ο φρουρός `brokered` ΔΕΝ αρκούσε**, και εκεί είναι το μάθημα: το `{brokered && …}`
 * κρίνεται σε **χρόνο απόδοσης**, ενώ η στατική εισαγωγή δεσμεύεται σε **χρόνο
 * μεταγλώττισης**. Ένα «δεν το ζωγραφίζω» **δεν** είναι «δεν το στέλνω».
 *
 * ⚠️ **`ssr: false` = ορθότητα, όχι βελτιστοποίηση**: το component ζει από συνδρομή
 * Firestore *(η βιτρίνα)* και δύο τεμπέλικα στιγμιότυπα JSON *(αποτυπώματα · ιεραρχία)*.
 * Στον διακομιστή **καμία** από τις τρεις πηγές δεν έχει απαντήσει, άρα η μόνη δυνατή
 * απόδοση εκεί είναι **η σιωπή** — που θα ταξίδευε ως HTML για να αντικατασταθεί αμέσως.
 *
 * ⚠️ **Καμία εγγραφή route slice**: τα κλειδιά ζουν στο `property-market`, το **ίδιο**
 * namespace που αυτή η φόρμα φορτώνει ήδη. Δεν υπάρχει ωμό κλειδί να προλάβει καρέ
 * *(CHECK 3.51)* — και το component δεν αποδίδεται καθόλου πριν φορτώσει.
 */
const CoverageReachNotice = dynamic(
  () => import('@/components/mandate/CoverageReachNotice').then((m) => m.CoverageReachNotice),
  { ssr: false },
);

interface OwnerPropertyPlaceFieldProps {
  /**
   * 🔴 **ΤΟ ΑΚΡΟΑΤΗΡΙΟ, ΚΑΙ ΕΙΝΑΙ ΤΟ ΙΔΙΟ ΠΟΥ ΞΕΡΕΙ ΗΔΗ Η ΦΟΡΜΑ** *(§8.33)*.
   *
   * Το `OwnerPropertyFormContent` δέχεται ήδη `mandate?` — *«απών για τον ιδιώτη, παρών
   * για το γραφείο»*. Αυτή η σημαία είναι **παράγωγό του**, όχι δεύτερη αυθεντία: μια
   * ανεξάρτητη ρύθμιση εδώ θα μπορούσε μια μέρα να λέει «γραφείο» εκεί που η φόρμα λέει
   * «ιδιώτης».
   *
   * ⚠️ **Γιατί χρειάζεται καθόλου**: η δηλωμένη κάλυψη είναι έννοια **του γραφείου**. Ο
   * ιδιώτης που ανεβάζει το σπίτι του δεν έχει «περιοχές δραστηριοποίησης» — και η
   * ανάγνωση της βιτρίνας θα ήταν, γι' αυτόν, **ερώτηση χωρίς υποκείμενο**.
   */
  readonly brokered?: boolean;
}

export function OwnerPropertyPlaceField({
  brokered = false,
}: OwnerPropertyPlaceFieldProps = {}): React.ReactElement {
  const { t } = useTranslation([NS]);
  const form = useFormContext<OwnerPropertyFormValues>();
  const inputId = React.useId();

  const answer = form.watch('placeAnswer');
  const query = form.watch('placeQuery');
  const placeRef = form.watch('placeRef');
  const point = form.watch('placePoint');
  const accuracy = form.watch('placeAccuracy');

  /**
   * 🔑 **Η ΑΠΑΝΤΗΣΗ ΤΟΥ ΠΑΡΟΧΟΥ ΖΕΙ ΕΔΩ, ΟΧΙ ΣΤΗ ΦΟΡΜΑ — ΚΑΙ ΕΙΝΑΙ ΑΠΟΦΑΣΗ.**
   *
   * Η διεύθυνση που **κατάλαβε** ο γεωκωδικοποιητής και η **έκταση** του αποτελέσματος
   * είναι **επιβεβαίωση**, όχι δήλωση: λένε στον άνθρωπο *«αυτό βρήκα, το αναγνωρίζεις;»*.
   * Η δήλωσή του για το δικό του ακίνητο παραμένει **το κείμενο που έγραψε** (`placeQuery`).
   *
   * ⛔ **Γι' αυτό ΔΕΝ μπαίνουν στη φόρμα**: θα ταξίδευαν στο σύνορο, θα ζητούσαν πεδία
   * στο zod και στην οντότητα, και θα αποθηκεύαμε ως δήλωση του κατόχου μια πρόταση που
   * **δεν έγραψε ποτέ**. Ένα εφήμερο `useState` λέει ακριβώς την αλήθεια της τιμής:
   * ζει όσο η οθόνη, και πεθαίνει μαζί της.
   */
  const [resolved, setResolved] = React.useState<ResolvedPlace | null>(null);

  // 🔑 **Η προσφορά κρατά ΚΑΙ την ακρίβεια** — σε αντίθεση με τη ζήτηση. Είναι
  // **ολόκληρη η Α5**: το σχήμα στον χάρτη *είναι* η ακρίβεια.
  // ⚠️ Οι τρεις τιμές γράφονται στην **ίδια** επανάκληση: ξεχωριστές πράξεις θα άφηναν
  // παράθυρο όπου το σημείο είναι νέο και η ακρίβεια παλιά.
  const { state, resolve, reset } = usePlaceResolver({
    onFound: React.useCallback(
      (place) => {
        form.setValue('placePoint', { lat: place.lat, lng: place.lng }, { shouldDirty: true });
        form.setValue('placeAccuracy', place.accuracy, { shouldDirty: true });
        setResolved(place);
      },
      [form],
    ),
    onCleared: React.useCallback(() => {
      form.setValue('placePoint', null, { shouldDirty: true });
      form.setValue('placeAccuracy', null, { shouldDirty: true });
      setResolved(null);
    }, [form]),
  });

  const busy = state === 'resolving';

  /**
   * **Η ΑΠΑΝΤΗΣΗ ΤΟΥ ΠΑΡΟΧΟΥ, ΑΝ ΑΦΟΡΑ ΑΚΟΜΗ ΤΟ ΤΡΕΧΟΝ ΣΗΜΕΙΟ** — αλλιώς `null`.
   *
   * 🔴 **ΕΝΑ κριτήριο, ΕΝΑ σημείο, και είναι διόρθωση μέσα στο ίδιο commit**: γράφτηκε
   * πρώτα δύο φορές — μία για την έκταση, μία για το κείμενο — και η **δεύτερη ξέχασε
   * το `lng`**. Δύο αντίγραφα της ίδιας ερώτησης αποκλίνουν, και εδώ απέκλιναν πριν
   * προλάβουν να δουν οθόνη: η οθόνη θα εμφάνιζε επιβεβαίωση για **περασμένη**
   * διεύθυνση κάθε φορά που δύο αποτελέσματα μοιράζονταν γεωγραφικό πλάτος.
   *
   * ⚠️ **Γιατί ο έλεγχος χρειάζεται καθόλου**: η φόρμα κρατά σημείο και από
   * **επαναφορτωμένο προσχέδιο**, όπου καμία τοπική απάντηση δεν υπάρχει. Μια έκταση ή
   * μια διεύθυνση που επιβίωσε αλλαγής θα ήταν **σωστό δεδομένο για λάθος τόπο**.
   */
  const fresh =
    resolved !== null && point !== null && resolved.lat === point.lat && resolved.lng === point.lng
      ? resolved
      : null;

  /**
   * **Τι ξέρουμε για τη θέση** — η μοναδική τιμή που ταξιδεύει προς τον χάρτη.
   *
   * ⚠️ **Η ΕΚΤΑΣΗ ΑΝΗΚΕΙ ΣΕ ΕΚΕΙΝΟ ΤΟ ΑΠΟΤΕΛΕΣΜΑ, ΚΑΙ ΕΠΑΛΗΘΕΥΕΤΑΙ ΠΡΙΝ ΧΡΗΣΙΜΟΠΟΙΗΘΕΙ.**
   * Η φόρμα μπορεί να κρατά σημείο από **επαναφορτωμένο προσχέδιο** (`RestoredDraftNotice`)
   * ή από προηγούμενο εντοπισμό· η τοπική απάντηση να είναι άλλη. Ένα `extent` που
   * επιβίωσε αλλαγής σημείου θα κάδραρε τον χάρτη σε **περασμένη** διεύθυνση — σωστό
   * σχήμα, λάθος τόπο. Η σύγκριση συντεταγμένων είναι το ίδιο ιδίωμα με το «*το σημείο
   * ανήκει στο προηγούμενο κείμενο*» παρακάτω.
   *
   * ⚠️ `placeAccuracy === null` ⇒ **κανένα focus**: σημαίνει «κάποιος **έβαλε** το
   * σημείο» (δες την επικεφαλίδα), δηλαδή δεν υπάρχει βαθμός να ζωγραφιστεί. Μια
   * προεπιλογή εδώ θα ήταν μαντεψιά ντυμένη ως γνώση.
   */
  const focus = React.useMemo<PlaceFocus | null>(() => {
    if (point === null || accuracy === null) return null;
    return { point, accuracy, extent: fresh?.extent };
  }, [point, accuracy, fresh]);

  /**
   * **Η ΘΕΣΗ ΜΕ ΤΟ ΛΕΞΙΛΟΓΙΟ ΤΗΣ ΑΓΓΕΛΙΑΣ** — για τον κριτή της κάλυψης *(ADR-846 Φάση 6)*.
   *
   * 🔑 **Η ΙΔΙΑ αλυσίδα που τρέχει ο διακομιστής**, όχι δεύτερη εκτίμηση — το ίδιο
   * ιδίωμα, κατά λέξη, με το `AddressPublicShapeBadge`. Ένας δικός μας μεταφραστής
   * *(«αν υπάρχει ακρίβεια ⇒ geocoded, αλλιώς manual»)* θα ήταν **τρίτη** υλοποίηση
   * κανόνα που έχει ήδη γραφτεί μία φορά, και θα απέκλινε στη σιωπή.
   *
   * ⚠️ **`null` όσο δεν έχει λυθεί η διεύθυνση, ΚΑΙ ΕΙΝΑΙ Ο ΧΡΟΝΙΣΜΟΣ ΤΗΣ ΠΡΟΕΙΔΟΠΟΙΗΣΗΣ**:
   * ο χειριστής του `placeQuery` σβήνει `placePoint` σε **κάθε** πλήκτρο, άρα δεν
   * χρειάζεται χρονόμετρο ούτε `onBlur` — η *«μη πρόωρη επικύρωση»* της NN/g προκύπτει
   * από το ίδιο το μοντέλο της φόρμας.
   */
  const position = React.useMemo<ListingPosition | null>(
    () =>
      point === null
        ? null
        : addressToPositionCandidate(
            { coordinates: point, geocodingMetadata: accuracy === null ? null : { accuracy } },
            EPHEMERAL_LOCATED_AT,
          ),
    [point, accuracy],
  );

  return (
    <FormFieldset legend={t(`${K}.placeAnswer.label`)} help={t(`${K}.placeAnswer.help`)}>
      <OwnerPlaceAnswerField />

      {/*
        🔑 Τα πεδία διεύθυνσης εμφανίζονται **μόνο** όταν ο άνθρωπος δήλωσε ότι θα πει
        τη θέση — ο κανόνας 3 της Α14 §17.2 («η φόρμα μικραίνει»). Και το κείμενο
        **μένει** στη μνήμη της φόρμας αν αλλάξει γνώμη και ξαναγυρίσει.
      */}
      {answer === 'declared' ? (
        <div className="flex flex-col gap-2">
          <label htmlFor={inputId} className="text-sm text-foreground">
            {t(`${K}.form.placeQueryLabel`)}
          </label>

          <div className="flex flex-wrap gap-2">
            <input
              id={inputId}
              type="search"
              {...form.register('placeQuery', {
                // Το σημείο ανήκει στο **προηγούμενο** κείμενο· μόλις αλλάξει το
                // κείμενο, παύει να είναι αλήθεια. Χωρίς αυτό, η φόρμα θα δεχόταν
                // υποβολή με συντεταγμένες που δεν αντιστοιχούν σε ό,τι διαβάζει ο
                // άνθρωπος.
                onChange: () => {
                  if (point !== null) {
                    form.setValue('placePoint', null, { shouldDirty: true });
                    form.setValue('placeAccuracy', null, { shouldDirty: true });
                  }
                  if (state !== 'idle') reset();
                },
              })}
              placeholder={t(`${K}.form.placeQueryPlaceholder`)}
              disabled={busy}
              className="min-w-56 flex-1 rounded-md border border-border bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground"
            />
            <button
              type="button"
              onClick={() => void resolve(query ?? '')}
              disabled={busy || (query ?? '').trim() === ''}
              className="rounded-md border border-border bg-card px-4 py-2 font-medium text-foreground disabled:opacity-50"
            >
              {busy ? t(`${K}.form.placeResolving`) : t(`${K}.form.placeResolve`)}
            </button>
          </div>

          {/*
            🔴 **ΕΔΩ ΕΠΑΨΑΝ ΝΑ ΦΑΙΝΟΝΤΑΙ ΔΕΚΑΔΙΚΕΣ ΣΥΝΤΕΤΑΓΜΕΝΕΣ** (2026-09-02) — και από τις
            2026-09-14 το πλαίσιο είναι **κοινό** με τη βιτρίνα (`ResolvedPlaceConfirmation`,
            ADR-332 D28), που καλεί τον ίδιο `usePlaceResolver` και το πετούσε.
          */}
          {fresh !== null && accuracy !== null && <ResolvedPlaceConfirmation place={fresh} />}
          {state === 'not-found' && (
            <p className="text-sm text-foreground">{t(`${K}.form.placeNotFound`)}</p>
          )}
          {state === 'error' && (
            <p className="text-sm text-foreground">{t(`${K}.form.placeFailed`)}</p>
          )}

          {/*
            🔴 **Η ΔΗΛΩΣΗ ΤΟΥ ΓΡΑΦΕΙΟΥ ΣΥΝΑΝΤΑ ΤΗ ΔΙΕΥΘΥΝΣΗ ΤΗΣ ΑΓΓΕΛΙΑΣ** (ADR-846 Φάση 6).

            Μέχρι σήμερα η σύγκριση γινόταν **μόνο προς τα πίσω** — στη βιτρίνα, πάνω σε
            **ήδη δημοσιευμένες** αγγελίες. Ο μεσίτης μάθαινε ότι η δήλωσή του δεν
            συμφωνεί με τη δουλειά του σε **λάθος οθόνη** και σε **λάθος στιγμή**.

            ⚠️ **Ο φρουρός `brokered` ΔΕΝ είναι βελτιστοποίηση**: για τον ιδιώτη κάτοχο
            η ερώτηση *«είναι εκτός των περιοχών σου;»* **δεν έχει υποκείμενο** — δεν
            δηλώνει περιοχές δραστηριοποίησης. Χωρίς αυτόν, το component θα σιωπούσε
            ούτως ή άλλως (`coverage === null`), αλλά θα **ρωτούσε** — δηλαδή θα άνοιγε
            συνδρομή στη βιτρίνα μιας εταιρείας από τον **προσωπικό** χώρο κάποιου.

            🔑 **Η θέση του στο δέντρο ΕΙΝΑΙ το μήνυμα**: αμέσως κάτω από την
            επιβεβαίωση της διεύθυνσης, γιατί αφορά **αυτό** που μόλις επιβεβαιώθηκε —
            ίδια απόφαση με το `CoverageAgreementNotice` κάτω από τον επιλογέα περιοχής.
          */}
          {brokered && <CoverageReachNotice position={position} />}

          {/*
            🔴 **ΕΔΩ ΣΥΝΑΝΤΙΕΤΑΙ Η ΠΡΟΣΦΟΡΑ ΜΕ ΤΗ ΖΗΤΗΣΗ** (§14.5).
            Η διεύθυνση παραπάνω απαντά *«πού είναι»*· αυτό απαντά *«ποιο **πράγμα**
            είναι»* — και μόνο το δεύτερο μπορεί να ταιριάξει με μια ζήτηση Ζ3/Ζ5
            («*ψάχνω **αυτό** το κτίριο*»). Δύο διαμερίσματα στο ίδιο σημείο έχουν
            **ίδιες** συντεταγμένες και **ίδια** ταυτότητα κτιρίου· η θέση δεν τα
            ξεχωρίζει από ένα τρίτο απέναντι, η ταυτότητα ναι.

            ⚠️ **Προαιρετικό, όπως το τοπογραφικό** (§21.4): *επιλογή, ποτέ
            προϋπόθεση*. Ο κάτοχος που το προσπερνά δημοσιεύει κανονικά.
          */}
          <fieldset className="space-y-2 border-t border-border pt-3">
            <legend className="text-sm font-medium text-foreground">
              {t(`${K}.form.placeLinkLegend`)}
            </legend>
            <p className="text-sm text-muted-foreground">{t(`${K}.form.placeLinkHelp`)}</p>
            <PlaceIdentityField
              chosen={placeRef ?? null}
              focus={focus}
              // ADR-332 D28 Δ — το κείμενο που ΕΔΩΣΕ το σημείο: κάθε πλήκτρο σβήνει το σημείο, άρα τα δύο δεν διαφωνούν.
              addressQuery={query ?? null}
              onChosen={(ref) => form.setValue('placeRef', ref, { shouldDirty: true })}
            />
          </fieldset>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{t(`${K}.form.placeDeclinedNote`)}</p>
      )}
    </FormFieldset>
  );
}
