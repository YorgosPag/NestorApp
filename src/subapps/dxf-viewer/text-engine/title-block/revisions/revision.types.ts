/**
 * ADR-651 Φάση Η — το μοντέλο της **αναθεώρησης σχεδίου** (Απόφαση #9).
 *
 * Επίπεδο: **ανά ΕΡΓΟ** (πρακτική Revit «Sheet Issues/Revisions»: ΜΙΑ λίστα αναθεωρήσεων
 * του έργου· η ίδια «1η Αναθεώρηση» τυπώνεται στην πινακίδα ΟΛΩΝ των φύλλων του σετ).
 * Απόφαση Giorgio 2026-07-14.
 *
 * Η αναθεώρηση είναι **ιστορικό γεγονός** — δεν παράγεται από την τρέχουσα κατάσταση (σε
 * αντίθεση με το sheet-set της Φάσης Ζ) ⇒ χρειάζεται persisted record (`drawing_revisions`).
 * Ο ίδιος ο πίνακας αναθεωρήσεων ΕΙΝΑΙ το ιστορικό: append-only, ποτέ update/delete — γι'
 * αυτό δεν εμπλέκεται το `entity_audit_trail` (ADR-195), που καταγράφει αλλαγές **πεδίων
 * οντοτήτων** και είναι άλλο επίπεδο (βλ. ADR-651 §5.7).
 *
 * Το **snapshot** κάθε αναθεώρησης είναι η πηγή του AI diff («τι άλλαξε»): συγκρίνεται η
 * τρέχουσα κατάσταση του σχεδίου με το snapshot της **προηγούμενης** έκδοσης.
 *
 * @see ./revision-snapshot.ts — ο (καθαρός) παραγωγός του snapshot
 * @see ./revision-diff.ts — η (καθαρή) σύγκριση δύο snapshots
 * @see ./revision-numbering.ts — η ντετερμινιστική αρίθμηση
 */

/** Το αποτύπωμα ενός φύλλου (ένας όροφος = ένα φύλλο, Φάση Ζ) τη στιγμή της αναθεώρησης. */
export interface RevisionSheetSnapshot {
  /** Το level του φύλλου — το σταθερό κλειδί ταύτισης μεταξύ δύο εκδόσεων. */
  readonly levelId: string;
  /** Ανθρώπινη ετικέτα (όνομα ορόφου) — για να μιλά το AI για «την κάτοψη ισογείου». */
  readonly title: string;
  readonly entityCount: number;
  /** Πλήθος οντοτήτων ανά τύπο — πάντα παρόν (φθηνό, ανθεκτικό fallback). */
  readonly countsByType: Readonly<Record<string, number>>;
  /**
   * Ανά οντότητα: `idHash:contentHash:type` (βλ. `revision-snapshot.ts`). Επιτρέπει
   * διάκριση **προστέθηκε / αφαιρέθηκε / τροποποιήθηκε** — χωρίς αυτό, μια μετακίνηση
   * πόρτας (ίδιο πλήθος) θα ήταν αόρατη και το AI θα έλεγε ψέματα.
   *
   * **Κενό** όταν το σχέδιο ξεπερνά το όριο μεγέθους (coarse mode — η σύγκριση πέφτει
   * στα `countsByType`). Το UI/AI το δηλώνει, δεν το κρύβει.
   */
  readonly signatures: readonly string[];
}

/** Το αποτύπωμα ΟΛΟΥ του σετ φύλλων τη στιγμή της αναθεώρησης. */
export interface RevisionSnapshot {
  readonly sheets: readonly RevisionSheetSnapshot[];
  /**
   * Ντετερμινιστικό αποτύπωμα ολόκληρου του σετ — το **κλειδί idempotency** (N.7.2 #3):
   * δύο κλικ «Νέα αναθεώρηση» χωρίς ενδιάμεση αλλαγή έχουν το ΙΔΙΟ digest ⇒ ο server
   * επιστρέφει την υπάρχουσα εγγραφή αντί να γράψει δεύτερη.
   */
  readonly digest: string;
}

/** Μια καταχωρημένη αναθεώρηση (wire + Firestore σχήμα· `issuedAt` = ISO, JSON-safe). */
export interface DrawingRevision {
  readonly id: string;
  readonly companyId: string;
  readonly projectId: string;
  /** 1, 2, 3… — ντετερμινιστικά από τη θέση στην ιστορία (`revision-numbering.ts`). */
  readonly number: number;
  readonly issuedAt: string;
  readonly authorId: string;
  readonly authorName: string;
  /** Η περιγραφή αλλαγής — **πάντα** εγκεκριμένη από τον χρήστη (AI πρόταση ή χειροκίνητη). */
  readonly description: string;
  readonly snapshot: RevisionSnapshot;
}

/**
 * Η αναθεώρηση **χωρίς** το αποτύπωμα — ό,τι ταξιδεύει στον client (πίνακας + πινακίδα).
 * Το snapshot μένει server-side: ζυγίζει ~260KB και ο client δεν το χρειάζεται ποτέ (τη
 * σύγκριση την κάνει ο server, που έχει ήδη και τις δύο πλευρές).
 */
export interface DrawingRevisionSummary {
  readonly id: string;
  readonly number: number;
  readonly issuedAt: string;
  readonly authorId: string;
  readonly authorName: string;
  readonly description: string;
}

/** Ό,τι στέλνει ο client για να καταχωρηθεί νέα αναθεώρηση. */
export interface CreateRevisionInput {
  readonly projectId: string;
  readonly description: string;
  readonly snapshot: RevisionSnapshot;
}

// ─── Diff (η πηγή του AI auto-changelog) ─────────────────────────────────────────────

/** Τι άλλαξε σε ΕΝΑ φύλλο, ανά τύπο οντότητας (`{ wall: 3, door: 1 }`). */
export interface RevisionSheetChange {
  readonly levelId: string;
  readonly title: string;
  readonly added: Readonly<Record<string, number>>;
  readonly removed: Readonly<Record<string, number>>;
  readonly modified: Readonly<Record<string, number>>;
  /** Το φύλλο δεν υπήρχε στην προηγούμενη έκδοση (νέος όροφος). */
  readonly isNew: boolean;
  /**
   * Η σύγκριση έγινε **μόνο σε πλήθη** (λείπουν signatures — coarse mode): τροποποιήσεις
   * επί τόπου δεν φαίνονται. Δηλώνεται ρητά ώστε το AI/UI να μη λέει ψέματα.
   */
  readonly coarse: boolean;
  readonly changed: boolean;
}

export interface RevisionDiff {
  readonly sheets: readonly RevisionSheetChange[];
  /** Φύλλα που υπήρχαν στην προηγούμενη έκδοση και **δεν υπάρχουν** πια (τίτλοι). */
  readonly removedSheets: readonly string[];
  /** Δεν υπάρχει προηγούμενη έκδοση ⇒ η 1η αναθεώρηση είναι η **αρχική έκδοση**. */
  readonly baseline: boolean;
  readonly hasChanges: boolean;
}
