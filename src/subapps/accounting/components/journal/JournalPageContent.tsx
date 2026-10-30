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
import { UnifiedDashboard } from '@/components/property-management/dashboard/UnifiedDashboard';
import type { DashboardStat } from '@/components/property-management/dashboard/UnifiedDashboard';
import { AdvancedFiltersPanel } from '@/components/core/AdvancedFilters/AdvancedFiltersPanel';
import type { FilterPanelConfig, GenericFilterState } from '@/components/core/AdvancedFilters/types';
import { formatAccountingCurrency } from '../../utils/format';
import { AccountingPageHeader } from '../shared/AccountingPageHeader';
import { PagedListSection } from '../shared/PagedListSection';
import { buildFiscalYearFilterField, currentFiscalYearValue } from '../shared/accounting-filter-fields';
import { useJournalEntries } from '../../hooks/useJournalEntries';
import { useListSummary } from '../../hooks/useListSummary';
import type { JournalListSummary } from '../../services/list-summaries/journal-list-summary';
import { summaryStatValue } from '../shared/summary-stat-value';
import { API_ROUTES } from '@/config/domain-constants';
import type { EntryType, FiscalQuarter } from '@/subapps/accounting/types';
import { JournalEntriesTable } from './JournalEntriesTable';
import { JournalEntryForm } from './JournalEntryForm';

import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

import { cn } from '@/lib/utils';

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
  fiscalYear: currentFiscalYearValue(),
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
          buildFiscalYearFilterField(),
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

/** Τιμή φίλτρου τριμήνου ('Q1'..'Q4' | 'all') → τρίμηνο της διαδρομής (1..4). */
function quarterOfFilter(value: string | undefined): FiscalQuarter | undefined {
  switch (value) {
    case 'Q1': return 1;
    case 'Q2': return 2;
    case 'Q3': return 3;
    case 'Q4': return 4;
    default: return undefined;
  }
}

// ============================================================================
// COMPONENT
// ============================================================================

export function JournalPageContent() {
  const { t } = useTranslation(['accounting', 'accounting-tax-offices']);
  const colors = useSemanticColors();

  const [showForm, setShowForm] = useState(false);
  const [filters, setFilters] = useState<JournalFilterState>({ ...DEFAULT_FILTERS });
  const [showDashboard, setShowDashboard] = useState(true);

  const filterConfig = useMemo(() => buildFilterConfig(t), [t]);

  // Build hook options from filter state. Το τρίμηνο του φίλτρου είναι 'Q1'..'Q4'· η διαδρομή θέλει 1..4 — ως
  // 2026-10-15 στελνόταν 'Q1', γινόταν NaN και το φίλτρο αγνοούνταν σιωπηλά (όλο το έτος ως «Q1»).
  const listFilters = {
    fiscalYear: Number(filters.fiscalYear),
    type: filters.type && filters.type !== 'all' ? (filters.type as EntryType) : undefined,
    quarter: quarterOfFilter(filters.quarter),
  };
  const journalList = useJournalEntries(listFilters);
  const { refetch: refetchList } = journalList;

  // 🔴 ADR-ACC-010 §2.1.1 — οι κάρτες από τον ΔΙΑΚΟΜΙΣΤΗ, πάνω σε ΟΛΗ την εμβέλεια των ίδιων φίλτρων, με ΚΑΘΑΡΑ ποσά
  //    (ως 2026-10-30: άθροισμα της φορτωμένης σελίδας, και μικτά — ο ΦΠΑ μετρούσε ως έσοδο/έξοδο).
  const { data: summary, loading: summaryLoading, refetch: refetchSummary } =
    useListSummary<JournalListSummary>(API_ROUTES.ACCOUNTING.JOURNAL_SUMMARY, listFilters);

  const handleFormSuccess = useCallback(() => {
    setShowForm(false);
    void Promise.all([refetchList(), refetchSummary()]);
  }, [refetchList, refetchSummary]);

  const handleFormCancel = useCallback(() => {
    setShowForm(false);
  }, []);

  const dashboardStats: DashboardStat[] = useMemo(() => {
    const netResult = summary?.netResult ?? 0;
    return [
      {
        title: t('dashboard.totalIncome'),
        value: summaryStatValue(summary, (s) => formatAccountingCurrency(s.totalIncome)),
        icon: ArrowUpRight,
        color: 'green' as const,
        loading: summaryLoading,
      },
      {
        title: t('dashboard.totalExpenses'),
        value: summaryStatValue(summary, (s) => formatAccountingCurrency(s.totalExpenses)),
        icon: ArrowDownRight,
        color: 'red' as const,
        loading: summaryLoading,
      },
      {
        title: t('dashboard.netResult'),
        value: summaryStatValue(summary, (s) => formatAccountingCurrency(s.netResult)),
        icon: TrendingUp,
        color: netResult >= 0 ? 'green' as const : 'red' as const,
        loading: summaryLoading,
      },
      {
        title: t('dashboard.entryCount'),
        value: summaryStatValue(summary, (s) => s.entryCount),
        icon: FileText,
        color: 'blue' as const,
        loading: summaryLoading,
      },
    ];
  }, [summary, summaryLoading, t]);

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
        ) : (
          <PagedListSection
            list={journalList}
            icon={BookOpen}
            loadingKey="journal.loading"
            loadErrorKey="journal.loadError"
            empty={
              <div className="text-center py-12">
                <p className="text-lg font-medium text-foreground mb-1">{t('journal.noEntries')}</p>
                <p className={cn("mb-4", colors.text.muted)}>{t('journal.noEntriesDescription')}</p>
                <Button onClick={() => setShowForm(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  {t('journal.newEntry')}
                </Button>
              </div>
            }
          >
            {(items) => <JournalEntriesTable entries={items} />}
          </PagedListSection>
        )}
      </section>
    </main>
  );
}
