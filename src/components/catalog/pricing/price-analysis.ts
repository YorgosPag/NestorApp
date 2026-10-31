/**
 * @fileoverview **Η καθαρή λογική της ανάλυσης τιμής** — κοινά προς σύγκριση · ομαδοποίηση ίχνους · διαφορά από το πρώτο
 *   κοινό (ADR-923 §5.11 «3δ» Τμήμα 3).
 * @related server/catalog/price-quote.server.ts (η ΜΟΝΗ πηγή τιμής) · use-price-analysis.ts (η κατάσταση)
 * @module components/catalog/pricing/price-analysis
 *
 * 🔑 **Κανένας υπολογισμός τιμής εδώ** (απόφαση Ζ): όλα τα ποσά έρχονται από τον διακομιστή. Η μόνη αριθμητική είναι η
 *    **διαφορά δύο ποσών** που έδωσε ο ίδιος, για την ένδειξη «πόσο κάτω από το πρώτο κοινό».
 */

import type { MinorAmount } from '@/lib/money/money';
import type { SelectionTraceEntry, SelectionVerdict } from '@/lib/pricing/select-condition';
import type { ConditionMismatch } from '@/subapps/catalog/pricing/resolve-catalog-price';
import type { PriceAudience } from '@/subapps/catalog/types/price-list';
import type { PriceQuoteResult } from '@/subapps/catalog/types/price-list-requests';
import { isUnsetParty } from './party-name-memory';

/** Δίπλα-δίπλα χωρούν ως 4 θεατές — πέρα από αυτό η σύγκριση παύει να διαβάζεται. */
export const MAX_ANALYSIS_VIEWERS = 4;

export interface AnalysisViewer {
  readonly key: string;
  readonly audience: PriceAudience;
}

export type AnalysisVerdict = SelectionVerdict<ConditionMismatch>;
export type AnalysisTraceEntry = SelectionTraceEntry<ConditionMismatch>;

/** Έχει ο άνθρωπος διαλέξει ποιος είναι ο θεατής; Μισό κοινό δεν ρωτά τον διακομιστή (θα γύριζε 422). */
export function isCompleteAudience(audience: PriceAudience): boolean {
  if (audience.kind === 'customerGroup') return audience.customerGroupId !== '';
  if (audience.kind === 'partner') return !isUnsetParty(audience.party);
  return true;
}

/** Η απάντηση για έναν θεατή — **ανεξάρτητη** από τους άλλους: μια αποτυχία δεν σβήνει τη σύγκριση. */
export type AnalysisCell =
  | { readonly state: 'incomplete' }
  | { readonly state: 'loading' }
  | { readonly state: 'failed' }
  | { readonly state: 'ready'; readonly result: PriceQuoteResult };

const netOf = (cell: AnalysisCell): MinorAmount | null =>
  cell.state === 'ready' && cell.result.kind === 'priced' ? cell.result.quote.netAmount : null;

/**
 * Πόσο **χαμηλότερα** από το πρώτο κοινό (αρνητικό = ακριβότερα). `null` στο ίδιο το πρώτο κοινό και όταν ένα από τα δύο
 * δεν έχει τιμή — καμία σύγκριση με κενό.
 */
export function savingVersusBaseline(cell: AnalysisCell, baseline: AnalysisCell): MinorAmount | null {
  if (cell === baseline) return null;
  const net = netOf(cell);
  const baseNet = netOf(baseline);
  return net === null || baseNet === null ? null : baseNet - net;
}

const INACTIVE: ReadonlySet<AnalysisVerdict> = new Set<AnalysisVerdict>(['notYetValid', 'expired']);
const UNRELATED: ReadonlySet<AnalysisVerdict> = new Set<AnalysisVerdict>(['audienceMismatch', 'groupMismatch']);

export interface TraceBuckets {
  /** Νικητής ή ισόπαλοι, έπειτα όσοι ηττήθηκαν από ειδικότερο — αυτά εξηγούν το αποτέλεσμα. */
  readonly relevant: readonly AnalysisTraceEntry[];
  /** Θα ταίριαζαν, αλλά όχι αυτή τη στιγμή. */
  readonly inactive: readonly AnalysisTraceEntry[];
  /** Αφορούν άλλο κοινό ή άλλη ομάδα: μετρούνται, δεν αναπτύσσονται (μπορεί να είναι εκατοντάδες). */
  readonly unrelatedCount: number;
}

const decisionRank = (verdict: AnalysisVerdict): number => (verdict === 'outranked' ? 1 : 0);

export function bucketTrace(trace: readonly AnalysisTraceEntry[]): TraceBuckets {
  const relevant = trace
    .filter((entry) => !INACTIVE.has(entry.verdict) && !UNRELATED.has(entry.verdict))
    .sort((a, b) => decisionRank(a.verdict) - decisionRank(b.verdict));
  return {
    relevant,
    inactive: trace.filter((entry) => INACTIVE.has(entry.verdict)),
    unrelatedCount: trace.filter((entry) => UNRELATED.has(entry.verdict)).length,
  };
}

/** Η λίστα του ιστορικού: ό,τι διάλεξε ο άνθρωπος, αλλιώς αυτή που νίκησε για το πρώτο κοινό με τιμή. */
export function historyListOf(chosen: string | null, cells: readonly AnalysisCell[]): string | null {
  if (chosen !== null) return chosen;
  for (const cell of cells) {
    if (cell.state === 'ready' && cell.result.kind === 'priced') return cell.result.quote.priceListId;
  }
  return null;
}
