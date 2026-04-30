import type { Quote, QuoteStatus } from '../types/quote';

// NOTE: 'expired' IS a status in our FSM (quote.ts) — ADR §5.BB overlay is a separate UI concern
// superseded ranks last — excluded from main list by useQuotes default filter (§5.AA.7)
export const STATUS_PRIORITY: Record<QuoteStatus, number> = {
  accepted: 1,
  under_review: 2,
  submitted: 3,
  sent_to_vendor: 4,
  draft: 5,
  rejected: 6,
  expired: 7,
  archived: 8,
  superseded: 9,
};

export type SortKey = 'status-price' | 'recent' | 'price-asc' | 'price-desc' | 'vendor-asc';

export const VALID_SORT_KEYS: readonly SortKey[] = [
  'status-price',
  'recent',
  'price-asc',
  'price-desc',
  'vendor-asc',
];

export const DEFAULT_SORT_KEY: SortKey = 'status-price';

// Handles both Firestore Timestamp (toMillis) and serialized { seconds } objects
function toMs(ts: unknown): number {
  if (!ts) return 0;
  const t = ts as { toMillis?: () => number; seconds?: number };
  if (typeof t.toMillis === 'function') return t.toMillis();
  if (typeof t.seconds === 'number') return t.seconds * 1000;
  return 0;
}

function compareByPrice(a: Quote, b: Quote): number {
  const aTotal = a.totals?.total ?? Number.POSITIVE_INFINITY;
  const bTotal = b.totals?.total ?? Number.POSITIVE_INFINITY;
  return aTotal - bTotal;
}

function compareByPriceDesc(a: Quote, b: Quote): number {
  const aTotal = a.totals?.total ?? Number.NEGATIVE_INFINITY;
  const bTotal = b.totals?.total ?? Number.NEGATIVE_INFINITY;
  return bTotal - aTotal;
}

function compareByRecency(a: Quote, b: Quote): number {
  return toMs(b.submittedAt) - toMs(a.submittedAt);
}

function compareByVendor(a: Quote, b: Quote): number {
  const aName = a.extractedData?.vendorName?.value ?? a.vendorContactId;
  const bName = b.extractedData?.vendorName?.value ?? b.vendorContactId;
  return aName.localeCompare(bName, 'el', { sensitivity: 'base' });
}

export function sortQuotes(quotes: Quote[], sortKey: SortKey): Quote[] {
  const arr = [...quotes];
  switch (sortKey) {
    case 'recent':
      return arr.sort(compareByRecency);
    case 'price-asc':
      return arr.sort(compareByPrice);
    case 'price-desc':
      return arr.sort(compareByPriceDesc);
    case 'vendor-asc':
      return arr.sort(compareByVendor);
    case 'status-price':
    default:
      return arr.sort((a, b) => {
        const aPrio = STATUS_PRIORITY[a.status] ?? 99;
        const bPrio = STATUS_PRIORITY[b.status] ?? 99;
        if (aPrio !== bPrio) return aPrio - bPrio;
        return compareByPrice(a, b);
      });
  }
}

export interface QuoteGroup {
  status: QuoteStatus;
  quotes: Quote[];
}

// Preserves the order from sortQuotes — groups contiguous runs by status
export function groupByStatus(sortedQuotes: Quote[]): QuoteGroup[] {
  const groups: QuoteGroup[] = [];
  let currentStatus: QuoteStatus | null = null;
  let currentGroup: Quote[] = [];
  for (const q of sortedQuotes) {
    if (q.status !== currentStatus) {
      if (currentStatus !== null) groups.push({ status: currentStatus, quotes: currentGroup });
      currentStatus = q.status;
      currentGroup = [q];
    } else {
      currentGroup.push(q);
    }
  }
  if (currentStatus !== null) groups.push({ status: currentStatus, quotes: currentGroup });
  return groups;
}
