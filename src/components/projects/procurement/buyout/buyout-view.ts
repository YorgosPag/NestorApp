/**
 * Buyout view helpers — filtering, grouping and selection rules of the «Coverage» tab (ADR-330 §5.1 S3.2).
 * Pure: the component only renders what these return.
 *
 * @module components/projects/procurement/buyout/buyout-view
 */

import { compareCostCodes } from '@/config/cost-taxonomy';
import { matchesSearchTerm } from '@/lib/search/search';
import type { BuyoutItem, BuyoutStatus } from '@/services/procurement/buyout/project-buyout';

export interface BuyoutGroup {
  categoryCode: string;
  items: BuyoutItem[];
  /** Over the group's VISIBLE items */
  coveredCount: number;
  openAmount: number;
}

/** Statuses a new RFQ is meant for — sending one for work already on its way is the double-sourcing we warn about */
const IN_PROGRESS: ReadonlySet<BuyoutStatus> = new Set<BuyoutStatus>(['sourcing', 'ordering']);

export function filterBuyoutItems(
  items: readonly BuyoutItem[],
  statuses: readonly BuyoutStatus[],
  search: string,
): BuyoutItem[] {
  return items.filter(item =>
    (statuses.length === 0 || statuses.includes(item.status))
    && (!search || matchesSearchTerm([item.title, item.costCode, item.categoryCode], search)));
}

export function groupBuyoutItems(items: readonly BuyoutItem[]): BuyoutGroup[] {
  const groups = new Map<string, BuyoutGroup>();
  for (const item of items) {
    const group = groups.get(item.categoryCode)
      ?? { categoryCode: item.categoryCode, items: [], coveredCount: 0, openAmount: 0 };
    group.items.push(item);
    if (item.status === 'committed') group.coveredCount += 1;
    else group.openAmount += item.amount;
    groups.set(item.categoryCode, group);
  }
  return [...groups.values()].sort((a, b) => compareCostCodes(a.categoryCode, b.categoryCode));
}

/** Only work NOT yet covered can go into a new RFQ — a covered line has nothing left to buy */
export function isSelectable(item: BuyoutItem): boolean {
  return item.status !== 'committed';
}

export function countInProgress(items: readonly BuyoutItem[], selected: ReadonlySet<string>): number {
  return items.filter(item => selected.has(item.id) && IN_PROGRESS.has(item.status)).length;
}

/** Toggle every selectable item of a group: all selected ⇒ clear them, else select them all */
export function toggleGroupSelection(group: BuyoutGroup, selected: ReadonlySet<string>): Set<string> {
  const ids = group.items.filter(isSelectable).map(item => item.id);
  const next = new Set(selected);
  const allSelected = ids.length > 0 && ids.every(id => next.has(id));
  for (const id of ids) {
    if (allSelected) next.delete(id);
    else next.add(id);
  }
  return next;
}

/** Selection survives a filter change only for items still selectable — stale ids never reach the RFQ */
export function pruneSelection(selected: ReadonlySet<string>, items: readonly BuyoutItem[]): Set<string> {
  const selectable = new Set(items.filter(isSelectable).map(item => item.id));
  return new Set([...selected].filter(id => selectable.has(id)));
}
