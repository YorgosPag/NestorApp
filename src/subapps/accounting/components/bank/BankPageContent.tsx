'use client';

/**
 * @fileoverview Bank Page Content — Συμφωνία Τράπεζας
 * @description UnifiedDashboard stats + AdvancedFiltersPanel + TransactionsList + CSV import
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-02-09
 * @updated 2026-02-10 — Migrated to UnifiedDashboard + AdvancedFiltersPanel
 * @see ADR-ACC-008 Bank Reconciliation
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, no inline styles, semantic HTML
 */

import { useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Upload,
  Landmark,
  ArrowUpRight,
  ArrowDownRight,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { UnifiedDashboard } from '@/components/property-management/dashboard/UnifiedDashboard';
import type { DashboardStat } from '@/components/property-management/dashboard/UnifiedDashboard';
import { AdvancedFiltersPanel } from '@/components/core/AdvancedFilters/AdvancedFiltersPanel';
import type { FilterPanelConfig, GenericFilterState } from '@/components/core/AdvancedFilters/types';
import type { TransactionDirection, MatchStatus } from '@/subapps/accounting/types';
import { useBankTransactions } from '../../hooks/useBankTransactions';
import { TransactionsList } from './TransactionsList';
import { ImportCSVDialog } from './ImportCSVDialog';

// ============================================================================
// TYPES
// ============================================================================

interface BankFilterState extends GenericFilterState {
  direction: string;
  matchStatus: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_FILTERS: BankFilterState = {
  direction: 'all',
  matchStatus: 'all',
};

// ============================================================================
// HELPERS
// ============================================================================

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('el-GR', { style: 'currency', currency: 'EUR' }).format(amount);
}

function buildFilterConfig(t: (key: string) => string): FilterPanelConfig {
  return {
    title: 'filters.title',
    i18nNamespace: 'accounting',
    rows: [
      {
        id: 'bank-main',
        fields: [
          {
            id: 'direction',
            type: 'select',
            label: 'filterLabels.direction',
            ariaLabel: 'Transaction direction',
            width: 1,
            options: [
              { value: 'all', label: t('filterOptions.allDirections') },
              { value: 'credit', label: t('bank.credit') },
              { value: 'debit', label: t('bank.debit') },
            ],
          },
          {
            id: 'matchStatus',
            type: 'select',
            label: 'filterLabels.matchStatus',
            ariaLabel: 'Match status',
            width: 1,
            options: [
              { value: 'all', label: t('filterOptions.allStatuses') },
              { value: 'unmatched', label: t('bank.statuses.unmatched') },
              { value: 'matched', label: t('bank.statuses.matched') },
              { value: 'manual', label: t('bank.statuses.manual') },
              { value: 'excluded', label: t('bank.statuses.excluded') },
            ],
          },
        ],
      },
    ],
  };
}

// ============================================================================
// COMPONENT
// ============================================================================

export function BankPageContent() {
  const { t } = useTranslation('accounting');

  const [filters, setFilters] = useState<BankFilterState>({ ...DEFAULT_FILTERS });
  const [importDialogOpen, setImportDialogOpen] = useState(false);

  const filterConfig = useMemo(() => buildFilterConfig(t), [t]);

  const { transactions, loading, error, refetch, importTransactions } = useBankTransactions({
    direction: filters.direction !== 'all' ? (filters.direction as TransactionDirection) : undefined,
    matchStatus: filters.matchStatus !== 'all' ? (filters.matchStatus as MatchStatus) : undefined,
  });

  const handleImportSuccess = useCallback(async () => {
    setImportDialogOpen(false);
    await refetch();
  }, [refetch]);

  // Compute dashboard stats
  const dashboardStats: DashboardStat[] = useMemo(() => {
    const totalCredit = transactions
      .filter((tx) => tx.direction === 'credit')
      .reduce((s, tx) => s + Math.abs(tx.amount), 0);
    const totalDebit = transactions
      .filter((tx) => tx.direction === 'debit')
      .reduce((s, tx) => s + Math.abs(tx.amount), 0);
    const unmatchedCount = transactions.filter((tx) => tx.matchStatus === 'unmatched').length;

    return [
      {
        title: t('dashboard.totalTransactions'),
        value: transactions.length,
        icon: Landmark,
        color: 'blue' as const,
        loading,
      },
      {
        title: t('dashboard.totalCredit'),
        value: formatCurrency(totalCredit),
        icon: ArrowUpRight,
        color: 'green' as const,
        loading,
      },
      {
        title: t('dashboard.totalDebit'),
        value: formatCurrency(totalDebit),
        icon: ArrowDownRight,
        color: 'red' as const,
        loading,
      },
      {
        title: t('dashboard.unmatchedCount'),
        value: unmatchedCount,
        icon: AlertCircle,
        color: unmatchedCount > 0 ? 'orange' as const : 'green' as const,
        loading,
      },
    ];
  }, [transactions, loading, t]);

  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t('bank.title')}</h1>
            <p className="text-sm text-muted-foreground mt-1">{t('bank.description')}</p>
          </div>
          <Button onClick={() => setImportDialogOpen(true)}>
            <Upload className="mr-2 h-4 w-4" />
            {t('bank.importCSV')}
          </Button>
        </div>
      </header>

      {/* Stats Dashboard */}
      <UnifiedDashboard stats={dashboardStats} columns={4} />

      {/* Filters */}
      <AdvancedFiltersPanel
        config={filterConfig}
        filters={filters}
        onFiltersChange={setFilters}
        defaultFilters={DEFAULT_FILTERS}
      />

      {/* Content */}
      <section className="p-6">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Spinner size="large" />
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-destructive mb-2">{error}</p>
            <Button variant="outline" onClick={refetch}>
              {t('common.retry')}
            </Button>
          </div>
        ) : transactions.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-lg font-medium text-foreground mb-1">
              {t('bank.noTransactions')}
            </p>
            <p className="text-muted-foreground mb-4">
              {t('bank.noTransactionsDescription')}
            </p>
            <Button onClick={() => setImportDialogOpen(true)}>
              <Upload className="mr-2 h-4 w-4" />
              {t('bank.importCSV')}
            </Button>
          </div>
        ) : (
          <TransactionsList transactions={transactions} onRefresh={refetch} />
        )}
      </section>

      {/* Import CSV Dialog */}
      <ImportCSVDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        onImport={importTransactions}
        onSuccess={handleImportSuccess}
      />
    </main>
  );
}
