/**
 * quotesDashboardStats — Funzione pura per le stat cards del dashboard Προσφορές
 *
 * Pattern parallelo a procurementDashboardStats.ts (ADR-267 Phase E).
 * 8 KPI per UnifiedDashboard (4×2 grid desktop, 2×4 mobile).
 *
 * @see ADR-327 §Layout Unification — Quotes Dashboard SSoT
 */

import {
  FileText,
  FileEdit,
  ScanLine,
  Globe,
  Eye,
  CheckCircle2,
  Clock,
  Coins,
} from 'lucide-react';
import type { DashboardStat } from '@/components/property-management/dashboard/UnifiedDashboard';
import type { Quote } from '@/subapps/procurement/types/quote';
import type { TFunction } from 'i18next';

// =============================================================================
// HELPERS
// =============================================================================

function formatEur(n: number): string {
  return new Intl.NumberFormat('el-GR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

// =============================================================================
// MAIN FUNCTION
// =============================================================================

/**
 * Calcola gli 8 KPI dal array di Quote e li restituisce come DashboardStat[].
 * Usa le chiavi i18n dal namespace 'quotes' (dashboard.*).
 *
 * @param quotes - Array di Quote (escludendo gli archiviati)
 * @param t      - TFunction dal namespace 'quotes'
 */
export function buildQuotesDashboardStats(
  quotes: Quote[],
  t: TFunction,
): DashboardStat[] {
  const drafts        = quotes.filter((q) => q.status === 'draft');
  const scanned       = quotes.filter((q) => q.source === 'scan');
  const portal        = quotes.filter((q) => q.source === 'portal');
  const underReview   = quotes.filter((q) => q.status === 'under_review');
  const accepted      = quotes.filter((q) => q.status === 'accepted');
  const expired       = quotes.filter((q) => q.status === 'expired');
  const totalValue    = quotes
    .filter((q) => q.status !== 'rejected' && q.status !== 'archived')
    .reduce((s, q) => s + (q.totals?.total ?? 0), 0);

  return [
    {
      title: t('dashboard.total'),
      value: quotes.length,
      icon: FileText,
      color: 'blue',
    },
    {
      title: t('dashboard.draft'),
      value: drafts.length,
      icon: FileEdit,
      color: 'gray',
    },
    {
      title: t('dashboard.scanned'),
      value: scanned.length,
      icon: ScanLine,
      color: 'orange',
    },
    {
      title: t('dashboard.portal'),
      value: portal.length,
      icon: Globe,
      color: 'cyan',
    },
    {
      title: t('dashboard.underReview'),
      value: underReview.length,
      icon: Eye,
      color: 'yellow',
    },
    {
      title: t('dashboard.accepted'),
      value: accepted.length,
      icon: CheckCircle2,
      color: 'green',
    },
    {
      title: t('dashboard.expired'),
      value: expired.length,
      icon: Clock,
      color: expired.length > 0 ? 'red' : 'gray',
    },
    {
      title: t('dashboard.totalValue'),
      value: formatEur(totalValue),
      icon: Coins,
      color: 'purple',
    },
  ];
}
