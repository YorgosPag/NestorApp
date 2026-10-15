'use client';

/**
 * @fileoverview Bank Page Content — Συμφωνία Τράπεζας
 * @description AccountingPageHeader + UnifiedDashboard toggle + AdvancedFiltersPanel + TransactionsList + CSV import
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-02-09
 * @updated 2026-02-10 — Collapsible dashboard via AccountingPageHeader
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
import type { DashboardStat } from '@/components/property-management/dashboard/UnifiedDashboard';
import type { FilterPanelConfig, GenericFilterState } from '@/components/core/AdvancedFilters/types';
import type { TransactionDirection, MatchStatus } from '@/subapps/accounting/types';
import { formatAccountingCurrency } from '../../utils/format';
import { AccountingPageHeader } from '../shared/AccountingPageHeader';
import { PagedListSection } from '../shared/PagedListSection';
import { AccountingListBody } from '../shared/AccountingListBody';
import { useAccountingFilterPanel } from '../../hooks/useAccountingFilterPanel';
import { useBankTransactions } from '../../hooks/useBankTransactions';
import { useBankMatching } from '../../hooks/useBankMatching';
import { TransactionsList } from './TransactionsList';
import { MatchingPanel } from './MatchingPanel';
import { ImportCSVDialog } from './ImportCSVDialog';

import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

import { cn } from '@/lib/utils';

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
              // Τιμές του λεξιλογίου `MatchStatus`: ως 2026-10-15 έστελνε 'matched' / 'manual', που δεν
              // αποθηκεύονται ποτέ ⇒ «καμία κίνηση» σιωπηλά.
              { value: 'auto_matched', label: t('bank.statuses.matched') },
              { value: 'manual_matched', label: t('bank.statuses.manual') },
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
  const { t } = useTranslation(['accounting', 'accounting-setup', 'accounting-tax-offices']);
  const colors = useSemanticColors();

  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [showDashboard, setShowDashboard] = useState(true);
  const [selectedTransactionId, setSelectedTransactionId] = useState<string | null>(null);

  const filterConfig = useMemo(() => buildFilterConfig(t), [t]);
  const { filters, filterPanel } = useAccountingFilterPanel<BankFilterState>(DEFAULT_FILTERS, filterConfig);

  const {
    candidates,
    loadingCandidates,
    fetchCandidates,
    executeMatch,
    clearCandidates,
  } = useBankMatching();

  const bankList = useBankTransactions({
    direction: filters.direction !== 'all' ? (filters.direction as TransactionDirection) : undefined,
    matchStatus: filters.matchStatus !== 'all' ? (filters.matchStatus as MatchStatus) : undefined,
  });
  const { items: transactions, loading, refetch, importTransactions } = bankList;

  const handleImportSuccess = useCallback(async () => {
    setImportDialogOpen(false);
    await refetch();
  }, [refetch]);

  const handleSelectTransaction = useCallback((transactionId: string | null) => {
    setSelectedTransactionId(transactionId);
    if (transactionId) {
      fetchCandidates(transactionId);
    } else {
      clearCandidates();
    }
  }, [fetchCandidates, clearCandidates]);

  const handleMatch = useCallback(async (
    transactionId: string,
    entityId: string,
    entityType: string
  ) => {
    await executeMatch(transactionId, entityId, entityType);
    await refetch();
  }, [executeMatch, refetch]);

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
        value: formatAccountingCurrency(totalCredit),
        icon: ArrowUpRight,
        color: 'green' as const,
        loading,
      },
      {
        title: t('dashboard.totalDebit'),
        value: formatAccountingCurrency(totalDebit),
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
      <AccountingPageHeader
        icon={Landmark}
        titleKey="bank.title"
        descriptionKey="bank.description"
        showDashboard={showDashboard}
        onDashboardToggle={() => setShowDashboard(!showDashboard)}
        actions={[
          <Button key="import-csv" onClick={() => setImportDialogOpen(true)}>
            <Upload className="mr-2 h-4 w-4" />
            {t('bank.importCSV')}
          </Button>,
        ]}
      />

      <AccountingListBody
        showDashboard={showDashboard}
        stats={dashboardStats}
        filterPanel={filterPanel}
      >
        <PagedListSection
          list={bankList}
          icon={Landmark}
          loadingKey="bank.loading"
          loadErrorKey="bank.loadError"
          empty={
            <div className="text-center py-12">
              <p className="text-lg font-medium text-foreground mb-1">
                {t('bank.noTransactions')}
              </p>
              <p className={cn("mb-4", colors.text.muted)}>
                {t('bank.noTransactionsDescription')}
              </p>
              <Button onClick={() => setImportDialogOpen(true)}>
                <Upload className="mr-2 h-4 w-4" />
                {t('bank.importCSV')}
              </Button>
            </div>
          }
        >
          {(items) => <TransactionsList transactions={items} onRefresh={refetch} />}
        </PagedListSection>

        {/* Smart Matching Panel — side-by-side candidates (πάνω στις κινήσεις που έχουν φορτωθεί) */}
        {transactions.length > 0 && (
          <MatchingPanel
            transactions={transactions}
            candidates={candidates}
            loadingCandidates={loadingCandidates}
            selectedTransactionId={selectedTransactionId}
            onSelectTransaction={handleSelectTransaction}
            onMatch={handleMatch}
          />
        )}
      </AccountingListBody>

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
