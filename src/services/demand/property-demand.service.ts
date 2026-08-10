/**
 * @fileoverview **Η ΠΥΛΗ ΓΡΑΦΗΣ ΤΗΣ ΖΗΤΗΣΗΣ** — η μόνη διαδρομή προς το `property_demands`.
 * @related ADR-777 §7 (Α9 · Α12) · SPEC-777B §12.2 · CLAUDE.md N.6
 * @module services/demand/property-demand.service
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΡΙΑ ΠΡΑΓΜΑΤΑ ΠΟΥ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ ΔΕΝ ΕΠΙΤΡΕΠΕΤΑΙ ΝΑ ΚΑΝΕΙ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * 1. **`addDoc` — ΠΟΤΕ** (N.6, και το μπλοκάρει το pre-commit). Η ταυτότητα έρχεται
 *    από το `enterpriseIdService.generatePropertyDemandId()` (`dmnd_*`) και γράφεται
 *    με `setDoc`. Μια αυτόματη ταυτότητα Firestore δεν λέει **τι** είναι το έγγραφο,
 *    και το repo έχει 60+ γεννήτριες ακριβώς γι' αυτό.
 * 2. **Διαγραφή — ΠΟΤΕ.** Ο κανόνας το κάνει δομικά αδύνατο (`allow delete: if false`)
 *    και εδώ δεν υπάρχει καν συνάρτηση. Η απόσυρση είναι `lifecycle: 'withdrawn'`:
 *    *«μια σβησμένη ζήτηση δεν μπορεί να αποδείξει ότι μετρήθηκε ποτέ σωστά στο
 *    άθροισμα — και το άθροισμα είναι προϊόν που πουλάμε»* (Ε2).
 * 3. **Αλλαγή `authorUserId` — ΠΟΤΕ.** Το επιβάλλει ο κανόνας· εδώ το επιβάλλει και
 *    ο **τύπος**, ώστε η αποτυχία να είναι στη μεταγλώττιση και όχι στο δίκτυο.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΓΙΑΤΙ ΤΟ `affirmedAt` ΕΧΕΙ ΔΙΚΗ ΤΟΥ ΣΥΝΑΡΤΗΣΗ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Θα ήταν ένα πεδίο παραπάνω στο {@link updateDemand}. Και θα ήταν **λάθος**: το
 * `updatedAt` αλλάζει *«και όταν ο μεσίτης διορθώσει ένα τηλέφωνο»*, ενώ το
 * `affirmedAt` αλλάζει **μόνο** όταν κάποιος επιβεβαιώσει την **πρόθεση**. Αν τα δύο
 * γράφονταν μαζί, **κάθε** διοικητική αλλαγή θα «φρέσκαρε» μια νεκρή ζήτηση — και ο
 * θερμοχάρτης του Ε2 θα μετρούσε **ανθρώπους που έχουν φύγει**. Δύο ερωτήσεις, δύο
 * πεδία, **δύο πράξεις**.
 *
 * ⚠️ Το αντίστροφο επίσης ισχύει: το «ψάχνω ακόμη» **δεν** αγγίζει το `updatedAt`, για
 * τον ίδιο λόγο ανάποδα — δεν άλλαξε τίποτα στο περιεχόμενο.
 */

import { doc, setDoc, updateDoc } from 'firebase/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { db } from '@/lib/firebase';
import { nowISO } from '@/lib/date-local';
import { createModuleLogger } from '@/lib/telemetry';
import { enterpriseIdService } from '@/services/enterprise-id.service';
import {
  demandInvariantViolations,
  type DemandInvariant,
  type DemandLifecycle,
  type PropertyDemand,
} from '@/types/property-demand';
import type { DemandDraft } from '@/lib/demand/demand-form-values';

const logger = createModuleLogger('property-demand.service');

// =============================================================================
// 1. ΤΟ ΑΠΟΤΕΛΕΣΜΑ — ρητές καταστάσεις, ποτέ εξαίρεση ως ροή ελέγχου
// =============================================================================

/**
 * Τι έγινε.
 *
 * 🔑 **Το `invalid` είναι ΞΕΧΩΡΙΣΤΟ από το `failed`, και δεν είναι λεπτολογία.** Το
 * πρώτο σημαίνει *«η ζήτησή σου λέει κάτι αντιφατικό»* — ο άνθρωπος μπορεί να το
 * διορθώσει, και ξέρουμε **ακριβώς ποιο** πεδίο (οι κωδικοί γίνονται κλειδιά i18n,
 * N.11). Το δεύτερο σημαίνει *«δεν φτάσαμε στον διακομιστή»* — δεν έχει τι να
 * διορθώσει, πρέπει να ξαναδοκιμάσει. Ένα κοινό «κάτι πήγε στραβά» θα τον έστελνε να
 * αλλάξει κείμενο που ήταν ήδη σωστό. Ίδιο ιδίωμα με το `SubmitState` του
 * `PlaceSearchBox` και το `PublicListingLookup`.
 */
export type DemandWriteResult =
  | { readonly kind: 'saved'; readonly demand: PropertyDemand }
  | { readonly kind: 'invalid'; readonly violations: readonly DemandInvariant[] }
  | { readonly kind: 'failed'; readonly message: string };

/** Ποιος γράφει, και **για λογαριασμό ποιου**. */
export interface DemandAuthorship {
  /** Το uid που γράφει. **Αμετάβλητο** μετά τη δημιουργία (κανόνας + τύπος). */
  readonly authorUserId: string;
  /** Η εταιρεία υπό την οποία ενήργησε, ή `null` για ιδιώτη. **Απόδοση, όχι απομόνωση.** */
  readonly authorCompanyId: string | null;
  /** Ποιανού είναι — `self` για τον ιδιώτη, `brokered` για τον μεσίτη. */
  readonly mandate: PropertyDemand['mandate'];
}

// =============================================================================
// 2. ΔΗΜΙΟΥΡΓΙΑ
// =============================================================================

/**
 * **Νέα ανοιχτή εντολή στην αγορά.**
 *
 * 🔴 **Η εγκυρότητα κρίνεται ΕΔΩ, πριν το δίκτυο** — και από την **ίδια** συνάρτηση
 * που κρίνει η φόρμα ({@link demandInvariantViolations}). Δεν είναι διπλός έλεγχος:
 * είναι **ο ίδιος** έλεγχος σε δύο σημεία, που είναι το ακριβώς αντίθετο από δύο
 * ελέγχους. Η φόρμα τον τρέχει για να **δείξει** το σφάλμα· η πύλη τον τρέχει γιατί
 * **δεν εμπιστεύεται καμία φόρμα** — και οι κανόνες Firestore δεν μπορούν να
 * εκφράσουν «το κάτω πάνω από το πάνω».
 *
 * ⚠️ **Το `affirmedAt` ξεκινά ίσο με το `createdAt`**, και είναι σωστό: η στιγμή που
 * το έγραψες **είναι** η τελευταία φορά που είπες «ψάχνω». Ένα `null` εδώ θα έκανε
 * κάθε νέα ζήτηση να μετρά ως «μπαγιάτικη» στο άθροισμα από το πρώτο δευτερόλεπτο.
 */
export async function createDemand(
  draft: DemandDraft,
  authorship: DemandAuthorship,
): Promise<DemandWriteResult> {
  const violations = demandInvariantViolations(draft);
  if (violations.length > 0) return { kind: 'invalid', violations };

  const now = nowISO();
  const demand: PropertyDemand = {
    id: enterpriseIdService.generatePropertyDemandId(),
    authorUserId: authorship.authorUserId,
    authorCompanyId: authorship.authorCompanyId,
    mandate: authorship.mandate,
    ...draft,
    lifecycle: 'active',
    affirmedAt: now,
    createdAt: now,
    updatedAt: now,
  };

  try {
    await setDoc(doc(db, COLLECTIONS.PROPERTY_DEMANDS, demand.id), demand);
    return { kind: 'saved', demand };
  } catch (error) {
    return failure('Η ζήτηση δεν αποθηκεύτηκε', { demandId: demand.id }, error);
  }
}

// =============================================================================
// 3. ΕΠΕΞΕΡΓΑΣΙΑ
// =============================================================================

/**
 * **Αλλαγή κριτηρίων** σε υπάρχουσα εντολή.
 *
 * ⚠️ Δέχεται {@link DemandDraft}, δηλαδή **μόνο** τους άξονες. Ο κάτοχος, η ταυτότητα
 * και ο κύκλος ζωής **δεν είναι στον τύπο**, άρα δεν μπορούν να σταλούν κατά λάθος —
 * η ίδια άμυνα με τον κανόνα Firestore, αλλά στη μεταγλώττιση.
 */
export async function updateDemand(
  demandId: string,
  draft: DemandDraft,
): Promise<DemandEditResult> {
  const violations = demandInvariantViolations(draft);
  if (violations.length > 0) return { kind: 'invalid', violations };

  try {
    await updateDoc(doc(db, COLLECTIONS.PROPERTY_DEMANDS, demandId), {
      ...draft,
      updatedAt: nowISO(),
    });
    // ⚠️ **Δεν επιστρέφεται έγγραφο, επίτηδες.** Το `updateDoc` δεν διαβάζει πίσω, και
    // μια ανασύνθεση εδώ («ό,τι έστειλα + ό,τι είχα») θα ήταν **δεύτερο αντίγραφο της
    // αλήθειας** που μπορεί να αποκλίνει από τον διακομιστή. Η οθόνη διαβάζει
    // ζωντανά (`useMyDemand`) — μία πηγή, όχι δύο.
    return { kind: 'done' };
  } catch (error) {
    return failure('Η ζήτηση δεν ενημερώθηκε', { demandId }, error);
  }
}

// =============================================================================
// 4. «ΨΑΧΝΩ ΑΚΟΜΗ» — η φρεσκάδα, και ΜΟΝΟ αυτή
// =============================================================================

/**
 * Τι έγινε σε μια πράξη που **δεν επιστρέφει έγγραφο**.
 *
 * 🔑 Ξεχωριστός τύπος από το {@link DemandWriteResult} επειδή **δεν υπάρχει
 * `invalid`**: το «ψάχνω ακόμη» και η αλλαγή κύκλου ζωής δεν μπορούν να παραβιάσουν
 * invariant — δεν αγγίζουν κανέναν άξονα. Ένα `invalid` που **δεν μπορεί να συμβεί**
 * θα ήταν κατάσταση χωρίς απόδειξη ζωής (ADR-749 §5), και η οθόνη θα έγραφε χειρισμό
 * που κανείς δεν εκτελεί ποτέ.
 */
export type DemandTouchResult =
  | { readonly kind: 'done' }
  | { readonly kind: 'failed'; readonly message: string };

/**
 * Η επεξεργασία: **σαν** την πράξη αφής, **συν** το `invalid`.
 *
 * ⚠️ Σύνθεση αντί για τέταρτη ένωση γραμμένη στο χέρι — αλλιώς η προσθήκη κατάστασης
 * στο {@link DemandTouchResult} θα ξεχνιόταν εδώ, σιωπηλά.
 */
export type DemandEditResult =
  | DemandTouchResult
  | { readonly kind: 'invalid'; readonly violations: readonly DemandInvariant[] };

/**
 * **«Ψάχνω ακόμη».** Η μοναδική πράξη που αγγίζει το `affirmedAt`.
 *
 * Μετά από {@link DEMAND_AFFIRMATION_TTL_DAYS} ημέρες σιωπής η ζήτηση βγαίνει από το
 * **ανώνυμο άθροισμα** — και **μόνο** από εκεί. Δεν σβήνεται, δεν κρύβεται από τον
 * κάτοχό της, και **ξαναμπαίνει με αυτό το ένα κλικ**.
 */
export async function affirmDemand(demandId: string): Promise<DemandTouchResult> {
  try {
    // ⚠️ **ΜΟΝΟ** το `affirmedAt`. Γράφοντας και `updatedAt` θα λέγαμε ότι άλλαξε το
    // περιεχόμενο — δεν άλλαξε· άλλαξε ο **ισχυρισμός** ότι κάποιος ακόμη ψάχνει.
    await updateDoc(doc(db, COLLECTIONS.PROPERTY_DEMANDS, demandId), { affirmedAt: nowISO() });
    return { kind: 'done' };
  } catch (error) {
    return touchFailure('Η επιβεβαίωση δεν καταγράφηκε', demandId, error);
  }
}

/**
 * **Αλλαγή κύκλου ζωής** — απόσυρση, παύση, «το βρήκα».
 *
 * ⚠️ Δεν υπάρχει `expired`, και δεν μπορεί να σταλεί: ο τύπος {@link DemandLifecycle}
 * δεν το περιέχει. Η **Ζ3** («όποτε κι αν βγει») απαγορεύει τη λήξη — η παλαίωση
 * εκφράζεται ως **φρεσκάδα**, που είναι αναστρέψιμη με ένα κλικ, και αυτό είναι
 * διαφορετικό πράγμα από κατάσταση κύκλου ζωής.
 */
export async function setDemandLifecycle(
  demandId: string,
  lifecycle: DemandLifecycle,
): Promise<DemandTouchResult> {
  try {
    await updateDoc(doc(db, COLLECTIONS.PROPERTY_DEMANDS, demandId), {
      lifecycle,
      updatedAt: nowISO(),
    });
    return { kind: 'done' };
  } catch (error) {
    return touchFailure('Η κατάσταση της ζήτησης δεν άλλαξε', demandId, error);
  }
}

// =============================================================================
// 5. ΑΣΤΟΧΙΑ — μία διατύπωση, ώστε το μήνυμα να μη γράφεται τέσσερις φορές
// =============================================================================

/** Το μήνυμα ενός `unknown` σφάλματος, χωρίς `as any`. */
function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function failure(
  what: string,
  data: Record<string, string>,
  error: unknown,
): { readonly kind: 'failed'; readonly message: string } {
  const message = messageOf(error);
  logger.error(what, { data, error: message });
  return { kind: 'failed', message };
}

function touchFailure(what: string, demandId: string, error: unknown): DemandTouchResult {
  return failure(what, { demandId }, error);
}
