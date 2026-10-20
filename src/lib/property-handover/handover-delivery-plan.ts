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
import type { PropertyHandover, PropertyHandoverFileDeliveryState } from '@/types/property-handover';

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
 * **Το αποτύπωμα του καθολικού** — sha256 πάνω στις ταξινομημένες γραμμές `πηγή|αντίγραφο|crc32c|μέγεθος`. Ανεξάρτητο
 * σειράς εγγραφής· αλλάζει αν αλλάξει **οποιαδήποτε** γραμμή. Κανένα portal των μεγάλων δεν αποδεικνύει τι παρέδωσε —
 * εδώ το αποτύπωμα είναι αυτό που θα σφραγίσει το Πρωτόκολλο (Φ-Γ2). `null` ⇒ τίποτα δεν παραδόθηκε ακόμη.
 */
export async function handoverDeliveryDigest(rows: readonly HandoverDeliveredRow[]): Promise<string | null> {
  if (rows.length === 0) return null;
  const lines = rows.map((row) => `${row.sourceFileId}|${row.copyFileId}|${row.crc32c}|${row.size}`).sort();
  return sha256HexOfText(lines.join('\n'));
}
