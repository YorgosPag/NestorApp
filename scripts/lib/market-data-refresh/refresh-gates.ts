/**
 * @fileoverview **ΟΙ ΠΥΛΕΣ ΤΗΣ ΑΝΑΝΕΩΣΗΣ** — ό,τι θα έλεγε ένας προσεκτικός άνθρωπος πριν δεχτεί νέα δεδομένα (ADR-889 §11, απόφαση 3).
 * @related `refresh-diff.ts` (είσοδος) · `scripts/refresh-market-data.ts` (ο ορχηστρωτής — κόκκινο = **κανένα** PR)
 *
 * Καθαρές συναρτήσεις: κάθε πύλη παίρνει αριθμούς και επιστρέφει `{ ok, detail }`. Τα κατώφλια είναι **ονομασμένα** εδώ,
 * μία φορά — το ADR τα παραθέτει, δεν τα ξαναγράφει.
 *
 * Οι πύλες Ε1 (σχήμα πηγής: `assertMamaHeader` · `zone-source`) και Ε7 (jest στα πραγματικά αρχεία) ζουν αλλού: η Ε1
 * σταματά ήδη τον γεννήτορα, η Ε7 είναι σουίτα jest (`npm run test:market-data-real-files`).
 */

import type { CoverageTotals } from '../market-transactions/mama-match-report';
import type { ValueZonesRunSummary } from '../value-zones/zone-download';
import type { MarketDiff, ZoneDiff } from './refresh-diff';

export const REFRESH_THRESHOLDS = {
  /** Ε2 — ADR-889 §8: γραμμές σε περιοχή ÷ όλες. Μετρημένο 99,74%. */
  minCoverage: 0.99,
  /** Ε5 — μέγιστη πτώση γραμμών ενός ήδη γνωστού έτους / περιοχών / ζωνών. Πάνω από αυτό = υποψία κομμένου αρχείου. */
  maxDropRatio: 0.02,
  /** Ε6 — μαζική μετατόπιση: κελιά με n ≥ `minSample` και στις δύο πλευρές … */
  massShiftMinSample: 30,
  /** … που κινήθηκαν πάνω από ±15% … */
  massShiftMoveRatio: 0.15,
  /** … σε πάνω από το 20% των επιλέξιμων ⇒ μονάδες / στήλες άλλαξαν, όχι η αγορά. */
  massShiftMaxShare: 0.2,
  /** Κάτω από τόσα επιλέξιμα κελιά ένα ποσοστό δεν λέει τίποτα — η Ε6 σωπαίνει ρητά. */
  massShiftMinCells: 30,
} as const;

export type GateId = 'E2' | 'E3' | 'E4' | 'E5' | 'E6' | 'E7';

export interface GateResult {
  readonly id: GateId;
  readonly title: string;
  readonly ok: boolean;
  readonly detail: string;
  /** Παρακάμπτεται με ρητή ανθρώπινη απόφαση (`--accept-drop`) — και τότε το λέει η αναφορά. */
  readonly overridden?: boolean;
}

const pct = (value: number): string => `${(value * 100).toFixed(2)}%`;

export function coverageGate(totals: CoverageTotals): GateResult {
  const coverage = totals.rows === 0 ? 0 : totals.resolved / totals.rows;
  return {
    id: 'E2',
    title: 'Αντιστοίχιση περιοχών',
    ok: coverage >= REFRESH_THRESHOLDS.minCoverage,
    detail: `${totals.resolved} / ${totals.rows} = ${pct(coverage)} (όριο ${pct(REFRESH_THRESHOLDS.minCoverage)})`,
  };
}

/** Ε3 — δύο εκτελέσεις ⇒ ίδιο sha256 σε κάθε αρχείο. */
export function determinismGate(mismatched: readonly string[], files: number): GateResult {
  return {
    id: 'E3',
    title: 'Ντετερμινισμός (δύο εκτελέσεις)',
    ok: mismatched.length === 0,
    detail: mismatched.length === 0 ? `${files} αρχεία byte-ταυτόσημα` : `διαφέρουν: ${mismatched.slice(0, 10).join(', ')}${mismatched.length > 10 ? ' …' : ''}`,
  };
}

export function unassignedZonesGate(summary: ValueZonesRunSummary): GateResult {
  return {
    id: 'E4',
    title: 'Ζώνες χωρίς περιοχή',
    ok: summary.unassigned === 0,
    detail: `${summary.unassigned} (θα χάνονταν σιωπηλά από τον χάρτη)`,
  };
}

function dropOf(label: string, before: number | null, after: number): string | null {
  if (before === null || before === 0) return null;
  return after < before * (1 - REFRESH_THRESHOLDS.maxDropRatio) ? `${label}: ${before} → ${after} (${pct(after / before - 1)})` : null;
}

/** Ε5 — όγκος: γραμμές ανά ήδη γνωστό έτος, πλήθος περιοχών, πλήθος ζωνών. */
export function volumeGate(market: MarketDiff | null, zones: ZoneDiff | null, acceptDrop: boolean): GateResult {
  const drops = [
    ...(market?.years ?? []).map((y) => (y.before !== null && y.after !== null ? dropOf(`γραμμές ${y.year}`, y.before.rows, y.after.rows) : null)),
    market === null ? null : dropOf('περιοχές συμβολαίων', market.areaCount.before, market.areaCount.after),
    zones === null ? null : dropOf('ζώνες', zones.zoneCount.before, zones.zoneCount.after),
    zones === null ? null : dropOf('περιοχές ζωνών', zones.areaCount.before, zones.areaCount.after),
  ].filter((drop): drop is string => drop !== null);
  const clean = drops.length === 0;
  return {
    id: 'E5',
    title: `Όγκος (πτώση > ${pct(REFRESH_THRESHOLDS.maxDropRatio)})`,
    ok: clean || acceptDrop,
    detail: clean ? 'καμία πτώση' : drops.join(' · '),
    ...(clean || !acceptDrop ? {} : { overridden: true }),
  };
}

/** Ε6 — μαζική μετατόπιση των διαμέσων 12μήνου. */
export function massShiftGate(market: MarketDiff): GateResult {
  const t = REFRESH_THRESHOLDS;
  const eligible = market.moves.filter((m) => Math.min(m.nBefore, m.nAfter) >= t.massShiftMinSample);
  const shifted = eligible.filter((m) => Math.abs(m.ratio - 1) > t.massShiftMoveRatio);
  const title = 'Μαζική μετατόπιση διαμέσων';
  if (eligible.length < t.massShiftMinCells) {
    return { id: 'E6', title, ok: true, detail: `${eligible.length} επιλέξιμα κελιά (< ${t.massShiftMinCells}) — η πύλη σωπαίνει` };
  }
  const share = shifted.length / eligible.length;
  return {
    id: 'E6',
    title,
    ok: share <= t.massShiftMaxShare,
    detail: `${shifted.length} / ${eligible.length} κελιά (n ≥ ${t.massShiftMinSample}) κινήθηκαν > ±${pct(t.massShiftMoveRatio)} = ${pct(share)} (όριο ${pct(t.massShiftMaxShare)})`,
  };
}

export function realFilesGate(ok: boolean): GateResult {
  return {
    id: 'E7',
    title: 'jest στα πραγματικά αρχεία (αντι-σάπιση ορίων · κάλυψη γεωμετρίας · σχήματα)',
    ok,
    detail: ok ? 'πράσινο' : 'ΚΟΚΚΙΝΟ — δες το log· αν κοκκίνισαν τα όρια του χάρτη, αλλάζουν συνειδητά (ADR-890 §14.2)',
  };
}

export function allGatesPass(results: readonly GateResult[]): boolean {
  return results.every((result) => result.ok);
}
