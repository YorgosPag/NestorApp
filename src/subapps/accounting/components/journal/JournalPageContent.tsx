'use client';

/**
 * @fileoverview Journal Page Content — Βιβλίο Εσόδων-Εξόδων
 * @description AccountingPageHeader + UnifiedDashboard toggle + AdvancedFiltersPanel + JournalEntriesTable + inline form
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-02-09
 * @updated 2026-02-10 — Collapsible dashboard via AccountingPageHeader
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, no inline styles
 */

import { useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Plus,
  BookOpen,
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  FileText,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { UnifiedDashboard } from '@/components/property-management/dashboard/UnifiedDashboard';
import type { DashboardStat } from '@/components/property-management/dashboard/UnifiedDashboard';
import { AdvancedFiltersPanel } from '@/components/core/AdvancedFilters/AdvancedFiltersPanel';
import type { FilterPanelConfig, GenericFilterState } from '@/components/core/AdvancedFilters/types';
import { formatCurrency } from '../../utils/format';
import { AccountingPageHeader } from '../shared/AccountingPageHeader';
import { useJournalEntries } from '../../hooks/useJournalEntries';
import type { EntryType, FiscalQuarter } from '@/subapps/accounting/types';
import { JournalEntriesTable } from './JournalEntriesTable';
import { JournalEntryForm } from './JournalEntryForm';

// ============================================================================
// TYPES
// ============================================================================

interface JournalFilterState extends GenericFilterState {
  fiscalYear: string;
  type: string;
  quarter: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_FILTERS: JournalFilterState = {
  fiscalYear: String(new Date().getFullYear()),
  type: 'all',
  quarter: 'all',
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
        id: 'journal-main',
        fields: [
          {
            id: 'fiscalYear',
            type: 'select',
            label: 'filterLabels.fiscalYear',
            ariaLabel: 'Fiscal year',
            width: 1,
            options: [
              { value: String(new Date().getFullYear()), label: String(new Date().getFullYear()) },
              { value: String(new Date().getFullYear() - 1), label: String(new Date().getFullYear() - 1) },
              { value: String(new Date().getFullYear() - 2), label: String(new Date().getFullYear() - 2) },
            ],
          },
          {
            id: 'type',
            type: 'select',
            label: 'filterLabels.type',
            ariaLabel: 'Entry type',
            width: 1,
            options: [
              { value: 'all', label: t('filterOptions.allTypes') },
              { value: 'income', label: t('journal.income') },
              { value: 'expense', label: t('journal.expense') },
            ],
          },
          {
            id: 'quarter',
            type: 'select',
            label: 'filterLabels.quarter',
            ariaLabel: 'Quarter',
            width: 1,
            options: [
              { value: 'all', label: t('filterOptions.allQuarters') },
              { value: 'Q1', label: 'Q1 — ' + t('common.months.1') + '-' + t('common.months.3') },
              { value: 'Q2', label: 'Q2 — ' + t('common.months.4') + '-' + t('common.months.6') },
              { value: 'Q3', label: 'Q3 — ' + t('common.months.7') + '-' + t('common.months.9') },
              { value: 'Q4', label: 'Q4 — ' + t('common.months.10') + '-' + t('common.months.12') },
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

export function JournalPageContent() {
  const { t } = useTranslation('accounting');

  const [showForm, setShowForm] = useState(false);
  const [filters, setFilters] = useState<JournalFilterState>({ ...DEFAULT_FILTERS });
  const [showDashboard, setShowDashboard] = useState(true);

  const filterConfig = useMemo(() => buildFilterConfig(t), [t]);

  // Build hook options from filter state
  const hookOptions = {
    fiscalYear: Number(filters.fiscalYear),
    ...(filters.type && filters.type !== 'all' ? { type: filters.type as EntryType } : {}),
    ...(filters.quarter && filters.quarter !== 'all' ? { quarter: filters.quarter as unknown as FiscalQuarter } : {}),
  };

  const { entries, loading, error, refetch } = useJournalEntries(hookOptions);

  const handleFormSuccess = useCallback(() => {
    setShowForm(false);
    refetch();
  }, [refetch]);

  const handleFormCancel = useCallback(() => {
    setShowForm(false);
  }, []);

  // Compute dashboard stats
  const dashboardStats: DashboardStat[] = useMemo(() => {
    const totalIncome = entries
      .filter((e) => e.type === 'income')
      .reduce((s, e) => s + e.grossAmount, 0);
    const totalExpenses = entries
      .filter((e) => e.type === 'expense')
      .reduce((s, e) => s + e.grossAmount, 0);
    const netResult = totalIncome - totalExpenses;

    return [
      {
        title: t('dashboard.totalIncome'),
        value: formatCurrency(totalIncome),
        icon: ArrowUpRight,
        color: 'green' as const,
        loading,
      },
      {
        title: t('dashboard.totalExpenses'),
        value: formatCurrency(totalExpenses),
        icon: ArrowDownRight,
        color: 'red' as const,
        loading,
      },
      {
        title: t('dashboard.netResult'),
        value: formatCurrency(netResult),
        icon: TrendingUp,
        color: netResult >= 0 ? 'green' as const : 'red' as const,
        loading,
      },
      {
        title: t('dashboard.entryCount'),
        value: entries.length,
        icon: FileText,
        color: 'blue' as const,
        loading,
      },
    ];
  }, [entries, loading, t]);

  return (
    <main className="min-h-screen bg-background">
      {/* Page Header */}
      <AccountingPageHeader
        icon={BookOpen}
        titleKey="journal.title"
        descriptionKey="journal.description"
        showDashboard={showDashboard}
        onDashboardToggle={() => setShowDashboard(!showDashboard)}
        actions={
          !showForm
            ? [
                <Button key="new-entry" onClick={() => setShowForm(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  {t('journal.newEntry')}
                </Button>,
              ]
            : undefined
        }
      />

      {/* Stats Dashboard */}
      {!showForm && showDashboard && <UnifiedDashboard stats={dashboardStats} columns={4} />}

      {/* Filters */}
      {!showForm && (
        <AdvancedFiltersPanel
          config={filterConfig}
          filters={filters}
          onFiltersChange={setFilters}
          defaultFilters={DEFAULT_FILTERS}
        />
      )}

      {/* Content Area */}
      <section className="p-6">
        {showForm ? (
          <JournalEntryForm onSuccess={handleFormSuccess} onCancel={handleFormCancel} />
        ) : loading ? (
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
        ) : entries.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-lg font-medium text-foreground mb-1">{t('journal.noEntries')}</p>
            <p className="text-muted-foreground mb-4">{t('journal.noEntriesDescription')}</p>
            <Button onClick={() => setShowForm(true)}>
              <Plus className="mr-2 h-4 w-4" />
              {t('journal.newEntry')}
            </Button>
          </div>
        ) : (
          <JournalEntriesTable entries={entries} />
        )}
      </section>
    </main>
  );
}
