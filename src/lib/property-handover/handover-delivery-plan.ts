/**
 * @fileoverview **Η ΚΡΙΣΗ ΤΗΣ ΑΝΤΙΓΡΑΦΗΣ** — «τι αντιγράφω τώρα;» (ADR-916 Φ-Γ1 · Π5 · Δ5).
 * @related services/property-handover/property-handover-set.server.ts (τα παραδοτέα) ·
 *          server/property-handover-delivery (ο εκτελεστής) · config/property-handover-delivery-policy.ts (ο προϋπολογισμός)
 * @module lib/property-handover/handover-delivery-plan
 *
 * 🔑 **Συμφιλίωση, όχι εργασία-γεγονός** (Π5): δεν υπάρχει ουρά να χαθεί. Κάθε εκτέλεση συγκρίνει τα **σημερινά**
 *    παραδοτέα με το **καθολικό** (ό,τι έχει ήδη παραδοθεί) και αντιγράφει ό,τι λείπει. Έτσι **ένας** κώδικας κάνει τρία
 *    πράγματα: πρώτη παράδοση · συνέχιση μετά από διακοπή · συμπληρώσεις (Δ5: νέο παραδοτέο μετά την παράδοση).
 * 🔑 **Νέα αναθεώρηση = νέο αντίγραφο** (ISO 19650: ο AIM δέχεται νέα αναθεώρηση, η παλιά μένει ιστορικό) — συνδεδεμένο
 *    με το αντίγραφο της προηγούμενης μέσω `revisionOfFileId`.
 * ⛔ **Τίποτα δεν αφαιρείται εδώ**: ό,τι παραδόθηκε μένει, ακόμη κι αν η πηγή σβήστηκε ή αντικαταστάθηκε (Δ5 · Δ8).
 *
 * **Layering**: leaf — καθαρές συναρτήσεις· το sha256 από το SSoT `lib/hash/sha256`.
 */

import { sha256HexOfText } from '@/lib/hash/sha256';
import { compareUtf8 } from '@/lib/string/byte-order';
import type { PropertyHandover, PropertyHandoverFileDeliveryState } from '@/types/property-handover';
import type { HandoverLineClosureCause } from '@/types/property-handover-line-closure';

/** Οι καταστάσεις που περιμένουν τον εκτελεστή — το ερώτημα του cron (ισότητα στο `fileDeliveryState`). */
export const HANDOVER_FILE_DELIVERY_QUEUE_STATES = ['pending', 'delivering'] as const satisfies readonly PropertyHandoverFileDeliveryState[];

/**
 * **Οφείλεται αντιγραφή;** `null` ⇒ όχι (η πώληση δεν ολοκληρώθηκε ή ο αγοραστής δεν αποδέχτηκε ακόμη — δεν υπάρχει
 * φάκελος-προορισμός). Η ΜΙΑ απάντηση: την αποθηκεύει ο σειριοποιητής ως `fileDeliveryState` (παράγωγο, ποτέ
 * χειρόγραφο) και τη ρωτούν ο γραφέας και το cron.
 */
export function fileDeliveryStateOf(
  handover: Pick<PropertyHandover, 'lifecycle' | 'recipient' | 'fileDelivery'>,
): PropertyHandoverFileDeliveryState | null {
  if (handover.lifecycle !== 'ready' || handover.recipient === null) return null;
  return handover.fileDelivery?.state ?? 'pending';
}

/**
 * **Οφείλει ακόμη η παράδοση στον ΙΔΙΟ παραλήπτη;** — ανακλημένη (Φ-Δ.5), ακυρωμένη ή αλλαγή χεριών ⇒ όχι. Η ΜΙΑ ερώτηση
 * που κάνουν μέσα στη συναλλαγή τους η αντιγραφή (Φ-Γ1) και το κλείσιμο γραμμής (Φ-Δ.7γ). `null` ⇒ η παράδοση δεν διαβάζεται.
 */
export function stillOwedToRecipient(
  handover: Pick<PropertyHandover, 'lifecycle' | 'recipient' | 'fileDelivery'> | null,
  recipientUserId: string,
): boolean {
  return handover !== null && fileDeliveryStateOf(handover) !== null && handover.recipient?.userId === recipientUserId;
}

/** Ένα παραδοτέο αρχείο σήμερα — ό,τι χρειάζεται η κρίση, τίποτα παραπάνω. */
export interface HandoverDeliverable {
  readonly sourceFileId: string;
}

/** Μία γραμμή του καθολικού — ό,τι **έχει** παραδοθεί. */
export interface HandoverDeliveredRow {
  readonly sourceFileId: string;
  readonly copyFileId: string;
  readonly crc32c: string;
  readonly size: number;
  /**
   * Φ-Γ2 Σ2 — το sha256 των bytes που παραδόθηκαν (64 hex). `null` ⇒ **εκκρεμεί κατακερματισμός**: η γραμμή γεννιέται
   * χωρίς αυτό (η αντιγραφή είναι rewrite μέσα στο Google, τα bytes δεν περνούν από εμάς) και το συμπληρώνει **μία**
   * φορά ο ίδιος εκτελεστής, με δικό του προϋπολογισμό bytes ({@link planHandoverHashing}).
   */
  readonly sha256: string | null;
}

export interface HandoverDeliveryPlanInput<T extends HandoverDeliverable> {
  readonly deliverable: readonly T[];
  readonly delivered: readonly HandoverDeliveredRow[];
  /** Νέα πηγή → η **παραδομένη** προηγούμενη αναθεώρησή της (ο εκτελεστής ακολουθεί την αλυσίδα `supersededByFileId`). */
  readonly predecessorOf: ReadonlyMap<string, string>;
  /** Πόσα αρχεία το πολύ σε αυτή την εκτέλεση. */
  readonly budget: number;
}

export interface PlannedHandoverCopy<T extends HandoverDeliverable> {
  readonly deliverable: T;
  /** Το **αντίγραφο** της προηγούμενης αναθεώρησης, αν παραδόθηκε — αλλιώς `null`. */
  readonly revisionOfFileId: string | null;
}

export interface HandoverDeliveryPlan<T extends HandoverDeliverable> {
  /** Τι αντιγράφεται **τώρα** — το πολύ `budget`, με σταθερή σειρά (`sourceFileId`). */
  readonly copies: readonly PlannedHandoverCopy<T>[];
  /** Όσα λείπουν **μετά** από αυτή την εκτέλεση, αν πετύχουν όλα. */
  readonly remaining: number;
  /** Όσα οφείλονται συνολικά: ό,τι παραδόθηκε **∪** ό,τι είναι παραδοτέο σήμερα (κατά πηγή). */
  readonly total: number;
}

/** **Το σχέδιο της εκτέλεσης.** Σταθερή σειρά ⇒ δύο εκτελέσεις με ίδια είσοδο αποφασίζουν το ίδιο. */
export function planHandoverDelivery<T extends HandoverDeliverable>(input: HandoverDeliveryPlanInput<T>): HandoverDeliveryPlan<T> {
  const copyOfSource = new Map(input.delivered.map((row) => [row.sourceFileId, row.copyFileId] as const));
  const missing = input.deliverable
    .filter((file) => !copyOfSource.has(file.sourceFileId))
    .sort((a, b) => a.sourceFileId.localeCompare(b.sourceFileId));
  const budget = Math.max(0, Math.floor(input.budget));
  const copies = missing.slice(0, budget).map((deliverable): PlannedHandoverCopy<T> => {
    const predecessor = input.predecessorOf.get(deliverable.sourceFileId);
    return { deliverable, revisionOfFileId: predecessor === undefined ? null : copyOfSource.get(predecessor) ?? null };
  });
  const owed = new Set([...copyOfSource.keys(), ...input.deliverable.map((file) => file.sourceFileId)]);
  return { copies, remaining: missing.length - copies.length, total: owed.size };
}

/**
 * Η **ετικέτα σχήματος** του αποτυπώματος — πρώτη γραμμή της εισόδου (domain separation). Ό,τι αλλάζει τη μορφή των
 * γραμμών αλλάζει **και** την ετικέτα, ώστε δύο σχήματα να μη δίνουν ποτέ το ίδιο αποτύπωμα. Το Πρωτόκολλο (Σ4) τη
 * δηλώνει μαζί με τις γραμμές, για να το ξαναϋπολογίσει ο τρίτος χωρίς εμάς.
 * v1 (Φ-Γ1): `πηγή|αντίγραφο|crc32c|μέγεθος`, χωρίς ετικέτα — καμία ζωντανή παράδοση δεν το κράτησε (0 γραμμές, 2026-10-22).
 */
export const HANDOVER_DELIVERY_DIGEST_SCHEME = 'nestor.handover-delivery.v2';

/**
 * Φ-Δ.7γ (ADR-916 §5.23) — η ετικέτα **όταν** ο πίνακας έχει γραμμές κλεισμένες χωρίς πλήρες αποτύπωμα. Το σχήμα το ορίζει
 * το **περιεχόμενο**, όχι ημερομηνία: χωρίς κλεισμένη γραμμή το αποτύπωμα μένει v2 **byte-προς-byte**, άρα καμία υπάρχουσα
 * παράδοση δεν γίνεται «due» για νέα αναθεώρηση και το παγωμένο κείμενο v1 μένει αληθές για κάθε πίνακα που περιγράφει.
 */
export const HANDOVER_DELIVERY_DIGEST_SCHEME_WITH_CLOSURES = 'nestor.handover-delivery.v3';

/** Η ετικέτα που αντιστοιχεί σε έναν πίνακα — η ΜΙΑ επιλογή για αποτύπωμα, manifest και επαλήθευση. */
export const handoverDeliveryDigestSchemeOf = (closedLines: number): string =>
  closedLines === 0 ? HANDOVER_DELIVERY_DIGEST_SCHEME : HANDOVER_DELIVERY_DIGEST_SCHEME_WITH_CLOSURES;

/** Τα πεδία μιας **κλεισμένης** γραμμής που δεσμεύει το αποτύπωμα v3 — το crc32c είναι η μόνη απόδειξη bytes που μένει. */
export interface HandoverClosedDigestLineFields extends Pick<HandoverDeliveredRow, 'sourceFileId' | 'copyFileId' | 'crc32c' | 'size'> {
  readonly cause: HandoverLineClosureCause;
}

/**
 * Η γραμμή μιας κλεισμένης — `C|πηγή|αντίγραφο|crc32c|μέγεθος|αιτία`. Το πρόθεμα `C|` τη χωρίζει από τις αποδεδειγμένες
 * (κανένα αναγνωριστικό αρχείου δεν είναι `C`), ώστε μια κλεισμένη γραμμή να μη διαβαστεί ποτέ ως αποδεδειγμένη.
 */
export const handoverClosedDigestLineOf = (row: HandoverClosedDigestLineFields): string =>
  `C|${row.sourceFileId}|${row.copyFileId}|${row.crc32c}|${row.size}|${row.cause}`;

/** Τα **τέσσερα** πεδία της γραμμής του αποτυπώματος — ό,τι χρειάζεται ο τρίτος, τίποτα παραπάνω (π.χ. όχι crc32c). */
export type HandoverDigestLineFields = Pick<HandoverDeliveredRow, 'sourceFileId' | 'copyFileId' | 'size'> & { readonly sha256: string };

/** Η γραμμή του αποτυπώματος — `πηγή|αντίγραφο|sha256|μέγεθος`. */
export const handoverDigestLineOf = (row: HandoverDigestLineFields): string =>
  `${row.sourceFileId}|${row.copyFileId}|${row.sha256}|${row.size}`;

/** Ό,τι διαβάζει το αποτύπωμα από μια γραμμή — με sha256 ή χωρίς (τότε το αποτύπωμα είναι `null`). */
type HandoverDigestInput = Omit<HandoverDigestLineFields, 'sha256'> & { readonly sha256: string | null };

const isHashed = <R extends HandoverDigestInput>(row: R): row is R & { readonly sha256: string } => row.sha256 !== null;

/**
 * **Το αποτύπωμα του καθολικού (v2)** — sha256 πάνω στην ετικέτα σχήματος + τις ταξινομημένες γραμμές. Ανεξάρτητο σειράς
 * εγγραφής· αλλάζει αν αλλάξει **οποιαδήποτε** γραμμή, και αφού κάθε γραμμή κρατά το sha256 του αρχείου της, αλλάζει με
 * **οποιοδήποτε byte** οποιουδήποτε παραδομένου αρχείου. Αυτό σφραγίζει το Πρωτόκολλο (Σ4).
 * `null` ⇒ τίποτα δεν παραδόθηκε **ή** κάποια γραμμή περιμένει κατακερματισμό: αποτύπωμα που δεν καλύπτει κάθε byte δεν
 * εκδίδεται ποτέ — άρα ούτε Πρωτόκολλο.
 * 🔑 **Ταξινόμηση κατά bytes UTF-8** (Σ4), όπως το λέει αυτολεξεί το παγωμένο κείμενο (`handover-protocol` v1, βήμα 3):
 *    ποτέ `.sort()` (σειρά UTF-16). Για ASCII οι δύο ταυτίζονται ⇒ κανένα υπάρχον αποτύπωμα δεν άλλαξε.
 */
export async function handoverDeliveryDigest(
  rows: readonly HandoverDigestInput[],
  closed: readonly HandoverClosedDigestLineFields[] = [],
): Promise<string | null> {
  const hashed = rows.filter(isHashed);
  if (rows.length + closed.length === 0 || hashed.length < rows.length) return null;
  // Φ-Δ.7γ — μία ταξινόμηση κατά bytes πάνω σε ΟΛΕΣ τις γραμμές· χωρίς κλεισμένες είναι ακριβώς η v2.
  const lines = [...hashed.map(handoverDigestLineOf), ...closed.map(handoverClosedDigestLineOf)].sort(compareUtf8);
  return sha256HexOfText([handoverDeliveryDigestSchemeOf(closed.length), ...lines].join('\n'));
}

/** **Οι γραμμές με τη σειρά του αποτυπώματος** — η ΜΙΑ σειρά για το digest **και** για τον πίνακα του Πρωτοκόλλου (Σ4). */
export function inHandoverDigestOrder<R extends HandoverDigestLineFields>(rows: readonly R[]): readonly R[] {
  return [...rows].sort((a, b) => compareUtf8(handoverDigestLineOf(a), handoverDigestLineOf(b)));
}

/** Φ-Δ.7γ — οι κλεισμένες γραμμές με τη σειρά **τους** (κατά bytes της γραμμής v3): ο δεύτερος πίνακας του Πρωτοκόλλου. */
export function inHandoverClosedOrder<R extends HandoverClosedDigestLineFields>(rows: readonly R[]): readonly R[] {
  return [...rows].sort((a, b) => compareUtf8(handoverClosedDigestLineOf(a), handoverClosedDigestLineOf(b)));
}

export interface HandoverHashingPlan<R extends HandoverDeliveredRow> {
  /** Τι κατακερματίζεται **τώρα** — σταθερή σειρά (`sourceFileId`). */
  readonly hash: readonly R[];
  /** Όσες γραμμές μένουν χωρίς sha256 **μετά** από αυτή την εκτέλεση, αν πετύχουν όλες. */
  readonly remaining: number;
}

/**
 * **Ποιες γραμμές κατακερματίζονται τώρα.** Προϋπολογισμός σε **bytes** (το κόστος είναι η ανάγνωση, όχι το πλήθος): όσες
 * χωρούν με σταθερή σειρά — και **τουλάχιστον μία** όταν ο προϋπολογισμός είναι θετικός, ώστε ένα αρχείο μεγαλύτερο από
 * τον προϋπολογισμό να μη μένει για πάντα πίσω. Γραμμή με sha256 δεν ξαναμετριέται ποτέ.
 */
export function planHandoverHashing<R extends HandoverDeliveredRow>(rows: readonly R[], byteBudget: number): HandoverHashingPlan<R> {
  const pending = rows.filter((row) => !isHashed(row)).sort((a, b) => a.sourceFileId.localeCompare(b.sourceFileId));
  const hash: R[] = [];
  let bytes = 0;
  for (const row of pending) {
    if (byteBudget <= 0 || (hash.length > 0 && bytes + row.size > byteBudget)) break;
    hash.push(row);
    bytes += row.size;
  }
  return { hash, remaining: pending.length - hash.length };
}
