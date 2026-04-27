import type { Quote } from '@/subapps/procurement/types/quote';
import type { VendorInvite } from '@/subapps/procurement/types/vendor-invite';
import type { PurchaseOrder } from '@/types/procurement';
import { PO_COMMITTED_STATUSES } from '@/types/procurement';

const ACTIVE_QUOTE_STATUSES: ReadonlySet<Quote['status']> = new Set([
  'sent_to_vendor',
  'submitted',
  'under_review',
]);

const OPEN_INVITE_STATUSES: ReadonlySet<VendorInvite['status']> = new Set([
  'sent',
  'opened',
]);

const RECENT_PO_DAYS = 90;

export interface ProcurementTabKpis {
  openRfqs: number;
  activeQuotes: number;
  recentPOs: number;
  totalSpendYtd: number;
}

export function computeKpis(input: {
  quotes: Quote[];
  invites: VendorInvite[];
  purchaseOrders: PurchaseOrder[];
}): ProcurementTabKpis {
  const now = Date.now();
  const recentCutoff = now - RECENT_PO_DAYS * 24 * 60 * 60 * 1000;
  const startOfYear = new Date(new Date().getFullYear(), 0, 1).getTime();

  const openRfqs = input.invites.filter((inv) => OPEN_INVITE_STATUSES.has(inv.status)).length;
  const activeQuotes = input.quotes.filter((q) => ACTIVE_QUOTE_STATUSES.has(q.status)).length;

  const recentPOs = input.purchaseOrders.filter((po) => {
    if (po.isDeleted) return false;
    if (!po.dateOrdered) return false;
    return new Date(po.dateOrdered).getTime() >= recentCutoff;
  }).length;

  const totalSpendYtd = input.purchaseOrders.reduce((sum, po) => {
    if (po.isDeleted) return sum;
    if (!po.dateOrdered) return sum;
    if (new Date(po.dateOrdered).getTime() < startOfYear) return sum;
    if (!PO_COMMITTED_STATUSES.has(po.status)) return sum;
    return sum + po.total;
  }, 0);

  return { openRfqs, activeQuotes, recentPOs, totalSpendYtd };
}
