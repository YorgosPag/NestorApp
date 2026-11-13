/**
 * Ο **κοινός πυρήνας της μνήμης του προμηθευτή** (ADR-923 §5.5.2 Β5 · Β10) — καθαρός, ίδιος για τη μνήμη **γραμμών** (ετικέτα → ιδιότητα)
 * και τη μνήμη **τιμών** (κείμενο προμηθευτή → τιμή). Ένας κανόνας για ετυμηγορία, μάθηση και προέλευση, ώστε οι δύο να μη διαφωνήσουν ποτέ
 * στο τι σημαίνει «σύγκρουση» ή «N εγκρίσεις».
 *
 * 🔑 **Σύγκρουση ⇒ τίποτα**: δύο διαφορετικές αποφάσεις στο ιστορικό ενός κλειδιού ⇒ καμία αυτόματη εφαρμογή. Η διόρθωση **δεν** σβήνει
 *    το παλιό ζεύγος (Akeneo), άρα η διόρθωση του ανθρώπου γυρίζει το κλειδί σε «ρώτα με».
 * 🔑 **Μετρά εγκρίσεις**, όχι κλικ: +1 μόνο στην έγκριση (Rossum: εμπιστοσύνη από το ιστορικό του ίδιου προμηθευτή).
 * @module subapps/catalog/import/supplier-memory-core
 */

import type { ImportMemoryOrigin, ImportMemoryRecord } from '../types/catalog-import';
import { IMPORT_LABEL_MEMORY_MAX_DECISIONS } from '../vocabulary/catalog-import';

/** Ένα έγγραφο μνήμης με το id του (ντετερμινιστικό, από το κλειδί του). */
interface MemoryEntry<D> {
  readonly id: string;
  readonly decisions: readonly ImportMemoryRecord<D>[];
}

/** Η μνήμη που αφορά μια σελίδα ή μια πρόταση: κλειδί → έγγραφο. Ό,τι λείπει δεν έχει ιστορικό. */
export type MemoryBook<D> = ReadonlyMap<string, MemoryEntry<D>>;

type MemoryVerdict<D> =
  | { readonly kind: 'none' }
  | { readonly kind: 'conflict' }
  | { readonly kind: 'apply'; readonly decision: D; readonly count: number; readonly sourceBatchId: string };

/** Μία διακριτή απόφαση στο ιστορικό ⇒ εφαρμογή· δύο ή περισσότερες ⇒ σύγκρουση· καμία ⇒ τίποτα. */
export function memoryVerdict<D>(entry: { readonly decisions: readonly ImportMemoryRecord<D>[] } | null | undefined): MemoryVerdict<D> {
  const decisions = entry?.decisions ?? [];
  if (decisions.length === 0) return { kind: 'none' };
  if (decisions.length > 1) return { kind: 'conflict' };
  const [only] = decisions;
  return { kind: 'apply', decision: only.decision, count: only.count, sourceBatchId: only.lastBatchId };
}

/** Μια επιλογή υπόδειξης όπως την κρίνει ο πυρήνας: πόσες εγκρίσεις, και αν εφαρμόζεται εδώ. */
interface JudgedOption {
  readonly count: number;
  readonly usable: boolean;
}

/**
 * Η **προτεινόμενη** επιλογή μιας υπόδειξης (Akeneo SDM Value Mapping: «suggests the most frequently used target option»): η εφαρμόσιμη
 * με τις περισσότερες εγκρίσεις, **ανάμεσα σε τουλάχιστον δύο εφαρμόσιμες**. Ισοπαλία, μία ή καμία εφαρμόσιμη ⇒ `null`.
 * 🔑 **Κατάταξη ≠ προέλευση** (SAP Fiori AI Notice · Apple HIG «Multiple options»): η προέλευση («από μνήμη · N εγκρίσεις») φαίνεται
 *    **πάντα**· το «προτεινόμενη» είναι **σύγκριση** και λέει κάτι μόνο όταν υπάρχει εναλλακτική που ο άνθρωπος θα μπορούσε να διαλέξει.
 *    Μία εφαρμόσιμη δίπλα σε «δεν ισχύει πλέον» δεν κερδίζει τίποτα — είναι απλώς η μόνη ενέργεια (`primaryOptionIndex`).
 * **Πρόταση, όχι εφαρμογή**: η σύγκρουση μένει ερώτηση στον άνθρωπο (`memoryVerdict`), η προτεινόμενη απλώς ξεχωρίζει.
 */
export function suggestedOptionIndex(options: readonly JudgedOption[]): number | null {
  const usableCounts = options.flatMap((option) => (option.usable ? [option.count] : []));
  if (usableCounts.length < 2) return null;
  const top = Math.max(...usableCounts);
  if (usableCounts.filter((count) => count === top).length > 1) return null;
  return options.findIndex((option) => option.usable && option.count === top);
}

/**
 * Η **κύρια ενέργεια** μιας υπόδειξης (το κουμπί που τονίζεται): η προτεινόμενη, αλλιώς η **μόνη** εφαρμόσιμη· ισοπαλία ⇒ `null` (κανένα
 * κουμπί δεν προηγείται όταν ο άνθρωπος έχει πει δύο πράγματα εξίσου). Ένας κανόνας για τη μνήμη γραμμών και τη μνήμη τιμών.
 */
export function primaryOptionIndex(options: readonly JudgedOption[]): number | null {
  const suggested = suggestedOptionIndex(options);
  if (suggested !== null) return suggested;
  const usable = options.flatMap((option, index) => (option.usable ? [index] : []));
  return usable.length === 1 ? usable[0] : null;
}

/** Η προέλευση που φορά ό,τι εφάρμοσε η μνήμη: ορατή, με αναίρεση. */
export const memoryOriginOf = (memoryId: string, verdict: { readonly count: number; readonly sourceBatchId: string }): ImportMemoryOrigin =>
  ({ kind: 'memory', memoryId, count: verdict.count, sourceBatchId: verdict.sourceBatchId });

/** Ποιος, πότε, από ποια παρτίδα: η σφραγίδα μιας έγκρισης. */
export interface LearningStamp {
  readonly batchId: string;
  readonly by: string;
  readonly at: string;
}

/** +1 στην απόφαση που εγκρίθηκε· οι άλλες μένουν (Akeneo). Πέρα από το όριο φεύγει η λιγότερο στηριγμένη. */
export function learnedRecords<D>(
  current: readonly ImportMemoryRecord<D>[],
  decision: D,
  same: (a: D, b: D) => boolean,
  stamp: LearningStamp,
): ImportMemoryRecord<D>[] {
  const found = current.find((entry) => same(entry.decision, decision));
  const next: ImportMemoryRecord<D> = { decision, count: (found?.count ?? 0) + 1, lastBatchId: stamp.batchId, lastBy: stamp.by, lastAt: stamp.at };
  const kept = [...current.filter((entry) => entry !== found), next];
  return kept.sort((a, b) => b.count - a.count).slice(0, IMPORT_LABEL_MEMORY_MAX_DECISIONS);
}
