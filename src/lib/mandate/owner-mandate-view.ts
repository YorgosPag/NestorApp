/**
 * @fileoverview **Η ΑΚΜΗ, ΟΠΩΣ ΤΗ ΒΛΕΠΕΙ Ο ΙΔΙΟΚΤΗΤΗΣ** — η ίδια σχέση, η άλλη οπτική.
 * @related ADR-834 §5 · lib/mandate/mandate-standing.ts (ο ΕΝΑΣ ταξινομητής)
 * @module lib/mandate/owner-mandate-view
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ ΕΛΑΤΤΩΜΑ: Η ΣΧΕΣΗ ΔΕΝ ΕΛΕΙΠΕ — ΕΛΕΙΠΕ Η ΟΘΟΝΗ ΤΗΣ ΜΙΑΣ ΠΛΕΥΡΑΣ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το `owner_properties/{id}` **κουβαλά ολόκληρη** την εντολή και **ταξιδεύει ήδη στον
 * φυλλομετρητή του ιδιώτη** (`useMyOwnerProperty`): γραφείο, είδος συμφωνίας, αμοιβή,
 * λήξη, απόδειξη συγκατάθεσης. Μετρημένο 2026-08-30: `grep mandatesOf` σε
 * `components/owner-property` + `components/demand` + `components/private-space` ⇒
 * **μηδέν αποτελέσματα**. Ο άνθρωπος **κατείχε** τη σύμβασή του και **καμία γραμμή δεν
 * του τη ζωγράφιζε**.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🏆 ΜΙΑ ΑΚΜΗ, ΔΥΟ ΟΠΤΙΚΕΣ — ΚΑΙ Ο ΤΑΞΙΝΟΜΗΤΗΣ ΕΙΝΑΙ **Ο ΙΔΙΟΣ**
 * ────────────────────────────────────────────────────────────────────────────
 *
 * ⛔ **ΔΕΝ γράφεται δεύτερος ταξινομητής.** Το {@link mandateStandingOf} απαντά ήδη
 * *«πού στέκεται αυτή η εντολή;»* και το κάνει για τον **κατάλογο του γραφείου**.
 * Η ερώτηση είναι **η ίδια**· αλλάζει **ποιος ρωτά**, άρα αλλάζουν μόνο τα **κείμενα**
 * (`owner-mandate-labels.ts`). Ένας δεύτερος ταξινομητής θα σήμαινε ότι η οθόνη του
 * ιδιοκτήτη μπορεί να πει *«ισχύει»* ενώ του γραφείου λέει *«έληξε»* — για το **ίδιο**
 * έγγραφο, την **ίδια** στιγμή (ADR-749 §5).
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ⛔ ΓΙΑΤΙ **ΔΕΝ** ΕΙΝΑΙ ΤΟ `occupancyNotice` — ΜΕΤΡΗΘΗΚΕ ΠΡΙΝ ΓΡΑΦΤΕΙ ΓΡΑΜΜΗ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το `mandate-occupancy-notice.ts` δείχνει **ήδη** κατάληψη στον ιδιοκτήτη, οπότε ο
 * πρώτος έλεγχος ήταν *«μήπως φτάνει;»*. **Δεν φτάνει, για τέσσερις λόγους:**
 *
 * | # | Τι λείπει / τι διαφέρει |
 * |---|---|
 * | 1 | Το `MandateOccupancy` έχει **πέντε** πεδία και **δεν** κουβαλά την **αμοιβή** — τον εμπορικό όρο που το ADR-827 Α4/Α5 (μάθημα $418M) απαιτεί να είναι ορατός |
 * | 2 | Ούτε την **απόδειξη** (`proof` · `confirmation` · `decidedAt`) — δηλαδή *«πώς προκύπτει ότι συμφώνησα;»* |
 * | 3 | Απαντά **άλλο ερώτημα**: *«χωράει ένας **ΝΕΟΣ** υποψήφιος;»* — οι εκβάσεις του είναι `clear/conflicts/undetermined`. Ο ιδιοκτήτης ρωτά *«τι **ισχύει**;»* |
 * | 4 | 🔴 Φιλτράρει `bindingMandates` + **μη ληγμένες** ⇒ όποιος έχει εντολή που **έληξε χθες** ή που το γραφείο **δήλωσε και εκείνος δεν επιβεβαίωσε** βλέπει `free`, δηλαδή **τίποτα** — ακριβώς όταν η αλήθεια είναι *«υπήρξε κάτι, και να τι απέγινε»* |
 *
 * ⇒ Εκείνο μένει **ακέραιο** για τη δουλειά του (πριν ζητήσεις, για **ξένες** εντολές,
 * φιλτραρισμένο για ιδιωτικότητα). Αυτό εδώ είναι **η δική σου σύμβαση, πλήρης**.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΓΡΑΜΜΕΝΟ ΓΙΑ ΤΗΝ **ΕΠΟΜΕΝΗ** ΠΡΑΞΗ, ΟΧΙ ΓΙΑ ΤΗΝ ΕΝΤΟΛΗ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η προβολή ρωτά *«ποια **πράξη** · ποια **δύο άκρα** · ποιος **ρόλος** · ποια
 * **περίοδος** · ποια **απόδειξη**»* — ποτέ *«ποια εντολή»*. Όταν έρθει η ανάθεση
 * ρύθμισης αυθαιρέτου ή η προσφορά κουφωμάτων, μπαίνει **χωρίς νέα μηχανή**: αλλάζει
 * ο ρόλος και το λεξιλόγιο, όχι η προβολή.
 *
 * **Layering**: leaf — καθαρές συναρτήσεις, κανένα ρολόι μέσα, καμία Firestore, καμία
 * ανάγνωση επωνυμίας *(εκείνη περνιέται από τον καλούντα — ίδιο ιδίωμα με το
 * `listingAuthorshipOf` / `agencyName` του `owner-property-projection.ts`)*.
 */

import {
  daysUntilExpiry,
  groupOfStanding,
  mandateStandingOf,
  CLOSED,
  type MandateStanding,
  type MandateStandingGroup,
} from '@/lib/mandate/mandate-standing';
import {
  mandatesOf,
  type BrokeredListingMandate,
  type MandateCompensation,
  type MandateProofVia,
  type OwnerPropertyMandate,
} from '@/types/owner-property-mandate';
import type { ListingAgreement } from '@/types/listing-agreement';
import type { OfferKind } from '@/types/property-offers';

/**
 * **Μία ακμή, όπως τη διαβάζει ο ιδιοκτήτης.**
 *
 * ⚠️ **Τα τέσσερα `| null` ΔΕΝ είναι αμυντικότητα — είναι το ΣΧΗΜΑ ΤΗΣ ΖΩΝΤΑΝΗΣ ΒΑΣΗΣ.**
 * Το μοναδικό έγγραφο εντολής που υπάρχει σήμερα γράφτηκε **πριν** το ADR-832 και δεν
 * έχει `agencyCompanyId`, `scope`, `startsAt`. Ο τύπος `BrokeredListingMandate` τα
 * δηλώνει **υποχρεωτικά** — δηλαδή **λέει ψέματα** γι' αυτό το έγγραφο. Η προβολή
 * είναι το σημείο όπου το ψέμα σταματά: ό,τι λείπει γίνεται `null` **με όνομα**, και η
 * οθόνη λέει *«δεν το ξέρω»* αντί να ζωγραφίσει `undefined`.
 */
export interface OwnerMandateView {
  /** `null` = **δεν ξέρουμε ποιο γραφείο** (έγγραφο προ-ADR-832), ποτέ «κανένα». */
  readonly agencyCompanyId: string | null;
  /** 🔑 Ο **ΕΝΑΣ** ταξινομητής, κοινός με τον κατάλογο του γραφείου. */
  readonly standing: MandateStanding;
  readonly group: MandateStandingGroup;
  /** `null` = δεν δηλώθηκε είδος συμφωνίας (κληροδότημα προ-Φάσης Α). */
  readonly agreement: ListingAgreement | null;
  readonly compensation: MandateCompensation;
  /** Οι **πράξεις** που ανατέθηκαν. Κενό = δεν δηλώθηκαν, ποτέ «όλες». */
  readonly scope: readonly OfferKind[];
  readonly startsAt: string | null;
  readonly expiresAt: string;
  /** `null` όταν η λήξη πέρασε ή δεν διαβάζεται — τότε το λέει η `standing`. */
  readonly daysLeft: number | null;
  /** **Πώς προκύπτει η συμφωνία** — η απόδειξη, ποτέ κρυμμένη από τον εντολέα. */
  readonly proofVia: MandateProofVia;
  readonly decidedAt: string | null;
}

/**
 * **Η μία εντολή → η μία προβολή.**
 *
 * @param nowISOValue — η **περασμένη** στιγμή· κανένα ρολόι εδώ μέσα, ώστε όλες οι
 *   γραμμές να κριθούν με **ένα** ρολόι (ίδιος κανόνας με τον κατάλογο).
 */
export function ownerMandateViewOf(
  mandate: BrokeredListingMandate,
  nowISOValue: string,
): OwnerMandateView {
  const standing = mandateStandingOf(mandate, nowISOValue);

  return {
    agencyCompanyId: emptyToNull(mandate.agencyCompanyId),
    standing,
    group: groupOfStanding(standing),
    agreement: mandate.agreement ?? null,
    compensation: mandate.compensation,
    scope: mandate.scope ?? [],
    startsAt: emptyToNull(mandate.startsAt),
    expiresAt: mandate.expiresAt,
    daysLeft: daysUntilExpiry(mandate, nowISOValue),
    proofVia: mandate.proof.via,
    decidedAt: mandate.decidedAt,
  };
}

/** Κενό **και** απόν σημαίνουν το ίδιο: *«δεν το ξέρω»* — ποτέ δύο σκέλη γι' αυτό. */
function emptyToNull(value: string | undefined | null): string | null {
  const trimmed = (value ?? '').trim();
  return trimmed === '' ? null : trimmed;
}

/**
 * **Όλες οι σχέσεις αυτής της αγγελίας, με τη σειρά που τις χρειάζεται ο ιδιοκτήτης.**
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ **ΟΧΙ** `bindingMandates`, ΚΑΙ ΕΙΝΑΙ ΤΟ ΣΗΜΑΝΤΙΚΟΤΕΡΟ ΤΟΥ ΑΡΧΕΙΟΥ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το `bindingMandates` κόβει ό,τι **δεν είναι αποδοτέο** — δηλαδή τη μη επιβεβαιωμένη
 * και την ανακληθείσα. Σωστό για τον κριτή σύγκρουσης· **καταστροφικό εδώ**:
 *
 * > Η εντολή που ένα γραφείο **δήλωσε** (`agency-attestation`) και ο ιδιοκτήτης
 * > **δεν επιβεβαίωσε ποτέ** είναι ακριβώς αυτή που **οφείλει** να δει — είναι το
 * > μοναδικό σημείο όπου μπορεί να πει «όχι».
 *
 * Ένα φίλτρο εδώ θα έκρυβε από τον άνθρωπο τη σχέση που **δεν ξεκίνησε ο ίδιος**.
 *
 * 🔑 **Η σειρά είναι ΠΑΡΑΓΩΓΗ, όχι δεύτερη λίστα**: ό,τι **δεν** έχει κλείσει
 * ({@link groupOfStanding} ≠ `closed`) προηγείται, και μέσα σε κάθε ομάδα ταξινομεί η
 * **λήξη**. Ένας δικός μας πίνακας βαρών θα ήταν δεύτερη αυθεντία που αποκλίνει με την
 * πρώτη προσθήκη κατάστασης (το σχήμα των δύο λιστών namespace της CHECK 3.34).
 */
export function ownerMandateViews(
  source: {
    readonly mandates?: readonly BrokeredListingMandate[];
    readonly mandate?: OwnerPropertyMandate;
  },
  nowISOValue: string,
): readonly OwnerMandateView[] {
  // ⚠️ **`mandatesOf`, ΠΟΤΕ ωμό `.mandates`**: τα έγγραφα ιδιώτη της ζωντανής βάσης
  //    έχουν τον **ενικό** `mandate`, και σκέτο `.length` πάνω τους ρίχνει τη σελίδα.
  return [...mandatesOf(source)]
    .map((mandate) => ownerMandateViewOf(mandate, nowISOValue))
    .sort(byUrgencyThenExpiry);
}

function byUrgencyThenExpiry(a: OwnerMandateView, b: OwnerMandateView): number {
  const aClosed = a.group === CLOSED;
  const bClosed = b.group === CLOSED;
  if (aClosed !== bClosed) return aClosed ? 1 : -1;

  const left = Date.parse(a.expiresAt);
  const right = Date.parse(b.expiresAt);
  // ⚠️ Μη αναγνώσιμη λήξη πάει **τελευταία μέσα στην ομάδα της**, ποτέ πρώτη: μια
  //    χαλασμένη ημερομηνία δεν είναι επείγον, είναι άγνωστο.
  if (Number.isNaN(left)) return Number.isNaN(right) ? 0 : 1;
  if (Number.isNaN(right)) return -1;

  // Μέσα στις ανοιχτές: **ό,τι λήγει νωρίτερα πρώτο**. Μέσα στις κλειστές το ίδιο —
  // η πιο πρόσφατη λήξη είναι η τελευταία γραμμή, δηλαδή η πιο «πρόσφατη ιστορία».
  return left - right;
}
