/**
 * @fileoverview **ΣΥΓΚΡΟΥΟΝΤΑΙ ΑΥΤΕΣ ΟΙ ΔΥΟ ΕΝΤΟΛΕΣ;** — ο **ΠΡΩΤΟΣ** καταναλωτής
 *   του κριτή κατάληψης. Ο κανόνας ζει στο `lib/occupancy/`· εδώ ζει η **μετάφραση**.
 * @related lib/occupancy/occupancy-conflict.ts · types/listing-agreement.ts ·
 *   types/property-offers.ts
 * @module lib/mandate/mandate-conflict
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΙ ΕΛΕΙΠΕ, ΜΕΤΡΗΜΕΝΟ (ADR-832 — ο λόγος που γεννήθηκε ο κριτής)
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ο μόνος έλεγχος ήταν `property.mandate.kind !== 'self'` — *«έχει ήδη γραφείο; όχι»*.
 * **Δεν ρωτούσε το είδος**, οπότε:
 *
 * | Περίπτωση | Πριν | Σωστό |
 * |---|---|---|
 * | **Απλή** εντολή σε δεύτερο γραφείο | ⛔ άρνηση | ✅ — είναι **ο ορισμός** της απλής |
 * | Αποκλειστική **πώλησης** + εντολή **εκμίσθωσης** | ⛔ άρνηση | ✅ — άλλο «περιεχόμενο» (άρθρο 200 §4) |
 * | **Διαδοχικές** εντολές (η μία λήγει, η άλλη αρχίζει) | ⛔ άρνηση | ✅ — δεν συνυπάρχουν ποτέ |
 * | Δεύτερη **αποκλειστική** στον ίδιο πόρο | ⛔ άρνηση | ⛔ άρνηση — **το μόνο σωστό από τα τέσσερα** |
 *
 * ⇒ Ένα στα τέσσερα. Και η λέξη «αποκλειστική» στην οθόνη δεν είχε **καμία** συνέπεια:
 * το `allowsOtherAgencies` υπήρχε με **μηδέν καλούντες** (ADR-749 §5, αδρανής φρουρός).
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΤΙ ΑΛΛΑΞΕ ΣΤΗ Φ2 ΤΟΥ ADR-835 — **ΛΕΠΤΟΣ ΚΑΤΑΝΑΛΩΤΗΣ, ΟΧΙ ΔΕΥΤΕΡΟΣ ΚΑΝΟΝΑΣ**
 * ────────────────────────────────────────────────────────────────────────────
 *
 * ```
 *  MandateOccupancy ──μετάφραση──► Occupancy<MandateOccupancy> ──► occupancyConflicts()
 *  MandateConflict  ◄─μετάφραση── OccupancyConflict<…>                (ο ΕΝΑΣ κριτής)
 * ```
 *
 * Ο κανόνας (τομή πόρων ∧ επικάλυψη χρόνου ∧ ασύμβατοι τρόποι) **έφυγε** στο
 * `lib/occupancy/occupancy-conflict.ts`, όπου απέκτησε **δεύτερο** καταναλωτή: τις
 * κρατήσεις (`lib/stay/stay-conflict.ts`). Εδώ έμεινε **μόνο** ό,τι ξέρει η εντολή:
 *
 * | Τι μεταφράζεται | Πώς |
 * |---|---|
 * | **κάτοχος** | `agencyCompanyId` → `holderId` |
 * | **τρόπος** | `agreement` → `lockModeFor(agreement)` — η γνώση αυτού του τομέα |
 * | **πόρος** | `scope` → **ολόκληρο** το ακίνητο σε κάθε πράξη ({@link wholeProperty}) |
 * | **πολιτική** | {@link MANDATE_OCCUPANCY_POLICY} = `'replaces'` |
 *
 * 🔑 **Η δημόσια επιφάνεια ΔΕΝ άλλαξε**: `MandateOccupancy` · `MandateConflict` ·
 * `MandateConflictVerdict` · `mandateConflicts()` λένε ό,τι έλεγαν, στους ίδιους 13
 * καταναλωτές. Η γενίκευση αποδεικνύεται από τον **δεύτερο** καταναλωτή, όχι από
 * αναδιάταξη του πρώτου.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ⛔ ΤΙ ΔΕΝ ΕΙΝΑΙ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * ⛔ **Δεν είναι η θεματοφυλακή** (`lib/owner-property/listing-custody.ts`). Εκείνη
 * απαντά *«ποιος **διαχειρίζεται** την αγγελία»* — εξουσιοδότηση, ερώτημα χώρου. Αυτό
 * απαντά *«ποιος κρατά **ποιο δικαίωμα**, σε **ποια πράξη**, για **πόσο**»* — ερώτημα
 * σύμβασης. Η διάκριση είναι ήδη γραμμένη στο `mandate-actions.service.ts:123`.
 *
 * ⛔ **Δεν κρίνει διάρκεια.** Το νόμιμο ανώτατο είναι το `exceedsStatutoryTerm`
 * (`types/owner-property-mandate.ts`), που ρωτά το `statutoryTermLimitFor` — τον ΕΝΑ
 * τόπο όπου ζει ο νόμος. Δεύτερο όριο εδώ θα ήταν ADR-749.
 *
 * ⛔ **Δεν ξέρει τι είναι «ζωντανή» εντολή.** Ληγμένες, ανακληθείσες
 * (`agencyRevokedAt`), απορριφθείσες (`confirmation: 'declined'`) — τις φιλτράρει ο
 * **καλών**, που κατέχει το σχήμα. Εδώ φτάνουν **μόνο** καταλήψεις που ισχύουν.
 *
 * **Layering**: leaf — καθαρές συναρτήσεις, μηδέν I/O, μηδέν ρολόι.
 */

import {
  occupancyConflicts,
  type Occupancy,
  type OccupancyConflictReason,
  type OccupancyPolicy,
} from '@/lib/occupancy/occupancy-conflict';
import { OCCUPANCY_MODES } from '@/lib/occupancy/occupancy-mode';
import { wholeProperty } from '@/lib/occupancy/occupancy-resource';
import { lockModeFor, type ListingAgreement } from '@/types/listing-agreement';
import type { OfferKind } from '@/types/property-offers';

// =============================================================================
// 1. ΤΙ ΚΑΤΑΛΑΜΒΑΝΕΙ ΤΙ
// =============================================================================

/**
 * **Μια κατάληψη εντολής**: ποιος κρατά, σε ποιες πράξεις, από πότε ως πότε.
 *
 * 🔑 **Σκόπιμα ΔΕΝ είναι το `BrokeredListingMandate`.** Είναι το **ελάχιστο** που
 * χρειάζεται ο κριτής — ίδιο ιδίωμα με το `SalesDisplayEligibilityInput`
 * (`constants/commercial-statuses.ts`), *«agnostic σε data shape»*. Έτσι ολόκληρος ο
 * πίνακας αποφάσεων ελέγχεται **χωρίς Firestore και χωρίς εντολές**, και η ημέρα που
 * θα αλλάξει το σχήμα της εντολής δεν αγγίζει τον κανόνα.
 */
export interface MandateOccupancy {
  /** Ποιος κρατά. **Η ταυτότητα του κατόχου, ποτέ όνομα** — η οθόνη το λύνει. */
  readonly agencyCompanyId: string;
  /** Το είδος της συμφωνίας — από αυτό παράγεται ο **τρόπος** κατάληψης. */
  readonly agreement: ListingAgreement;
  /**
   * **Ποιες πράξεις καλύπτει** — το «περιεχόμενο» του άρθρου 200 §4.
   *
   * ⚠️ **Κενό σύνολο δεν καταλαμβάνει τίποτα**, και είναι έγκυρη κατάσταση: εντολή
   * που δεν λέει για ποια πράξη δίνεται δεν εμποδίζει καμία. Δεν είναι σφάλμα εδώ —
   * είναι invariant της εντολής, και κρίνεται εκεί.
   */
  readonly scope: readonly OfferKind[];
  /** ISO — πότε **αρχίζει** να ισχύει. */
  readonly startsAt: string;
  /** ISO — πότε **παύει**. `null` = ανοιχτή διάρκεια. */
  readonly expiresAt: string | null;
}

/** **Μία συγκεκριμένη σύγκρουση** — με ποιον, σε ποια πράξη, γιατί. */
export interface MandateConflict {
  /** Η κατάληψη που εμποδίζει. Φέρνει μαζί της **λήξη** ⇒ η οθόνη λέει «ως πότε». */
  readonly with: MandateOccupancy;
  /** **Σε ποια πράξη** συγκρούονται. Δύο πράξεις ⇒ δύο εγγραφές, ποτέ μία «γενική». */
  readonly resource: OfferKind;
  readonly reason: OccupancyConflictReason;
}

/**
 * **Η ετυμηγορία** — κλειστό σύνολο, ποτέ `boolean`.
 *
 * 🔴 **Το `undetermined` ΔΕΝ είναι «καθαρό» και ΔΕΝ είναι «σύγκρουση»** (N.12: *άγνωστο
 * ≠ κενό*). Δες τον γενικό τύπο στο `lib/occupancy/occupancy-conflict.ts`.
 */
export type MandateConflictVerdict =
  | { readonly kind: 'clear' }
  | { readonly kind: 'conflicts'; readonly conflicts: readonly MandateConflict[] }
  | { readonly kind: 'undetermined'; readonly unreadable: readonly MandateOccupancy[] };

// =============================================================================
// 2. Η ΜΕΤΑΦΡΑΣΗ ΠΡΟΣ ΤΟΝ ΚΡΙΤΗ
// =============================================================================

/**
 * **Ο ΑΝΩΝΥΜΟΣ ΠΟΡΟΣ-ΡΙΖΑ ΤΩΝ ΕΝΤΟΛΩΝ.**
 *
 * 🔑 Οι εντολές ζουν **μέσα** στο έγγραφο του ακινήτου (ADR-832 §5.6): *«μία ανάγνωση
 * κατά ταυτότητα μέσα στη συναλλαγή βλέπει όλες τις καταλήψεις»*. Άρα κάθε σύνολο που
 * φτάνει στον κριτή ανήκει σε **ένα** ακίνητο, και ο πόρος-ρίζα δεν χρειάζεται όνομα.
 *
 * ⚠️ **ΔΕΝ είναι sentinel «άγνωστο»**, και ο γενικός κριτής δεν τον ερμηνεύει: είναι
 * απλώς ένα σύνορο για το μπαλαντέρ `spaceId: null`. Χωρίς σύνορο, δύο **διαφορετικά**
 * ακίνητα καταλαμβανόμενα ολόκληρα θα τέμνονταν.
 *
 * ⚠️ Το `#` το κάνει **αδύνατο** να συμπέσει με enterprise id (`ownp_*`), ώστε η μέρα
 * που κάποιος περάσει πραγματικό `propertyId` να μη συμπέσει σιωπηλά με αυτό.
 */
const MANDATE_RESOURCE_ROOT = '#mandates-of-one-property';

/**
 * **Ο ίδιος κάτοχος ⇒ ΑΝΤΙΚΑΤΑΣΤΑΣΗ** — η δηλωμένη πολιτική της εντολής.
 *
 * 🔑 Νέοι όροι προς γραφείο που ήδη κρατά εντολή είναι **ανανέωση**, όχι δεύτερη
 * κατάληψη — άλλο ερώτημα, άλλος κριτής (`judgeAgainstHistory`). Χωρίς αυτό, κάθε
 * ανανέωση αποκλειστικής θα μπλόκαρε στην **ίδια της την προηγούμενη**.
 *
 * 🔴 **Και είναι ΑΚΡΙΒΩΣ ΤΟ ΑΝΤΙΘΕΤΟ για τις κρατήσεις** (`STAY_OCCUPANCY_POLICY` =
 * `'conflicts'`). Όσο ο κανόνας ζούσε ως `if` μέσα στον βρόχο, ο δεύτερος
 * καταναλωτής θα τον κληρονομούσε **αθόρυβα** — και η αθόρυβη κληρονομιά εκεί λέγεται
 * **διπλοκράτηση**.
 */
export const MANDATE_OCCUPANCY_POLICY: OccupancyPolicy = { sameHolder: 'replaces' };

/**
 * **Η εντολή ως κατάληψη πόρου.**
 *
 * ⚠️ **Ο πόρος είναι ΟΛΟΚΛΗΡΟ το ακίνητο** (`spaceId: null`) σε κάθε πράξη του
 * `scope`, και δεν είναι παράλειψη: μια εντολή μεσιτείας αφορά **πάντα** ολόκληρο το
 * ακίνητο (ADR-835 §4.12 — *«η γενίκευση είναι προς τα πάνω»*). Σύνολο ενός στοιχείου
 * με μπαλαντέρ συμπεριφέρεται **ακριβώς** όπως ο παλιός πόρος `(ακίνητο × πράξη)`.
 */
function toOccupancy(mandate: MandateOccupancy): Occupancy<MandateOccupancy> {
  return {
    // 🔑 Η εντολή είναι **πεδίο** μέσα στο ακίνητο, όχι έγγραφο: *«αλλάζει χέρια, όχι
    //    ταυτότητα»* (ADR-827 Α3). Τη θέση της ταυτότητας την παίρνει η πολιτική.
    occupancyId: null,
    holderId: mandate.agencyCompanyId,
    mode: lockModeFor(mandate.agreement),
    resources: wholeProperty(MANDATE_RESOURCE_ROOT, mandate.scope),
    startsAt: mandate.startsAt,
    expiresAt: mandate.expiresAt,
    source: mandate,
  };
}

// =============================================================================
// 3. Η ΔΗΜΟΣΙΑ ΕΠΙΦΑΝΕΙΑ
// =============================================================================

/**
 * **Μπορεί αυτή η εντολή να σταθεί δίπλα σε εκείνες;**
 *
 * @param candidate — η κατάληψη που ζητείται.
 * @param existing — οι **ζωντανές** καταλήψεις του ίδιου ακινήτου. Το φιλτράρισμα
 *   (ληγμένες · ανακληθείσες · απορριφθείσες) ανήκει στον καλούντα — δες την κεφαλίδα.
 *
 * 🔑 **Καμία ανάγνωση, κανένα ρολόι, καμία εξαίρεση.** Παίρνει δεδομένα, δίνει
 * ετυμηγορία — γι' αυτό τα άκρα (ίδια στιγμή λήξης/έναρξης, ανάποδο διάστημα, κενό
 * `scope`) είναι δοκιμάσιμα χωρίς να ταξιδέψει κανείς στον χρόνο.
 *
 * ⚠️ **ΟΛΕΣ οι συγκρούσεις, ποτέ η πρώτη** — ίδιο συμβόλαιο με το
 * `mandateInvariantViolations`. Ο άνθρωπος που εμποδίζεται από τρία γραφεία πρέπει να
 * τα δει **και τα τρία**· αλλιώς λύνει το ένα, ξαναπροσπαθεί, και συναντά το επόμενο.
 */
export function mandateConflicts(
  candidate: MandateOccupancy,
  existing: readonly MandateOccupancy[],
): MandateConflictVerdict {
  const verdict = occupancyConflicts(
    toOccupancy(candidate),
    existing.map(toOccupancy),
    MANDATE_OCCUPANCY_POLICY,
  );

  if (verdict.kind === 'conflicts') {
    return {
      kind: 'conflicts',
      // ⚠️ Ο πόρος **ξεντύνεται** πίσω σε σκέτη πράξη: για την εντολή ο χώρος είναι
      //    πάντα «ολόκληρο», άρα μια δομή `{ propertyId, spaceId }` στην οθόνη θα
      //    ήταν **θόρυβος που δεν διακρίνει τίποτα**.
      conflicts: verdict.conflicts.map((conflict) => ({
        with: conflict.with.source,
        resource: conflict.resource.kind,
        reason: conflict.reason,
      })),
    };
  }

  if (verdict.kind === 'undetermined') {
    return {
      kind: 'undetermined',
      unreadable: verdict.unreadable.map((occupancy) => occupancy.source),
    };
  }

  return { kind: 'clear' };
}

/**
 * **Ο ΠΑΡΟΝΟΜΑΣΤΗΣ**: κάθε είδος εντολής έχει δηλωμένο τρόπο κατάληψης.
 *
 * 🔑 Ο τύπος `Record<ListingAgreement, OccupancyMode>` το εγγυάται ήδη· αυτό υπάρχει
 * ώστε η εγγύηση να μπορεί να **κοκκινίσει** και όχι μόνο να μη μεταγλωττίζεται
 * (CHECK 3.54 — *«μπορεί αυτό το αρχείο test να κοκκινίσει κάτι;»*). Ίδια κίνηση με
 * το `everyAgreementNamed()` του `listing-agreement-labels.ts`.
 */
export function everyAgreementHasLockMode(
  agreements: readonly ListingAgreement[],
): boolean {
  return agreements.every((agreement) =>
    (OCCUPANCY_MODES as readonly string[]).includes(lockModeFor(agreement)),
  );
}
