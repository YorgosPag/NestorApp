'use client';

/**
 * @fileoverview Accounting Dashboard — Κεντρική σελίδα Λογιστικού
 * @description Κύριο dashboard με UnifiedDashboard stats, quick actions
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-02-09
 * @updated 2026-02-10 — Migrated to UnifiedDashboard (centralized component)
 * @see ADR-ACC-000 Accounting Subapp Architecture
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, no inline styles, semantic HTML
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from '@/lib/workspace/navigation';
import { useTranslation } from 'react-i18next';
// 🏢 ADR-300: Stale-while-revalidate — prevents navigation flash on remount
import { createStaleCache } from '@/lib/stale-cache';
import {
  Receipt,
  BookOpen,
  DollarSign,
  FileWarning,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PageLoadingState } from '@/core/states';
import { UnifiedDashboard } from '@/components/property-management/dashboard/UnifiedDashboard';
import type { DashboardStat } from '@/components/property-management/dashboard/UnifiedDashboard';
import { useAuth } from '@/hooks/useAuth';
import { API_ROUTES } from '@/config/domain-constants';
import { buildUrl } from '@/hooks/useCursorPagedList';
import { apiClient } from '@/lib/api/enterprise-api-client';
import { formatAccountingCurrency } from '../../utils/format';
import type { InvoiceListSummary } from '../../services/list-summaries/invoice-list-summary';
import type { JournalListSummary } from '../../services/list-summaries/journal-list-summary';
import { FiscalYearPicker } from '../shared/FiscalYearPicker';
import { summaryStatValue } from '../shared/summary-stat-value';

import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

import { cn } from '@/lib/utils';

// ============================================================================
// TYPES
// ============================================================================

/**
 * 🔴 ADR-ACC-010 §2.1.1 (2026-10-30) — κάθε νούμερο από ΣΥΝΟΨΗ του διακομιστή, όχι από σελίδα λίστας: ως τότε τα
 * έσοδα/έξοδα ήταν άθροισμα της ΠΡΩΤΗΣ σελίδας του Ημερολογίου σε ΜΙΚΤΑ ποσά (ο ΦΠΑ ως έσοδο), και τα «εκκρεμή
 * τιμολόγια» το μήκος μιας σελίδας μόνο με `unpaid` (χωρίς τα μερικώς εξοφλημένα). `null` = η πηγή απέτυχε ⇒ «—»,
 * ΠΟΤΕ «0» (το παλιό `catch` άφηνε σιωπηλά μηδενικά).
 */
interface DashboardStats {
  journal: JournalListSummary | null;
  invoices: InvoiceListSummary | null;
  vatOwed: number | null;
}

interface VatSummaryResponse {
  annualVatPayable?: number;
  vatPayable?: number;
}

/** Η τιμή μιας ρυθμισμένης υπόσχεσης — ή `null` αν απέτυχε (η κάρτα της δείχνει «—», οι άλλες κανονικά). */
function settledValue<T>(result: PromiseSettledResult<T>): T | null {
  return result.status === 'fulfilled' ? result.value : null;
}

const EMPTY_STATS: DashboardStats = { journal: null, invoices: null, vatOwed: null };

// ADR-300: Module-level cache keyed by fiscal year — survives remount
const accountingStatsCache = createStaleCache<DashboardStats>('accounting-dashboard');

// ============================================================================
// HELPERS
// ============================================================================

// ============================================================================
// COMPONENT
// ============================================================================

export function AccountingDashboard() {
  const { t } = useTranslation(['accounting', 'accounting-tax-offices']);
  const colors = useSemanticColors();
  const router = useRouter();
  const { user } = useAuth();

  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  // ADR-300: Seed from module-level cache → zero flash on re-navigation
  const [stats, setStats] = useState<DashboardStats>(
    accountingStatsCache.get(String(new Date().getFullYear())) ?? EMPTY_STATS
  );
  const [loading, setLoading] = useState(!accountingStatsCache.hasLoaded(String(new Date().getFullYear())));

  /**
   * 🔴 Μόνο η ΤΕΛΕΥΤΑΙΑ κλήση γράφει: γρήγορο 2026 → 2025 ⇒ η απάντηση του 2026 μπορεί να φτάσει δεύτερη και να γραφτεί
   *    κάτω από επικεφαλίδα «2025». Ίδιο μοτίβο με το `callIdRef` του `useAsyncData` (ADR-223).
   */
  const callIdRef = useRef(0);

  const fetchStats = useCallback(async () => {
    const id = ++callIdRef.current;
    if (!user) {
      setLoading(false);
      return;
    }
    // ADR-300: η cache του ΝΕΟΥ έτους (χωρίς spinner) — αλλιώς κενά + spinner. Ποτέ τα stats του προηγούμενου έτους
    //    κάτω από την επικεφαλίδα του νέου όσο τρέχει το αίτημα.
    const cached = accountingStatsCache.get(String(selectedYear));
    setStats(cached ?? EMPTY_STATS);
    setLoading(!cached);
    try {
      // Οι ΙΔΙΕΣ συνόψεις με τις σελίδες Ημερολογίου / Τιμολογίων (ίδια φίλτρα ⇒ ίδια νούμερα σε κάθε οθόνη).
      const params = { fiscalYear: selectedYear };
      const [journal, invoices, vat] = await Promise.allSettled([
        apiClient.get<JournalListSummary>(buildUrl(API_ROUTES.ACCOUNTING.JOURNAL_SUMMARY, params, null)),
        apiClient.get<InvoiceListSummary>(buildUrl(API_ROUTES.ACCOUNTING.INVOICES.SUMMARY, params, null)),
        apiClient.get<VatSummaryResponse>(buildUrl(API_ROUTES.ACCOUNTING.VAT.SUMMARY, params, null)),
      ]);
      if (callIdRef.current !== id) return;

      const vatData = settledValue(vat);
      const newStats: DashboardStats = {
        journal: settledValue(journal),
        invoices: settledValue(invoices),
        vatOwed: vatData ? (vatData.annualVatPayable ?? vatData.vatPayable ?? null) : null,
      };
      // ADR-300: Write to module-level cache so next remount skips spinner — μόνο πλήρη απάντηση: μια μισή θα
      //    σερβιριζόταν ως «φρέσκια» στην επόμενη επίσκεψη χωρίς νέα προσπάθεια για ό,τι απέτυχε.
      if (newStats.journal && newStats.invoices && newStats.vatOwed !== null) {
        accountingStatsCache.set(newStats, String(selectedYear));
      }
      setStats(newStats);
    } finally {
      if (callIdRef.current === id) setLoading(false);
    }
  }, [user, selectedYear]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Build UnifiedDashboard stats
  const dashboardStats: DashboardStat[] = [
    {
      title: t('dashboard.totalIncome'),
      value: summaryStatValue(stats.journal, (s) => formatAccountingCurrency(s.totalIncome)),
      icon: ArrowUpRight,
      color: 'green',
      loading,
    },
    {
      title: t('dashboard.totalExpenses'),
      value: summaryStatValue(stats.journal, (s) => formatAccountingCurrency(s.totalExpenses)),
      icon: ArrowDownRight,
      color: 'red',
      loading,
    },
    {
      title: t('dashboard.vatOwed'),
      value: summaryStatValue(stats.vatOwed, (v) => formatAccountingCurrency(v)),
      icon: DollarSign,
      color: 'orange',
      loading,
    },
    {
      title: t('dashboard.pendingInvoices'),
      value: summaryStatValue(stats.invoices, (s) => s.unpaidCount),
      icon: FileWarning,
      color: 'blue',
      loading,
    },
  ];

  // ADR-229 Phase 2: Data-level loading guard
  if (loading) {
    return (
      <main className="min-h-screen bg-background">
        <PageLoadingState icon={Receipt} message={t('dashboard.loading')} layout="contained" />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      {/* Page Header */}
      <header className="border-b border-border bg-card p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t('pages.dashboard')}</h1>
            <p className={cn("text-sm mt-1", colors.text.muted)}>
              {selectedYear}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-32">
              <FiscalYearPicker value={selectedYear} onValueChange={setSelectedYear} />
            </div>
            <Button onClick={() => router.push('/accounting/invoices/new')}>
              <Plus className="mr-2 h-4 w-4" />
              {t('invoices.newInvoice')}
            </Button>
          </div>
        </div>
      </header>

      {/* Stats Dashboard */}
      <UnifiedDashboard stats={dashboardStats} columns={4} />

      {/* Quick Actions */}
      <section className="p-6">
        <Card>
          <CardHeader>
            <CardTitle>{t('dashboard.quickActions')}</CardTitle>
          </CardHeader>
          <CardContent>
            <nav className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <Button
                variant="outline"
                className="justify-start h-auto py-3"
                onClick={() => router.push('/accounting/invoices')}
              >
                <Receipt className={cn("mr-3 h-5 w-5", colors.text.muted)} />
                <span>{t('pages.invoices')}</span>
              </Button>
              <Button
                variant="outline"
                className="justify-start h-auto py-3"
                onClick={() => router.push('/accounting/journal')}
              >
                <BookOpen className={cn("mr-3 h-5 w-5", colors.text.muted)} />
                <span>{t('pages.journal')}</span>
              </Button>
              <Button
                variant="outline"
                className="justify-start h-auto py-3"
                onClick={() => router.push('/accounting/vat')}
              >
                <DollarSign className={cn("mr-3 h-5 w-5", colors.text.muted)} />
                <span>{t('pages.vat')}</span>
              </Button>
              <Button
                variant="outline"
                className="justify-start h-auto py-3"
                onClick={() => router.push('/accounting/reports')}
              >
                <FileWarning className={cn("mr-3 h-5 w-5", colors.text.muted)} />
                <span>{t('pages.reports')}</span>
              </Button>
            </nav>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
