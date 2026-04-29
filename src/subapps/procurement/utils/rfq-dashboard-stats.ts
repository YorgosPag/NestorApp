import {
  FileText, Clock, CheckCircle, TrendingDown, TrendingUp,
  ArrowDownUp, Sparkles, List, Package, Mail, AlertCircle,
} from 'lucide-react';
import type { DashboardStat } from '@/components/property-management/dashboard/UnifiedDashboard';
import type { Quote } from '@/subapps/procurement/types/quote';
import type { VendorInvite } from '@/subapps/procurement/types/vendor-invite';
import type { QuoteComparisonResult } from '@/subapps/procurement/types/comparison';
import type { RFQ } from '@/subapps/procurement/types/rfq';
import type { RfqTabValue } from '@/subapps/procurement/hooks/useRfqUrlState';
import type { TFunction } from 'i18next';

function formatEur(n: number): string {
  return new Intl.NumberFormat('el-GR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

function toDeadlineMs(rfq: RFQ | null): number | null {
  const d = rfq?.deadlineDate;
  if (!d) return null;
  if (typeof d === 'object' && 'seconds' in (d as object)) {
    return (d as { seconds: number }).seconds * 1000;
  }
  const n = new Date(d as unknown as string).getTime();
  return Number.isNaN(n) ? null : n;
}

function positiveTotals(quotes: Quote[]): number[] {
  return quotes
    .map(q => q.totals?.total)
    .filter((v): v is number => typeof v === 'number' && v > 0);
}

function quotesTab(quotes: Quote[], t: TFunction): DashboardStat[] {
  const underReview = quotes.filter(q => q.status === 'under_review').length;
  const accepted    = quotes.filter(q => q.status === 'accepted').length;
  const vals        = positiveTotals(quotes);
  const bestPrice   = vals.length > 0 ? Math.min(...vals) : null;

  return [
    { title: t('rfqs.dashboard.quotes.total'),       value: quotes.length,                                    icon: FileText,   color: 'blue' },
    { title: t('rfqs.dashboard.quotes.underReview'), value: underReview,                                      icon: Clock,      color: 'orange' },
    { title: t('rfqs.dashboard.quotes.accepted'),    value: accepted,                                         icon: CheckCircle, color: 'green' },
    { title: t('rfqs.dashboard.quotes.bestPrice'),   value: bestPrice !== null ? formatEur(bestPrice) : '—', icon: TrendingDown, color: 'cyan' },
  ];
}

function comparisonTab(
  quotes: Quote[],
  comparison: QuoteComparisonResult | null,
  t: TFunction,
): DashboardStat[] {
  const vals        = positiveTotals(quotes);
  const bestPrice   = vals.length > 0 ? Math.min(...vals) : null;
  const worstPrice  = vals.length > 0 ? Math.max(...vals) : null;
  const diff        = bestPrice !== null && worstPrice !== null ? worstPrice - bestPrice : null;

  const recEntry    = comparison?.recommendation
    ? comparison.quotes.find(e => e.quoteId === comparison.recommendation!.quoteId)
    : null;

  return [
    { title: t('rfqs.dashboard.comparison.bestPrice'),      value: bestPrice  !== null ? formatEur(bestPrice)  : '—', icon: TrendingDown, color: 'green' },
    { title: t('rfqs.dashboard.comparison.worstPrice'),     value: worstPrice !== null ? formatEur(worstPrice) : '—', icon: TrendingUp,   color: 'red' },
    { title: t('rfqs.dashboard.comparison.priceDiff'),      value: diff       !== null ? formatEur(diff)       : '—', icon: ArrowDownUp,  color: 'orange' },
    { title: t('rfqs.dashboard.comparison.recommendation'), value: recEntry?.vendorName ?? '—',                       icon: Sparkles,     color: 'purple' },
  ];
}

function setupTab(rfq: RFQ | null, invites: VendorInvite[], t: TFunction): DashboardStat[] {
  const lines        = rfq?.lines ?? [];
  const totalVolume  = lines.reduce((s, l) => s + (l.quantity ?? 0), 0);
  const now          = Date.now();
  const deadlineMs   = toDeadlineMs(rfq);

  const attentionCount = invites.filter(
    i => i.status === 'expired' || (i.status === 'pending' && deadlineMs !== null && now > deadlineMs),
  ).length;

  return [
    { title: t('rfqs.dashboard.setup.totalLines'),   value: lines.length,    icon: List,        color: 'blue' },
    { title: t('rfqs.dashboard.setup.totalVolume'),  value: totalVolume,     icon: Package,     color: 'indigo' },
    { title: t('rfqs.dashboard.setup.invites'),      value: invites.length,  icon: Mail,        color: 'purple' },
    { title: t('rfqs.dashboard.setup.pending'),      value: attentionCount,  icon: AlertCircle, color: attentionCount > 0 ? 'yellow' : 'gray' },
  ];
}

export function buildRfqDashboardStats(
  rfq: RFQ | null,
  quotes: Quote[],
  invites: VendorInvite[],
  comparison: QuoteComparisonResult | null,
  activeTab: RfqTabValue,
  t: TFunction,
): DashboardStat[] {
  switch (activeTab) {
    case 'quotes':     return quotesTab(quotes, t);
    case 'comparison': return comparisonTab(quotes, comparison, t);
    case 'setup':      return setupTab(rfq, invites, t);
  }
}
