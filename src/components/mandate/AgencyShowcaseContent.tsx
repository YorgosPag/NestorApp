'use client';

/**
 * @fileoverview **«ΘΕΛΩ ΝΑ ΜΕ ΒΡΙΣΚΟΥΝ»** — η δεύτερη πράξη του §9.10, το #12.
 * @related ADR-827 §9.8 · §9.10 · §9.13 · hooks/mandate/useAgencyShowcase.ts
 * @module components/mandate/AgencyShowcaseContent
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΡΙΑ ΠΕΔΙΑ, ΚΑΙ ΤΑ ΤΡΙΑ ΕΙΝΑΙ ΑΠΟΦΑΣΗ — ΟΧΙ ΕΛΑΧΙΣΤΟ ΒΙΑΒΛΕ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η βιτρίνα **δεν** έχει τηλέφωνο, email, διεύθυνση, λογότυπο, περιγραφή ή
 * βαθμολογία — και **κανένα** από αυτά δεν λείπει από αμέλεια:
 *
 * | Τι λείπει | Γιατί |
 * |---|---|
 * | **κανάλι επικοινωνίας** | §9.8 — το **άρθρο 200 §1** θέλει τη σύμβαση **εγγράφως**· κατάλογος με τηλέφωνο παράγει **τηλεφώνημα**, πράξη από την οποία καμία έγκυρη σύμβαση δεν γεννιέται |
 * | **αμοιβή · βαθμολογία · κατάταξη** | §9.9 α — κατάλογος **ΓΡΑΦΕΙΩΝ** είναι μεγαλύτερη επιφάνεια *steering* από κατάλογο ακινήτων *(NAR, $418M)* |
 * | **αυτόματη συμπλήρωση από τα στοιχεία εταιρείας** | §9.9 β — μεσίτης με **ατομική επιχείρηση** είναι **φυσικό** πρόσωπο, και η έδρα του μπορεί να είναι η **κατοικία** του |
 *
 * ⚠️ **Η τελευταία γραμμή είναι ο λόγος που η φόρμα ΔΕΝ προσυμπληρώνεται από το
 * `companies/{id}`.** Θα ήταν «ευγενικό» και θα δημοσίευε δεδομένα που γράφτηκαν για
 * **άλλον** λόγο. Προσυμπληρώνεται **μόνο** από τη **ίδια τη βιτρίνα**, όταν υπάρχει.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 Η ΚΑΤΑΣΤΑΣΗ ΕΙΝΑΙ Η ΥΠΑΡΞΗ — ΚΑΙ Η ΟΘΟΝΗ ΤΟ ΛΕΕΙ ΕΤΣΙ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Δεν υπάρχει διακόπτης «δημοσιευμένο ναι/όχι», γιατί **δεν υπάρχει τέτοιο πεδίο**:
 * *«η παρουσία ΕΙΝΑΙ η συγκατάθεση»*, και **απόσυρση = διαγραφή**. Ένας διακόπτης θα
 * υπονοούσε σημαία που μπορεί να διαφωνήσει με την ύπαρξη — ADR-749, σε μια οθόνη
 * απόσταση.
 *
 * ⚠️ Καμία συμβολοσειρά οθόνης εδώ (N.11) — όλα από τον πίνακα κλειδιών.
 */

import React from 'react';

import { Button } from '@/components/ui/button';
import { HintedField } from '@/components/ui/hinted-field';
import { PlaceIdentityField } from '@/components/geo/PlaceIdentityField';
import {
  EMPTY_CREDENTIAL_DRAFT,
  ShowcaseCredentialField,
  type ShowcaseCredentialDraft,
} from '@/components/mandate/ShowcaseCredentialField';
import {
  SHOWCASE_KEYS,
  SHOWCASE_NS,
  SHOWCASE_REJECTION_KEYS,
} from '@/components/mandate/agency-showcase-labels';
import {
  BROKERAGE_DENY_NS,
  BROKERAGE_DENY_REASON_KEYS,
  BROKERAGE_SETTINGS,
} from '@/lib/auth/brokerage-authority';
import { isCapabilityActive } from '@/types/organization-capability';
import { useAgencyShowcase, type ShowcaseFailure } from '@/hooks/mandate/useAgencyShowcase';
import type { ShowcaseWireDeclaration } from '@/lib/agency/showcase-wire';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { pickBilingualLabel, resolveEscoLang } from '@/components/shared/esco/esco-label';
import type { EscoLanguage } from '@/types/contacts/esco-types';
import type { PublicShowcase, ShowcaseCredential } from '@/types/agency-profile';
import type { PlaceRef } from '@/types/geo/public-place';
import { formatLongDate } from '@/lib/intl-formatting';
// ⚠️ **Ο σύνδεσμος από το ΣΥΝΟΡΟ** (CHECK 3.61): το πρόθεμα χώρου το προσθέτει εκείνο.
//    Ένα ωμό `next/link` εδώ θα έστελνε τον μεσίτη σε `/settings/brokerage` **χωρίς
//    χώρο** — δηλαδή σε διαδρομή που δεν υπάρχει.
import { Link, useWorkspaceAlias } from '@/lib/workspace/navigation';

// 🧩 ADR-744 §15 (Φ4) — PER-ROUTE SLICE. Χωρίς αυτή τη γραμμή η οθόνη βάφει **ωμά
//    κλειδιά στο πρώτο καρέ** (CHECK 3.51). **ΕΔΩ**, όχι στο `page.tsx`: τα Server και
//    Client δέντρα έχουν **ξεχωριστούς** γράφους module, και εγγραφή από εκεί θα
//    έγραφε σε **άλλο** στιγμιότυπο i18next — πράσινη κλήση που δεν κάνει τίποτα.
import routeSlice from '@/i18n/generated/routes/o__workspace__settings__agency-profile.el.json';
import { registerRouteSlice } from '@/i18n/route-slice';

registerRouteSlice(routeSlice);

/**
 * **Δημοσιευμένο credential → πεδία φόρμας.**
 *
 * ⚠️ Το `standing` **δεν** αντιγράφεται: δεν είναι δήλωση του ανθρώπου, είναι
 * **συμπέρασμα** από το `iscoCode`. Ένα πεδίο φόρμας γι' αυτό θα ήταν ακριβώς η
 * σημαία που το σχήμα αρνείται να αποθηκεύσει.
 */
function draftOf(credential: ShowcaseCredential, lang: EscoLanguage): ShowcaseCredentialDraft {
  const registration =
    credential.attestation.state === 'unknown' ? null : credential.attestation.registration;
  return {
    // ⚠️ **Στη γλώσσα του ανθρώπου**, όχι πάντα ελληνικά: η ετικέτα ταξιδεύει
    //    **δίγλωσση** ακριβώς για να μη χρειάζεται ο επιλογέας δεύτερη ανάγνωση.
    profession: pickBilingualLabel(credential.occupation.label, lang),
    escoUri: credential.occupation.escoUri,
    iscoCode: credential.occupation.iscoCode,
    registrationNumber: registration?.number ?? '',
    registrationChapter:
      registration !== null && registration.authorityKind === 'chapter' ? registration.chapter : '',
  };
}

/**
 * **Γιατί δεν έγινε** — και **κάθε** `t()` εδώ είναι επιλύσιμο.
 *
 * 🔴 **Η ΠΡΩΤΗ ΓΡΑΦΗ ΗΤΑΝ ``t(failureKey(failure))`` ΚΑΙ Ο ΓΕΝΝΗΤΟΡΑΣ ΤΗΝ ΑΡΝΗΘΗΚΕ**
 * *(«4 unresolved dynamic t() calls … the slice will not guess»)*, σωστά: κλειδί που
 * βγαίνει από **κλήση συνάρτησης** δεν διαβάζεται στατικά από κανέναν — ούτε από τον
 * τεμαχιστή, ούτε από τη **CHECK 3.8**.
 *
 * ⚠️ **Η θεραπεία ΔΕΝ ήταν `dynamicKeyPolicy`.** Μια δηλωμένη εξαίρεση θα έλυνε τον
 * τεμαχιστή και θα **άφηνε** το κλειδί αόρατο στην πύλη i18n. Η ευρετηρίαση **πάνω σε
 * σταθερά module** (`SHOWCASE_REJECTION_KEYS[…]`) επιλύεται από **μόνη της** — ίδιο
 * ιδίωμα με το `t(GROUP_LABEL_KEYS[group])` του καταλόγου, που **δεν** χρειάζεται
 * πολιτική.
 */
function FailureMessage({ failure }: { readonly failure: ShowcaseFailure }): React.ReactElement {
  // 🔑 **Δύο namespaces, και το δεύτερο δεν είναι δικό μας**: ο λόγος της άρνησης είναι
  //    η φωνή του **κριτή** (`auth:brokerage.denyReason.*`), όχι της βιτρίνας. Ένα
  //    αντίγραφο των τριών κειμένων στο `property-market` θα ήταν δεύτερο λεξιλόγιο
  //    για την ίδια πρόταση — και θα απέκλινε στην πρώτη διόρθωση διατύπωσης.
  const { t } = useTranslation([SHOWCASE_NS, BROKERAGE_DENY_NS]);

  if (failure.kind === 'rejected') {
    return <>{t(SHOWCASE_REJECTION_KEYS[failure.reason])}</>;
  }
  if (failure.kind === 'not-allowed') {
    // 🔴 **ΤΡΕΙΣ ΑΡΝΗΣΕΙΣ, ΤΡΕΙΣ ΘΕΡΑΠΕΙΕΣ — ΚΑΙ ΜΕΧΡΙ ΣΗΜΕΡΑ ΕΛΕΓΑΝ ΤΟ ΙΔΙΟ.**
    //
    //    Ο `gateBrokerage` απαντά **ονομαστικά** ποια κατάσταση βρήκε, ο κριτής έχει
    //    **γραμμένο** κείμενο για καθεμία σε **δύο** γλώσσες, και η οθόνη ζωγράφιζε ένα
    //    γενικό «δεν επιτρέπεται». Η διαφορά δεν είναι διατύπωση: το `pending` σημαίνει
    //    **περίμενε**, το `revoked` σημαίνει **διάβασε τον λόγο**, το `unrequested`
    //    σημαίνει **δήλωσε**. Ένα κοινό μήνυμα στέλνει και τους τρεις στο ίδιο αδιέξοδο.
    //
    //    ⚠️ **Ευρετηρίαση σε σταθερά module, ΠΟΤΕ το `reason` του σύρματος**: το δεύτερο
    //    θα ήταν δυναμικό κλειδί από **είσοδο** — αόρατο στη CHECK 3.8 και στον τεμαχιστή
    //    του ADR-744. Ίδιο ιδίωμα με το `SHOWCASE_REJECTION_KEYS` δύο γραμμές πιο πάνω,
    //    που **γι' αυτόν ακριβώς τον λόγο** αντικατέστησε ένα `t(failureKey(failure))`.
    //
    //    ⚠️ Το `isCapabilityActive` δεν είναι διακοσμητικό: ο πίνακας **δεν έχει** κλειδί
    //    για το `active` (μια ενεργή ικανότητα δεν αρνείται ποτέ), και το `null` σημαίνει
    //    «η πόρτα δεν ονόμασε κατάσταση». Και οι δύο πέφτουν στο γενικό — **συνειδητά**.
    //
    //    🔴 **ΚΑΙ ΤΟ ΚΕΙΜΕΝΟ ΔΕΙΧΝΕΙ ΠΛΕΟΝ ΚΑΠΟΥ** (ADR-824 §12.14). Το
    //    `denyReason.revoked` έλεγε *«δες τον λόγο **στις ρυθμίσεις του οργανισμού**»*
    //    και οι ρυθμίσεις **δεν είχαν τέτοια σελίδα** — υπόσχεση χωρίς τόπο, η ίδια
    //    κλάση με τα τέσσερα ζωντανά 404 του έργου. Ο σύνδεσμος ζει **εδώ**, στο σημείο
    //    του εμποδίου, και **όχι** ως μόνιμη γραμμή μενού: μια γραμμή ορατή σε όλους θα
    //    διαφήμιζε ρυθμιζόμενη δραστηριότητα σε όποιον δεν τη ζήτησε ποτέ — ο κανόνας
    //    είναι γραμμένος στο `isCapabilityKnownToOrganization`. Όποιος φτάνει εδώ έχει
    //    **ήδη επιχειρήσει** την πράξη: δεν του διαφημίζουμε, του **απαντάμε**.
    return failure.status !== null && !isCapabilityActive(failure.status) ? (
      <>
        {t(BROKERAGE_DENY_REASON_KEYS[failure.status])}{' '}
        <Link href={BROKERAGE_SETTINGS.route} className="underline">
          {t(BROKERAGE_SETTINGS.linkKey)}
        </Link>
      </>
    ) : (
      <>{t(SHOWCASE_KEYS.notAllowed)}</>
    );
  }
  // ── Φ6-Β4: τρεις νέες αστοχίες, και **καμία** δεν λέει «απέτυχε» ────────────
  //
  // 🔴 Η ΔΙΑΚΡΙΣΗ ΕΙΝΑΙ Η ΘΕΡΑΠΕΙΑ (N.12): *«διάλεξε ξανά»* ≠ *«ξαναδοκίμασε»*.
  //    Ένα κοινό «απέτυχε» θα έστελνε τον άνθρωπο να **αλλάξει σωστή επιλογή**
  //    επειδή έπεσε η δική μας βάση.
  if (failure.kind === 'occupation-unknown') {
    return <>{t(SHOWCASE_KEYS.occupationUnknown)}</>;
  }
  if (failure.kind === 'place-not-found') {
    return <>{t(SHOWCASE_KEYS.placeNotFound)}</>;
  }
  if (failure.kind === 'unavailable') {
    return <>{t(SHOWCASE_KEYS.temporarilyUnavailable)}</>;
  }
  // ⚠️ *«δεν είναι η διεύθυνσή σου»* και *«δεν μπόρεσα να ρωτήσω»* μοιράζονται σήμερα
  //    το γενικό μήνυμα, αλλά παραμένουν **χωριστές τιμές** στον τύπο: την ημέρα που
  //    αποκτήσουν δικό τους κείμενο, η αλλαγή γίνεται εδώ και μόνο εδώ.
  return <>{t(SHOWCASE_KEYS.failed)}</>;
}

export function AgencyShowcaseContent(): React.ReactElement {
  const { t, i18n } = useTranslation([SHOWCASE_NS]);
  const { lang } = resolveEscoLang(undefined, i18n.language);
  const alias = useWorkspaceAlias() ?? '';
  const { state, busy, failure, publish, withdraw } = useAgencyShowcase();

  const published = state.phase === 'published' ? state.profile : null;
  const [displayName, setDisplayName] = React.useState('');
  const [credentials, setCredentials] = React.useState<readonly ShowcaseCredentialDraft[]>([
    EMPTY_CREDENTIAL_DRAFT,
  ]);
  const [place, setPlace] = React.useState<PlaceRef | null>(null);

  // ⚠️ **Προσυμπλήρωση ΜΟΝΟ από την ίδια τη βιτρίνα** — ποτέ από το `companies/{id}`
  //    (§9.9 β). Το `publishedAt` είναι το σήμα «ήρθε νέα έκδοση», ώστε μια ανάκληση
  //    που σβήνει το προφίλ να μην ξαναγράφει τα πεδία που πληκτρολογεί ο άνθρωπος.
  const publishedAt = published?.publishedAt ?? null;
  React.useEffect(() => {
    if (published === null) return;
    setDisplayName(published.displayName);
    setCredentials(published.credentials.map((credential) => draftOf(credential, lang)));
    // 🔴 **ΚΑΙ Ο ΤΟΠΟΣ — ΠΟΥ ΜΕΧΡΙ ΤΗ Φ6-Β4 ΗΤΑΝ ΔΟΜΙΚΑ ΝΕΚΡΟΣ.** Η φόρμα
    //    έστελνε `place: published?.place ?? null`, δηλαδή **πάντα ό,τι ήδη
    //    υπήρχε** — και επειδή τίποτα δεν το έγραφε ποτέ, ήταν **πάντα `null`**.
    //    Τα κλειδιά `placeLabel`/`placeHint` υπήρχαν **χωρίς καταναλωτή**: μια
    //    υπόσχεση στο locale που καμία οθόνη δεν τηρούσε.
    setPlace(published.place);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- κλειδί ταυτότητας έκδοσης
  }, [publishedAt]);

  return (
    // 🔴 **`section`, ΟΧΙ `main` — και ΚΑΜΙΑ γεωμετρία.** Και τα τρία λάθη της πρώτης
    //    γραφής (`mx-auto` · `max-w-2xl` · `p-4`) τα έπιασε το **CHECK 3.63 (ADR-797)**,
    //    όχι η κρίση μου:
    //
    // 1. Το κέλυφος του `(app)` αποδίδει **ήδη** `<main>` (`MainContentBridge`) —
    //    δεύτερο `<main>` είναι **άκυρο HTML** και **δύο** ορόσημα «κύριο περιεχόμενο».
    // 2. Το `mx-auto max-w-*` είναι το ιδίωμα του **`(me)`**, του ιδιώτη· οι σελίδες
    //    του `(app)` είναι **`w-full`**. Χειρόγραφο ταβάνι πλάτους είναι **δεύτερη
    //    αυθεντία** — η κλίμακα ζει στο `spacing.layout.measure`.
    // 3. Το `p-4` έδινε **διπλό κενό** πάνω στον ρευστό διάδρομο του κελύφους:
    //    *«outer spacing is a layout concern, not a component one»*.
    <section className="flex w-full flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="m-0 text-2xl font-semibold text-foreground">{t(SHOWCASE_KEYS.title)}</h1>
        <p className="m-0 text-muted-foreground">{t(SHOWCASE_KEYS.lead)}</p>
      </header>

      <p
        className="m-0 text-sm font-medium text-foreground"
        // 🔑 Η κατάσταση **είναι** η ύπαρξη του εγγράφου — καμία σημαία.
        data-testid="showcase-status"
      >
        {published === null
          ? t(SHOWCASE_KEYS.statusNotPublished)
          : t(SHOWCASE_KEYS.statusPublished)}
      </p>

      <IdentityFields alias={alias} displayName={displayName} onName={setDisplayName} />

      <CredentialList credentials={credentials} onChange={setCredentials} />

      <PlaceSection place={place} onChosen={setPlace} />

      {/* 🔑 Η απουσία καναλιού είναι **δηλωμένη**, όχι σιωπηλή: ο μεσίτης οφείλει να
          ξέρει ότι δεν λείπει πεδίο — ότι έτσι γεννιέται γραπτό αίτημα (§9.8). */}
      <p className="m-0 rounded-md border border-border bg-card p-3 text-sm text-muted-foreground">
        {t(SHOWCASE_KEYS.noChannel)}
      </p>

      {failure !== null && (
        <p role="alert" className="m-0 text-sm text-destructive">
          <FailureMessage failure={failure} />
        </p>
      )}

      <ShowcaseActions
        busy={busy}
        published={published}
        onPublish={() => publish(declarationOf(alias, displayName, credentials, place))}
        onWithdraw={withdraw}
      />
    </section>
  );
}

// =============================================================================
// ΤΑ ΤΡΙΑ ΠΟΥ ΕΦΥΓΑΝ ΑΠΟ ΤΟΝ ΟΡΧΗΣΤΡΩΤΗ (N.7.1 — συνάρτηση ≤ 40 γραμμές)
// =============================================================================

/**
 * **Ο πίνακας ειδικοτήτων.**
 *
 * 🔴 **ΠΙΝΑΚΑΣ ΚΑΙ ΟΧΙ ΕΝΑ ΠΕΔΙΟ, ΚΑΙ ΕΙΝΑΙ ΑΠΟΦΑΣΗ.** Το μικτό γραφείο
 * *(μεσίτης **και** διακοσμητής)* είναι εκφράσιμο στο σχήμα· μια φόρμα με ένα
 * πεδίο θα το έκανε **αδύνατο να δηλωθεί** — δηλαδή θα άφηνε δηλωμένη
 * δυνατότητα **χωρίς πόρτα**, που είναι χειρότερο από το να μην υπάρχει.
 */
function CredentialList({
  credentials,
  onChange,
}: {
  readonly credentials: readonly ShowcaseCredentialDraft[];
  readonly onChange: (next: readonly ShowcaseCredentialDraft[]) => void;
}): React.ReactElement {
  const { t } = useTranslation([SHOWCASE_NS]);

  return (
    <section className="flex flex-col gap-3">
      {credentials.map((draft, index) => (
        <ShowcaseCredentialField
          key={index}
          index={index}
          draft={draft}
          onChange={(next) => onChange(credentials.map((entry, i) => (i === index ? next : entry)))}
          // ⚠️ `null` στη **μόνη** ειδικότητα: βιτρίνα χωρίς καμία δεν υπάρχει,
          //    και ο γραφέας θα την αρνιόταν ονομαστικά — καλύτερα να μην
          //    προσφέρεται η πράξη που οδηγεί εκεί.
          onRemove={
            credentials.length > 1
              ? () => onChange(credentials.filter((_, i) => i !== index))
              : null
          }
        />
      ))}
      <div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onChange([...credentials, EMPTY_CREDENTIAL_DRAFT])}
        >
          {t(SHOWCASE_KEYS.addOccupation)}
        </Button>
      </div>
    </section>
  );
}

/**
 * **Ο τόπος — και το χειριστήριο είναι ΔΑΝΕΙΚΟ** *(N.18)*.
 *
 * Το `PlaceIdentityField` απαντά **ήδη** στο *«ποιο κτίριο;»* για δύο άλλους
 * τομείς· τρίτο αντίγραφο εδώ θα ήταν κλώνος **σε χειριστήριο με χάρτη μέσα**.
 *
 * ⚠️ Ο **στόχος είναι `land`**: η βιτρίνα δηλώνει **πού δουλεύει ο
 * επαγγελματίας**, όχι σε ποιο διαμέρισμα — και η **γη** είναι που κρατά τη
 * θέση *(Α1)*, από την οποία ο διακομιστής παράγει το `position`.
 */
function PlaceSection({
  place,
  onChosen,
}: {
  readonly place: PlaceRef | null;
  readonly onChosen: (ref: PlaceRef) => void;
}): React.ReactElement {
  const { t } = useTranslation([SHOWCASE_NS]);

  return (
    <section className="flex flex-col gap-2">
      <h2 className="m-0 text-sm font-medium text-foreground">{t(SHOWCASE_KEYS.placeLabel)}</h2>
      <p className="m-0 text-xs text-muted-foreground">{t(SHOWCASE_KEYS.placeHint)}</p>
      <PlaceIdentityField chosen={place} onChosen={onChosen} target="land" />
    </section>
  );
}

/**
 * **Τι φεύγει στο σύρμα** — και **μόνο ταξινομημένες** ειδικότητες.
 *
 * 🔴 Μια ειδικότητα χωρίς `escoUri` *(ελεύθερο κείμενο)* **δεν μπαίνει σε κανένα
 * φίλτρο**, και η διαδρομή θα την απέρριπτε ούτως ή άλλως. Το φιλτράρισμα εδώ
 * δεν είναι σιωπηλή απόρριψη: ο **επιλογέας το λέει ήδη στον άνθρωπο**, δίπλα
 * στο πεδίο, **πριν** πατήσει *(`occupationUnclassified`)*.
 *
 * ⛔ **Κανένα `position`**: τη γεωμετρία την παράγει ο **διακομιστής** από τη γη.
 * Δες `lib/agency/showcase-wire.ts`.
 */
function declarationOf(
  alias: string,
  displayName: string,
  credentials: readonly ShowcaseCredentialDraft[],
  place: PlaceRef | null,
): ShowcaseWireDeclaration {
  return {
    alias,
    displayName,
    credentials: credentials
      .filter((draft): draft is ShowcaseCredentialDraft & { escoUri: string } => draft.escoUri !== null)
      .map((draft) => ({
        escoUri: draft.escoUri,
        registrationNumber: draft.registrationNumber,
        registrationChapter: draft.registrationChapter,
      })),
    place,
  };
}

/**
 * **Ποιος είσαι** — η διεύθυνση *(αμετάβλητη)* και η επωνυμία.
 *
 * ⚠️ Το ψευδώνυμο είναι `readOnly` **επίτηδες**: το κρίνει ο διακομιστής απέναντι
 * στο `companyId` **της απόδειξης** *(§9.13)*. Επεξεργάσιμο εδώ θα ήταν πεδίο που
 * ο άνθρωπος αλλάζει και **η πόρτα απορρίπτει** — ερώτηση χωρίς έγκυρη απάντηση.
 */
function IdentityFields({
  alias,
  displayName,
  onName,
}: {
  readonly alias: string;
  readonly displayName: string;
  readonly onName: (value: string) => void;
}): React.ReactElement {
  const { t } = useTranslation([SHOWCASE_NS]);

  return (
    <section className="flex flex-col gap-4">
      <HintedField
        id="showcase-alias"
        label={t(SHOWCASE_KEYS.aliasLabel)}
        hint={t(SHOWCASE_KEYS.aliasHint)}
        value={alias}
        readOnly
      />
      <HintedField
        id="showcase-name"
        label={t(SHOWCASE_KEYS.nameLabel)}
        hint={t(SHOWCASE_KEYS.nameHint)}
        placeholder={t(SHOWCASE_KEYS.namePlaceholder)}
        value={displayName}
        onChange={onName}
      />
    </section>
  );
}

/**
 * **Οι δύο πράξεις** — και η δεύτερη υπάρχει **μόνο όταν υπάρχει τι να αποσυρθεί**.
 *
 * 🔑 **Καμία σημαία «δημοσιευμένο»**: η κατάσταση **ΕΙΝΑΙ η ύπαρξη** του εγγράφου
 * *(§9.10)*, και **απόσυρση = διαγραφή**. Ένας διακόπτης εδώ θα υπονοούσε πεδίο
 * που μπορεί να διαφωνήσει με την ύπαρξη — ADR-749, σε μια οθόνη απόσταση.
 */
function ShowcaseActions({
  busy,
  published,
  onPublish,
  onWithdraw,
}: {
  readonly busy: 'publishing' | 'withdrawing' | null;
  readonly published: PublicShowcase | null;
  readonly onPublish: () => Promise<void>;
  readonly onWithdraw: () => Promise<void>;
}): React.ReactElement {
  const { t } = useTranslation([SHOWCASE_NS]);

  return (
    <footer className="flex flex-wrap items-center gap-3">
      <Button type="button" disabled={busy !== null} onClick={() => void onPublish()}>
        {busy === 'publishing'
          ? t(SHOWCASE_KEYS.publishing)
          : t(published === null ? SHOWCASE_KEYS.publish : SHOWCASE_KEYS.republish)}
      </Button>

      {published !== null && (
        <Button
          type="button"
          variant="outline"
          disabled={busy !== null}
          onClick={() => void onWithdraw()}
        >
          {busy === 'withdrawing' ? t(SHOWCASE_KEYS.withdrawing) : t(SHOWCASE_KEYS.withdraw)}
        </Button>
      )}

      <span className="text-sm text-muted-foreground">
        {published === null
          ? t(SHOWCASE_KEYS.withdrawHint)
          : t(SHOWCASE_KEYS.publishedAt, { date: formatLongDate(published.publishedAt) })}
      </span>
    </footer>
  );
}
