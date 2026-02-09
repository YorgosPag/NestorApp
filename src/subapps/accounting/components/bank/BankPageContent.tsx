'use client';

/**
 * @fileoverview Accounting Subapp — Bank Page Content
 * @description Main page component for bank reconciliation with filters and CSV import
 * @author Claude Code (Anthropic AI) + Georgios Pagonis
 * @created 2026-02-09
 * @version 1.0.0
 * @see ADR-ACC-008 Bank Reconciliation
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, no inline styles, semantic HTML
 */

import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { TransactionDirection, MatchStatus } from '@/subapps/accounting/types';
import { useBankTransactions } from '../../hooks/useBankTransactions';
import { TransactionsList } from './TransactionsList';
import { ImportCSVDialog } from './ImportCSVDialog';

// ============================================================================
// TYPES
// ============================================================================

interface BankFilterState {
  accountId: string;
  direction: TransactionDirection | '';
  matchStatus: MatchStatus | '';
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DIRECTION_OPTIONS: TransactionDirection[] = ['credit', 'debit'];

const MATCH_STATUS_OPTIONS: MatchStatus[] = [
  'unmatched',
  'auto_matched',
  'manual_matched',
  'excluded',
];

// ============================================================================
// COMPONENT
// ============================================================================

export function BankPageContent() {
  const { t } = useTranslation('accounting');

  const [filters, setFilters] = useState<BankFilterState>({
    accountId: '',
    direction: '',
    matchStatus: '',
  });

  const [importDialogOpen, setImportDialogOpen] = useState(false);

  const { transactions, loading, error, refetch, importTransactions } = useBankTransactions({
    accountId: filters.accountId || undefined,
    direction: filters.direction || undefined,
    matchStatus: filters.matchStatus || undefined,
  });

  const handleFilterChange = useCallback((partial: Partial<BankFilterState>) => {
    setFilters((prev) => ({ ...prev, ...partial }));
  }, []);

  const handleImportSuccess = useCallback(async () => {
    setImportDialogOpen(false);
    await refetch();
  }, [refetch]);

  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t('bank.title')}</h1>
            <p className="text-sm text-muted-foreground mt-1">{t('bank.description')}</p>
          </div>
          <Button onClick={() => setImportDialogOpen(true)}>
            <Upload className="mr-2 h-4 w-4" />
            {t('bank.importCSV')}
          </Button>
        </div>

        {/* Filters */}
        <nav className="flex flex-wrap gap-3" aria-label={t('bank.filters')}>
          {/* Account Filter */}
          <div className="w-48">
            <Select
              value={filters.accountId || 'all'}
              onValueChange={(v) =>
                handleFilterChange({ accountId: v === 'all' ? '' : v })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder={t('bank.account')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('common.all')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Direction Filter */}
          <div className="w-40">
            <Select
              value={filters.direction || 'all'}
              onValueChange={(v) =>
                handleFilterChange({
                  direction: v === 'all' ? '' : (v as TransactionDirection),
                })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder={t('bank.direction')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('common.all')}</SelectItem>
                {DIRECTION_OPTIONS.map((dir) => (
                  <SelectItem key={dir} value={dir}>
                    {t(`bank.directions.${dir}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Match Status Filter */}
          <div className="w-44">
            <Select
              value={filters.matchStatus || 'all'}
              onValueChange={(v) =>
                handleFilterChange({
                  matchStatus: v === 'all' ? '' : (v as MatchStatus),
                })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder={t('bank.matchStatus')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('common.all')}</SelectItem>
                {MATCH_STATUS_OPTIONS.map((status) => (
                  <SelectItem key={status} value={status}>
                    {t(`bank.matchStatuses.${status}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </nav>
      </header>

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
