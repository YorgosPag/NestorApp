/**
 * @fileoverview **ΜΙΑ ΓΡΑΜΜΗ ΕΝΤΟΛΗΣ** — ο τύπος και ο **ΕΝΑΣ** κατασκευαστής της.
 * @related ADR-841 §7 Α18.12.ζ (E1) · ADR-777 §8.34 · lib/mandate/mandate-standing.ts
 * @module lib/mandate/mandate-catalog-row
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΕΦΥΓΕ ΑΠΟ ΤΗΝ ΥΠΗΡΕΣΙΑ — **ΔΕΥΤΕΡΟΣ ΚΑΤΑΝΑΛΩΤΗΣ, ΟΧΙ ΑΙΣΘΗΤΙΚΗ**
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Μέχρι τις 2026-09-05 η σύνθεση της γραμμής ζούσε **ιδιωτική** μέσα στο
 * `services/mandate/mandate-catalog.service.ts`, που είναι `server-only`. Ήταν σωστό
 * όσο η γραμμή είχε **έναν** αναγνώστη — τον κατάλογο.
 *
 * Η **Α18.12** έδωσε στην εντολή δική της διεύθυνση, άρα υπάρχει πλέον **δεύτερος**
 * αναγνώστης που ρωτά **το ίδιο**: *«τι δείχνει η γραμμή αυτής της εντολής;»*. Δύο
 * απαντήσεις στο ίδιο ερώτημα είναι, κατά γράμμα, το σχήμα του **ADR-749** — και η
 * απόκλισή τους θα ήταν **σιωπηλή**: η οθόνη της μίας εντολής θα έλεγε άλλη κατάσταση
 * από τη γραμμή της **ίδιας** εντολής δύο κλικ πιο πίσω.
 *
 * ⛔ **ΜΗΝ αντιγράψεις αυτή τη σύνθεση σε δεύτερο σημείο** (N.0.2 · N.18): είναι
 * **καθαρή** — δεν αγγίζει δίκτυο, δεν διαβάζει ρολόι — άρα δεν υπάρχει κανένας λόγος
 * να μην κληθεί από όπου χρειάζεται.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΓΙΑΤΙ ΣΤΟ `lib/` ΚΑΙ ΟΧΙ ΣΕ ΥΠΗΡΕΣΙΑ — ΤΟ ΙΔΙΟ ΣΚΕΠΤΙΚΟ ΜΕ ΤΟ ΓΕΙΤΟΝΑ ΤΟΥ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ο τύπος τον **γράφει ο διακομιστής** και τον **διαβάζει η οθόνη**. Ένα `server-only`
 * module ως σπίτι του ανάγκαζε τα components να κάνουν `import type` από αρχείο που
 * **δεν επιτρέπεται** να φορτώσουν — δουλεύει *(ο τύπος σβήνεται στη μεταγλώττιση)*,
 * αλλά δηλώνει λάθος πράγμα για το ποιος ανήκει πού. Είναι **ακριβώς** το σκεπτίκο που
 * είναι ήδη γραμμένο στο {@link ./mandate-client-name} και στο {@link ./mandate-actions}.
 *
 * **Layering**: leaf — καθαροί τύποι + μία καθαρή συνάρτηση. Καμία ανάγνωση, κανένα
 * ρολόι διαβασμένο μέσα (ίδιος κανόνας με το `mandateStandingOf`).
 */

import {
  CLIENT_NAME_IS_MISSING,
  type MandateClientName,
} from '@/lib/mandate/mandate-client-name';
import {
  daysUntilExpiry,
  groupOfStanding,
  mandateStandingOf,
  type MandateStanding,
  type MandateStandingGroup,
} from '@/lib/mandate/mandate-standing';
import { isOwnerPropertyOnTheMarket, type OwnerProperty } from '@/types/owner-property';
import type {
  BrokeredListingMandate,
  MandateNotifyOutcome,
} from '@/types/owner-property-mandate';
import { mandatesOf, notifyOutcomeOf } from '@/types/owner-property-mandate';

/** Μία γραμμή του καταλόγου — ό,τι χρειάζεται η οθόνη, τίποτα παραπάνω. */
export interface MandateCatalogRow {
  readonly ownerPropertyId: string;
  readonly listingTitle: string;
  /**
   * Το όνομα του πελάτη — ή **ποια από τις δύο άγνοιες** ισχύει (ADR-834 §6.5.δ).
   *
   * 🔴 **Ήταν `string | null`, και το `null` κουβαλούσε ΔΥΟ κόσμους**: «η επαφή
   * διαγράφηκε» και «η επαφή υπάρχει χωρίς όνομα». Η οθόνη τύπωνε *«Η επαφή δεν
   * βρέθηκε»* και για τα δύο — δηλαδή έστελνε τον μεσίτη να ψάξει διαγραμμένη επαφή
   * που **δεν** διαγράφηκε. Δες {@link MandateClientName} για τις δύο θεραπείες.
   */
  readonly clientName: MandateClientName;
  readonly clientContactId: string;
  readonly standing: MandateStanding;
  readonly group: MandateStandingGroup;
  /** `null` όταν έχει ήδη λήξει ή η λήξη δεν διαβάζεται — η κατάσταση το λέει. */
  readonly daysLeft: number | null;
  readonly expiresAt: string;
  readonly notifiedAt: string | null;
  /**
   * 🔴 **ΓΙΑΤΙ ΔΕΝ ΕΦΤΑΣΕ ΤΟ ΜΗΝΥΜΑ** — `null` = καμία καταγεγραμμένη απόπειρα.
   *
   * Ταξιδεύει **δίπλα** στο {@link notifiedAt} και ποτέ αντί για αυτό: εκείνο απαντά
   * *«πότε»*, αυτό *«πώς πήγε»*. Χωρίς αυτό, η γραμμή «Δεν στάλθηκε ποτέ» έπρεπε να
   * **μαντέψει** την αιτία από ένα bit (ADR-834 §6.5.δ).
   */
  readonly notifyOutcome: MandateNotifyOutcome | null;
  readonly viewedAt: string | null;
  readonly decidedAt: string | null;
  /** `owner-consent` ⇄ `agency-attestation` — **η προέλευση, ποτέ κρυμμένη**. */
  readonly proofVia: BrokeredListingMandate['proof']['via'];
  /** Είναι **αυτή τη στιγμή** ορατή στον κόσμο; Παράγωγο, όχι δεύτερος κριτής. */
  readonly onTheMarket: boolean;
}

/**
 * **Μία γραμμή** — η σύνθεση, χωρίς καμία απόφαση δικής της.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ `| null` ΕΙΝΑΙ ΔΙΟΡΘΩΣΗ ΣΦΑΛΜΑΤΟΣ ΤΥΠΟΥ, ΟΧΙ ΝΕΑ ΧΑΛΑΡΩΣΗ (ADR-841 Α18.12)
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η υπογραφή δήλωνε `: MandateCatalogRow` και το σώμα έκανε **`return null`** — με
 * `"strict": true` στο `tsconfig.base.json`. Δηλαδή **σφάλμα τύπου που ζούσε στο
 * `main`**, κρυμμένο μόνο επειδή κανείς δεν το κοίταξε.
 *
 * 🔑 **Και η διόρθωση δεν είναι «βγάλε το `return null`»**: η απουσία εντολής είναι
 * **υπαρκτή έκβαση**, απλώς **αδύνατη στον καλούντα του καταλόγου** *(το
 * `readOfficeMandates` φιλτράρει ήδη `mandatesOf(property).length > 0`)*. Ο **δεύτερος**
 * καλών — η ανάγνωση **της μίας** (Α18.12) — δεν έχει τέτοιο φίλτρο: του δίνεις ένα
 * `ownp_*` και μπορεί κάλλιστα να είναι αγγελία **χωρίς** εντολή. Εκεί η απάντηση
 * *«αυτό δεν είναι εντολή»* είναι **πληροφορία για τον άνθρωπο**, όχι σφάλμα.
 *
 * ⇒ Το `null` **ταξιδεύει** αντί να εξαφανίζεται, και ο κάθε καλών το ονομάζει στη δική
 * του γλώσσα. Ίδιο ιδίωμα με το `notifyOutcome` και τις τρεις άγνοιες του πελάτη.
 *
 * @param clientNames — τα ονόματα, **ήδη διαβασμένα** (ο κατάλογος τα φέρνει ομαδικά,
 *   η μία εντολή με μία ανάγνωση). Η συνάρτηση **δεν διαβάζει** — γι' αυτό είναι εδώ.
 * @param nowISOValue — η **περασμένη** στιγμή, ποτέ `new Date()` μέσα: όλες οι γραμμές
 *   ενός καταλόγου πρέπει να κριθούν με **ένα** ρολόι (δες `mandateStandingOf`).
 */
export function toMandateCatalogRow(
  property: OwnerProperty,
  clientNames: ReadonlyMap<string, MandateClientName>,
  nowISOValue: string,
): MandateCatalogRow | null {
  // ⚠️ **Η ΠΡΩΤΗ εντολή, και ο κατάλογος είναι ΤΟΥ ΓΡΑΦΕΙΟΥ** — το ερώτημα του
  //    καταλόγου φιλτράρει ήδη σε `authorCompanyId`, οπότε από εκεί φτάνουν αγγελίες
  //    που το γραφείο κατέγραψε.
  const mandate = mandatesOf(property)[0];
  if (mandate === undefined) return null;

  const standing = mandateStandingOf(mandate, nowISOValue);

  return {
    ownerPropertyId: property.id,
    listingTitle: property.title,
    // ⚠️ **Το `??` ΔΕΝ είναι σιωπηλή προεπιλογή**: ο χάρτης γεμίζει από `getAll`, που
    //    επιστρέφει στιγμιότυπο για **κάθε** ταυτότητα που ζητήθηκε — άρα η μόνη
    //    διαδρομή που φτάνει εδώ χωρίς εγγραφή είναι ταυτότητα που **δεν ζητήθηκε
    //    καθόλου**, και για εκείνη «δεν βρέθηκε επαφή» είναι **η ίδια** απάντηση.
    clientName: clientNames.get(mandate.clientContactId) ?? CLIENT_NAME_IS_MISSING,
    clientContactId: mandate.clientContactId,
    standing,
    group: groupOfStanding(standing),
    daysLeft: daysUntilExpiry(mandate, nowISOValue),
    expiresAt: mandate.expiresAt,
    notifiedAt: mandate.notifiedAt,
    // 🔑 **Μέσω του SSoT αναγνώστη, ΠΟΤΕ σκέτο `mandate.notifyOutcome`**: το πεδίο
    //    λείπει από κάθε εντολή γραμμένη πριν από το §6.5.δ, και ένα `undefined` σε
    //    `Record` ευρετηρίαση θα τύπωνε **κενό** — η άγνοια θα ξαναγινόταν αόρατη.
    notifyOutcome: notifyOutcomeOf(mandate),
    viewedAt: mandate.viewedAt,
    decidedAt: mandate.decidedAt,
    proofVia: mandate.proof.via,
    // 🔴 **Ο ΕΝΑΣ ΚΡΙΤΗΣ, ΠΟΤΕ ΔΕΥΤΕΡΟΣ.** Η πρώτη γραφή αυτού του πεδίου ήταν
    // `lifecycle === 'listed' && confirmation === 'confirmed' && !έληξε` — δηλαδή
    // **ξαναγραμμένος στο χέρι** ο κανόνας που ζει ήδη ολόκληρος στο
    // {@link isOwnerPropertyOnTheMarket}. Θα «δούλευε» σήμερα και θα απέκλινε στην
    // πρώτη αλλαγή του κύκλου ζωής, λέγοντας στο γραφείο «είναι στον χάρτη» για
    // αγγελία που δεν είναι (ADR-749, κατά γράμμα).
    onTheMarket: isOwnerPropertyOnTheMarket(property, nowISOValue),
  };
}
