/**
 * Project buyout — «is every counted BOQ line bought out yet?» (ADR-330 §5.1 S3.2).
 *
 * Procore's Buyout answers it with two states (committed / uncommitted). We answer with FOUR, because the two
 * middle ones are what stops a second RFQ for work that is already on its way:
 *
 *   committed  — a PO line in a committed status references it (the overview's «covered», SAME ledger set)
 *   ordering   — only a PO still draft/approved references it
 *   sourcing   — only an OPEN RFQ references it
 *   uncovered  — nothing does
 *
 * Pure: no I/O. The cost ledger (ADR-917) owns «which PO covers which line»; this only overlays the RFQs and
 * shapes the view. Lines come from `rows[].sources.boqItems` — already the COUNTED set (summary parents out, Λ7),
 * so the list total equals the overview's denominator by construction.
 *
 * @module services/procurement/buyout/project-buyout
 */

import type { CostLedger, BoqProcurementLink } from '@/services/project-cost/cost-ledger';

/** The vocabulary, in display order — the work still to be done first */
export const BUYOUT_STATUSES = ['uncovered', 'sourcing', 'ordering', 'committed'] as const;

export type BuyoutStatus = (typeof BUYOUT_STATUSES)[number];

interface BuyoutStatusMeta {
  /** Design-system status token (`getStatusColor`) */
  readonly tone: 'warning' | 'info' | 'success';
}

/** Exhaustive per status — its keys ARE the valid `?status=` values of the buyout list */
export const BUYOUT_STATUS_META: Readonly<Record<BuyoutStatus, BuyoutStatusMeta>> = {
  uncovered: { tone: 'warning' },
  sourcing: { tone: 'info' },
  ordering: { tone: 'info' },
  committed: { tone: 'success' },
};

/** Everything the overview card counts as NOT covered — the card's drill-down target */
export const BUYOUT_OPEN_STATUSES: readonly BuyoutStatus[] = BUYOUT_STATUSES.filter(status => status !== 'committed');

/** A counted BOQ line referenced by an OPEN RFQ (built server-side by `fetchProjectBoqSourcing`) */
export interface BuyoutRfqRef {
  boqItemId: string;
  rfqId: string;
  rfqTitle: string;
}

export interface BuyoutItem {
  id: string;
  /** The line's own code (`OIK-2.03`) */
  costCode: string | null;
  /** The ledger row it rolls into (`OIK-2`) — the grouping key */
  categoryCode: string;
  title: string;
  amount: number;
  /** `false` ⇒ no unit price yet: «unpriced», never «0 €» (ADR-917 Ζ7) */
  priced: boolean;
  status: BuyoutStatus;
  purchaseOrders: Array<Pick<BoqProcurementLink, 'poId' | 'poNumber' | 'stage'>>;
  rfqs: Array<{ rfqId: string; rfqTitle: string }>;
}

export interface BuyoutTotal {
  count: number;
  amount: number;
}

export interface ProjectBuyout {
  items: BuyoutItem[];
  totals: Record<BuyoutStatus, BuyoutTotal>;
  /** Same denominator / numerator as the overview card (`ledger.boqItemCount` / `coveredBoqItemCount`) */
  boqItemCount: number;
  coveredBoqItemCount: number;
}

function groupBy<T>(values: readonly T[], keyOf: (value: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const value of values) {
    const key = keyOf(value);
    const group = groups.get(key);
    if (group) group.push(value);
    else groups.set(key, [value]);
  }
  return groups;
}

export function resolveBuyoutStatus(
  purchaseOrders: readonly Pick<BoqProcurementLink, 'stage'>[],
  rfqCount: number,
): BuyoutStatus {
  if (purchaseOrders.some(po => po.stage === 'committed')) return 'committed';
  if (purchaseOrders.length > 0) return 'ordering';
  return rfqCount > 0 ? 'sourcing' : 'uncovered';
}

function emptyTotals(): Record<BuyoutStatus, BuyoutTotal> {
  const zero = (): BuyoutTotal => ({ count: 0, amount: 0 });
  return { uncovered: zero(), sourcing: zero(), ordering: zero(), committed: zero() };
}

export function deriveProjectBuyout(ledger: CostLedger, rfqRefs: readonly BuyoutRfqRef[]): ProjectBuyout {
  const posByBoq = groupBy(ledger.boqProcurementLinks, link => link.boqItemId);
  const rfqsByBoq = groupBy(rfqRefs, ref => ref.boqItemId);
  const totals = emptyTotals();

  const items = ledger.rows.flatMap(row => row.sources.boqItems.map((source): BuyoutItem => {
    const purchaseOrders = (posByBoq.get(source.id) ?? []).map(({ poId, poNumber, stage }) => ({ poId, poNumber, stage }));
    const rfqs = (rfqsByBoq.get(source.id) ?? []).map(({ rfqId, rfqTitle }) => ({ rfqId, rfqTitle }));
    const status = resolveBuyoutStatus(purchaseOrders, rfqs.length);
    totals[status].count += 1;
    totals[status].amount += source.amount;
    return { ...source, categoryCode: row.categoryCode, status, purchaseOrders, rfqs };
  }));

  return { items, totals, boqItemCount: ledger.boqItemCount, coveredBoqItemCount: ledger.coveredBoqItemCount };
}
