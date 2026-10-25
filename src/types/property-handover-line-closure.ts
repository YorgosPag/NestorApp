/**
 * @fileoverview **Το κλείσιμο μιας γραμμής καθολικού χωρίς πλήρες αποτύπωμα** — το αρχείο **παραδόθηκε** (crc32c · μέγεθος ·
 *               χρόνος), αλλά τα bytes του χάθηκαν και από τις δύο πλευρές πριν μετρηθεί το sha256 (ADR-916 §5.23 Φ-Δ.7γ · Ο13β (i)).
 * @related lib/property-handover/handover-line-closure.ts (η ΜΙΑ κρίση: κουμπί ΚΑΙ πόρτα · η γραμμή του αποτυπώματος v3)
 * @module types/property-handover-line-closure
 *
 * Κλειστά λεξιλόγια — τα διαβάζουν η καθαρή κρίση, η πόρτα, ο πελάτης, το Πρωτόκολλο και τα κείμενα (`Record<…>` ⇒ πληρότητα).
 * 🔑 PREMIS «deaccession»: **γεγονός** με λόγο από κλειστό λεξιλόγιο, όχι διαγραφή. Η γραμμή μένει· ο λόγος δεν δηλώνεται από
 *    άνθρωπο αλλά **μετριέται** από τη μηχανή.
 */

/**
 * **Γιατί** δεν θα υπάρξει ποτέ sha256 — μόνο αιτίες που **δεν αναστρέφονται** (ADR-916 §5.23 αρχή 3):
 * - `bytes-gone`: αντίγραφο, πηγή **και** η soft-deleted γενιά μετρήθηκαν απόντα (το GCS τα έσβησε οριστικά).
 * - `source-unlocated`: η γραμμή δεν κατέγραψε τη θέση της πηγής (προγενέστερη της Φ-Δ.7β) και αντίγραφο και πηγή λείπουν.
 * ⚠️ Ο κωδικός τυπώνεται στο Πρωτόκολλο και μπαίνει στο αποτύπωμα v3 — **ποτέ** μετονομασία.
 */
export const HANDOVER_LINE_CLOSURE_CAUSES = ['bytes-gone', 'source-unlocated'] as const;
export type HandoverLineClosureCause = (typeof HANDOVER_LINE_CLOSURE_CAUSES)[number];

/** Το γεγονός, όπως το βλέπουν η κρίση και το Πρωτόκολλο — η αιτιολογία και ο άνθρωπος μένουν στον διακομιστή. */
export interface HandoverLineClosureMark {
  readonly cause: HandoverLineClosureCause;
  readonly closedAt: string;
}

/**
 * **Τι μέτρησε η μηχανή** για μια γραμμή χωρίς sha256, τώρα:
 * - `proven`: έχει ήδη sha256 · `closed`: έχει ήδη κλείσει.
 * - `provable`: ζωντανά bytes με το crc32c και το μέγεθος της γραμμής υπάρχουν — ο κατακερματισμός θα τα μετρήσει.
 * - `recovering`: η soft-deleted γενιά υπάρχει ακόμη, ή ανάκτηση είναι ανοιχτή — η Φ-Δ.7β δεν έχει τελειώσει.
 * - `lost`: οριστικά χαμένα, με την αιτία.
 */
export type HandoverLineEvidence =
  | { readonly kind: 'proven' | 'closed' | 'provable' | 'recovering' }
  | { readonly kind: 'lost'; readonly cause: HandoverLineClosureCause };

/** Γιατί **δεν** προσφέρεται το κλείσιμο — ο άνθρωπος βλέπει **ποιος** κανόνας το σταμάτησε. */
export const HANDOVER_LINE_CLOSURE_BLOCKS = ['not-owed', 'proven', 'closed', 'provable', 'recovering'] as const;
export type HandoverLineClosureBlock = (typeof HANDOVER_LINE_CLOSURE_BLOCKS)[number];

/** **Η προσφορά** για μια γραμμή — από την ΙΔΙΑ κρίση που εφαρμόζει η πόρτα. */
export type HandoverLineClosureOffer =
  | { readonly kind: 'close'; readonly cause: HandoverLineClosureCause }
  | { readonly kind: 'blocked'; readonly reason: HandoverLineClosureBlock };

/** Μία γραμμή χωρίς sha256 όπως τη βλέπει η καρτέλα «Παράδοση» — 🔒 χωρίς αιτιολογία ή uid. */
export interface HandoverUnprovenLine {
  readonly sourceFileId: string;
  /** Το όνομα της πηγής όπως το βλέπει το γραφείο — `null` αν η εγγραφή λείπει (το αναγνωριστικό αρκεί). */
  readonly name: string | null;
  readonly size: number;
  readonly deliveredAt: string | null;
  readonly offer: HandoverLineClosureOffer;
}

/** Το σώμα της πόρτας `POST /api/properties/[id]/handover/line-closure`. */
export interface HandoverLineClosureRequest {
  readonly handoverId: string;
  readonly sourceFileId: string;
  /** Υποχρεωτική αιτιολογία — ορατή **μόνο** στο γραφείο (ίχνος), ποτέ στο Πρωτόκολλο. */
  readonly reason: string;
  /** Μη αναστρέψιμο (DocuSign void) — ρητό `true`, ποτέ προεπιλογή. */
  readonly confirmIrreversible: true;
}

export const HANDOVER_LINE_CLOSURE_REFUSALS = ['line-unknown', ...HANDOVER_LINE_CLOSURE_BLOCKS] as const;
export type HandoverLineClosureRefusal = (typeof HANDOVER_LINE_CLOSURE_REFUSALS)[number];

/** Ο διακριτής του σώματος άρνησης — ο πελάτης τον ελέγχει **πριν** από τον λόγο. */
export const HANDOVER_LINE_CLOSURE_REFUSED = 'HANDOVER_LINE_CLOSURE_REFUSED';

/** Το συμβόλαιο της πόρτας — 🔒 ποτέ αιτιολογία, ποτέ uid. */
export type HandoverLineClosureResponse =
  | { readonly status: 'closed' | 'unchanged' }
  | { readonly error: typeof HANDOVER_LINE_CLOSURE_REFUSED; readonly reason: HandoverLineClosureRefusal }
  | { readonly error: 'LINE_CLOSURE_UNAVAILABLE' };
