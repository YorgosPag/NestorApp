/**
 * =============================================================================
 * ΤΙΜΕΣ ΚΟΣΤΟΥΣ ΓΙΑ ΤΟΝ ΠΡΟΫΠΟΛΟΓΙΣΜΟ — επιλογή και απόκλιση (ADR-923 §5.11 «3ε» · ADR-175 §4.1.3)
 * =============================================================================
 *
 * 1. **Επιλογή** (`matchCostRate`): ο ΙΔΙΟΣ επιλογέας με τις συνθήκες (`selectMostSpecific`). Η γραμμή έργου νικά τον
 *    master, η γραμμή της περιοχής νικά τη γενική. Ισοπαλία ⇒ `ambiguous`, ποτέ «η πρώτη».
 * 2. **Απόκλιση** (`judgeCostDrift`): τι έγινε από τότε που η γραμμή BOQ πήρε την τιμή της. Η σύγκριση γίνεται **ανά
 *    μονάδα** με τη συνάρτηση της διαφοράς εκδόσεων, και ο φράχτης είναι της λίστας.
 *
 * 🔑 Μόνο **κρίνει**. Ποτέ δεν αλλάζει τιμή: η ανανέωση είναι ρητή πράξη (απόφαση #3 · Sage «Reprice» · Buildxact).
 * 🔑 Η μελλοντική έκδοση αναφέρεται **πριν** ισχύσει: αυτό δεν το δίνουν τα εργαλεία που εξετάστηκαν.
 *
 * @module subapps/catalog/pricing/cost-rate
 */

import { sumMinor, type MinorAmount } from '@/lib/money/money';
import type { BasisPoints } from '@/lib/pricing/discount-rule';
import { selectMostSpecific, type Selection, type SelectionCandidate } from '@/lib/pricing/select-condition';
import type { CostRate, CostRateBook } from '../types/cost-rate';
import { unitPriceChangeBp } from './diff-price-versions';

export type CostRateMismatch = 'unitMismatch' | 'regionMismatch' | 'projectMismatch';

export interface CostRateQuery {
  readonly atoeCode: string;
  readonly unitCode: string;
  readonly region: string | null;
  readonly projectId: string;
}

function mismatchOf(rate: CostRate, query: CostRateQuery): CostRateMismatch | null {
  if (rate.projectId !== null && rate.projectId !== query.projectId) return 'projectMismatch';
  if (rate.unitCode !== query.unitCode) return 'unitMismatch';
  return rate.region !== null && rate.region !== query.region ? 'regionMismatch' : null;
}

/** Ειδικότητα: έργο πρώτα, περιοχή δεύτερη. Κάθε γραμμή έχει ήδη ταιριάξει στον κωδικό. */
export function matchCostRate(rates: readonly CostRate[], query: CostRateQuery): Selection<CostRate, CostRateMismatch> {
  const candidates = rates
    .filter((rate) => rate.atoeCode === query.atoeCode)
    .map((rate): SelectionCandidate<CostRate, CostRateMismatch> => ({
      id: rate.lineId,
      item: rate,
      validity: { fromMs: null, untilMs: null },
      mismatch: mismatchOf(rate, query),
      specificity: [rate.projectId === null ? 0 : 1, rate.region === null ? 0 : 1],
    }));
  return selectMostSpecific(candidates, 0);
}

/** Ό,τι κρατά η γραμμή BOQ και χρειάζεται η σύγκριση — χωρίς εξάρτηση του καταλόγου από τους τύπους BOQ. */
export interface CostSnapshot {
  readonly priceListId: string;
  readonly priceListVersionId: string;
  readonly subjectKey: string;
  readonly unit: string;
  readonly priceQuantity: number;
  readonly breakdown: { readonly material: MinorAmount; readonly labor: MinorAmount; readonly equipment: MinorAmount };
}

export type CostDrift =
  | { readonly kind: 'current' }
  | { readonly kind: 'listGone' }
  | { readonly kind: 'lineGone' }
  | { readonly kind: 'unitChanged'; readonly rate: CostRate }
  | { readonly kind: 'changed'; readonly rate: CostRate; readonly changeBp: BasisPoints | null; readonly exceedsFence: boolean }
  | { readonly kind: 'upcoming'; readonly rate: CostRate; readonly changeBp: BasisPoints | null };

const totalOf = (snapshot: CostSnapshot): MinorAmount =>
  sumMinor([snapshot.breakdown.material, snapshot.breakdown.labor, snapshot.breakdown.equipment]);

function changeBpOf(snapshot: CostSnapshot, rate: CostRate): BasisPoints | null {
  return unitPriceChangeBp({ netPrice: totalOf(snapshot), priceQuantity: snapshot.priceQuantity }, rate);
}

const sameLine = (snapshot: CostSnapshot) => (rate: CostRate): boolean =>
  rate.priceListId === snapshot.priceListId && rate.subjectKey === snapshot.subjectKey;

/** Σύγκριση **ανά συνθετικό** και ανά μονάδα: αλλαγή ανάλυσης με ίδιο σύνολο είναι κι αυτή αλλαγή, γιατί η γραμμή BOQ κρατά τα τρία χωριστά. */
function differs(snapshot: CostSnapshot, rate: CostRate): boolean {
  const { material, labor, equipment } = snapshot.breakdown;
  const per = (amount: MinorAmount) => BigInt(amount) * BigInt(rate.priceQuantity);
  const of = (amount: MinorAmount) => BigInt(amount) * BigInt(snapshot.priceQuantity);
  return per(material) !== of(rate.breakdown.material) || per(labor) !== of(rate.breakdown.labor) || per(equipment) !== of(rate.breakdown.equipment);
}

function upcomingDrift(snapshot: CostSnapshot, book: CostRateBook): CostDrift {
  const next = book.upcoming.find(sameLine(snapshot));
  return next !== undefined && differs(snapshot, next) ? { kind: 'upcoming', rate: next, changeBp: changeBpOf(snapshot, next) } : { kind: 'current' };
}

/** Τι άλλαξε για μία γραμμή BOQ σε σχέση με ό,τι ισχύει τώρα. */
export function judgeCostDrift(snapshot: CostSnapshot, book: CostRateBook): CostDrift {
  if (!book.priceListIds.includes(snapshot.priceListId)) return { kind: 'listGone' };
  const rate = book.current.find(sameLine(snapshot));
  if (rate === undefined) return { kind: 'lineGone' };
  if (rate.unitCode !== snapshot.unit) return { kind: 'unitChanged', rate };
  if (!differs(snapshot, rate)) return upcomingDrift(snapshot, book);
  const changeBp = changeBpOf(snapshot, rate);
  return { kind: 'changed', rate, changeBp, exceedsFence: changeBp === null || Math.abs(changeBp) > rate.fenceBp };
}
