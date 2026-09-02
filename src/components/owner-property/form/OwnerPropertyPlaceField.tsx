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
import { useFormContext } from 'react-hook-form';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { usePlaceResolver, type ResolvedPlace } from '@/hooks/geo/usePlaceResolver';
import type { PlaceFocus } from '@/lib/geo/geocoding-focus';
import { PlaceIdentityField } from '@/components/geo/PlaceIdentityField';
import { FormFieldset } from '@/components/shared/forms/form-field-primitives';
import type { OwnerPropertyFormValues } from '@/lib/owner-property/owner-property-form-values';

import { OwnerPlaceAnswerField } from './OwnerPropertyFields';

const NS = 'property-market';
const K = `${NS}:offer`;

export function OwnerPropertyPlaceField(): React.ReactElement {
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
            🔴 **ΕΔΩ ΕΠΑΨΑΝ ΝΑ ΦΑΙΝΟΝΤΑΙ ΔΕΚΑΔΙΚΕΣ ΣΥΝΤΕΤΑΓΜΕΝΕΣ** (2026-09-02).
            Η προηγούμενη γραμμή έγραφε `«Εντοπίστηκε: 40.6403, 22.9444»` — δηλαδή
            ζητούσε από τον άνθρωπο να **επαληθεύσει τη διεύθυνσή του διαβάζοντας
            αριθμούς**, που σημαίνει ότι δεν την επαλήθευε κανείς. Το `displayName`
            έφτανε από τον διακομιστή σε **κάθε** κλήση και πεταγόταν.

            🔑 **Και η διαφορά των δύο κειμένων ΕΙΝΑΙ η επαλήθευση**: ο άνθρωπος
            γράφει «Σαμοθράκης 16» και ο πάροχος μπορεί να απαντήσει «Σαμοθράκης,
            Εύοσμος» — **χωρίς τον αριθμό**. Μόνο βλέποντας την απάντηση το μαθαίνει.
          */}
          {fresh !== null && accuracy !== null && (
            <output className="flex flex-col gap-1 rounded-md border border-border bg-card p-3 text-sm">
              <span className="font-medium text-foreground">{fresh.label}</span>
              {/*
                ⚠️ **Η ΑΚΡΙΒΕΙΑ ΓΡΑΦΕΤΑΙ, ΔΕΝ ΥΠΟΝΟΕΙΤΑΙ ΑΠΟ ΤΟ ΣΧΗΜΑ.** Ο κύκλος στον
                χάρτη τη **δείχνει**· αυτή η πρόταση τη **λέει**. Τα δύο όργανα δεν
                είναι πλεονασμός: το ένα απαιτεί να κοιτάξεις τον χάρτη και να
                ερμηνεύσεις, το άλλο διαβάζεται — και **μόνο** το δεύτερο φτάνει σε
                αναγνώστη οθόνης.
              */}
              <span className="text-muted-foreground">
                {t(`${K}.form.placeAccuracyNote.${accuracy}`)}
              </span>

              {/*
                🔴 **Η ΠΡΟΤΑΣΗ ΠΟΥ ΕΛΕΙΠΕ, ΚΑΙ ΠΟΥ ΚΑΝΕΝΑ PORTAL ΔΕΝ ΛΕΕΙ** (2026-09-02).
                Ο βαθμός ακρίβειας από πάνω περιγράφει **την απάντηση** («ο δρόμος — όχι
                το κτίριο»)· αυτή η γραμμή λέει **τι απέγινε η ερώτηση** («τον αριθμό
                τον είπες, δεν επιβεβαιώθηκε»). Ο άνθρωπος που έγραψε «Σαμοθράκης 16»
                και διάβαζε «ο δρόμος — όχι το κτίριο» **δεν μάθαινε ποτέ** τι έγινε ο
                αριθμός του: υπέθετε ότι τον αγνοήσαμε, ή ότι έγραψε λάθος.

                🔑 Η στάση έρχεται από τον **υπάρχοντα** πίνακα ταιριάσματος πεδίων του
                διακομιστή — δες `lib/geocoding/house-number-standing`. Είναι το
                `UNCONFIRMED_BUT_PLAUSIBLE` της Google, πάνω σε δωρεάν δεδομένα.

                ⚠️ **Δεν εμφανίζεται σε `absent`/`confirmed`**: εκεί δεν υπάρχει κενό να
                εξηγηθεί, και μια γραμμή που λέει το αυτονόητο εκπαιδεύει τον αναγνώστη
                να προσπερνά **όλες** τις γραμμές αυτού του πλαισίου.
              */}
              {fresh.houseNumber === 'unconfirmed' && (
                <span className="text-muted-foreground">
                  {t(`${K}.form.placeHouseNumber.unconfirmed`, {
                    number: fresh.declaredNumber ?? '',
                  })}
                </span>
              )}
              {fresh.houseNumber === 'contradicted' && (
                <span className="text-foreground">
                  {t(`${K}.form.placeHouseNumber.contradicted`, {
                    number: fresh.declaredNumber ?? '',
                    resolved: fresh.resolvedNumber ?? '',
                  })}
                </span>
              )}

              {accuracy !== 'exact' && (
                <span className="text-muted-foreground">{t(`${K}.form.placeRefine`)}</span>
              )}
            </output>
          )}
          {state === 'not-found' && (
            <p className="text-sm text-foreground">{t(`${K}.form.placeNotFound`)}</p>
          )}
          {state === 'error' && (
            <p className="text-sm text-foreground">{t(`${K}.form.placeFailed`)}</p>
          )}

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
