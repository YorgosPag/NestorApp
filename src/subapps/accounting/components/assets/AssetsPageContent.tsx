'use client';

/**
 * @fileoverview Fixed Assets Page Content — Πάγια Στοιχεία
 * @description AccountingPageHeader + UnifiedDashboard toggle + AdvancedFiltersPanel + AssetsList + AddAssetForm
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-02-09
 * @updated 2026-02-10 — Collapsible dashboard via AccountingPageHeader
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, no inline styles, semantic HTML
 */

import { useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Plus,
  HardDrive,
  Package,
  DollarSign,
  TrendingDown,
  BarChart3,
  CalendarCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { DashboardStat } from '@/components/property-management/dashboard/UnifiedDashboard';
import type { FilterPanelConfig, GenericFilterState } from '@/components/core/AdvancedFilters/types';
import { ASSET_CATEGORIES, ASSET_STATUSES } from '@/subapps/accounting/types';
import type { AssetCategory, AssetStatus, CreateFixedAssetInput } from '@/subapps/accounting/types';
import { formatAccountingCurrency } from '../../utils/format';
import { AccountingPageHeader } from '../shared/AccountingPageHeader';
import { PagedListSection } from '../shared/PagedListSection';
import { AccountingListBody } from '../shared/AccountingListBody';
import { useAccountingFilterPanel } from '../../hooks/useAccountingFilterPanel';
import { useFixedAssets } from '../../hooks/useFixedAssets';
import { useListSummary } from '../../hooks/useListSummary';
import type { FixedAssetListSummary } from '../../services/list-summaries/fixed-asset-list-summary';
import { summaryStatValue } from '../shared/summary-stat-value';
import { API_ROUTES } from '@/config/domain-constants';
import { AssetsList } from './AssetsList';
import { AddAssetForm } from './AddAssetForm';
import { DepreciationRunDialog } from './DepreciationRunDialog';

import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

import { cn } from '@/lib/utils';

// ============================================================================
// TYPES
// ============================================================================

interface AssetFilterState extends GenericFilterState {
  category: string;
  status: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_FILTERS: AssetFilterState = {
  category: 'all',
  status: 'all',
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
        id: 'assets-main',
        fields: [
          {
            id: 'category',
            type: 'select',
            label: 'filterLabels.category',
            ariaLabel: 'Asset category',
            width: 1,
            // Από τη ΡΙΖΑ του λεξιλογίου: ως 2026-10-15 το φίλτρο είχε δικό του σύνολο (computer_equipment, tools…)
            // που η φόρμα δεν αποθήκευε ποτέ ⇒ κάθε επιλογή έφερνε «κανένα πάγιο».
            options: [
              { value: 'all', label: t('filterOptions.allCategories') },
              ...ASSET_CATEGORIES.map((category) => ({ value: category, label: t(`assets.categories.${category}`) })),
            ],
          },
          {
            id: 'status',
            type: 'select',
            label: 'filterLabels.status',
            ariaLabel: 'Asset status',
            width: 1,
            options: [
              { value: 'all', label: t('filterOptions.allStatuses') },
              ...ASSET_STATUSES.map((status) => ({ value: status, label: t(`assets.statuses.${status}`) })),
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

export function AssetsPageContent() {
  const { t } = useTranslation(['accounting', 'accounting-tax-offices']);
  const colors = useSemanticColors();

  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [depreciationOpen, setDepreciationOpen] = useState(false);
  const [showDashboard, setShowDashboard] = useState(true);

  const filterConfig = useMemo(() => buildFilterConfig(t), [t]);
  const { filters, filterPanel } = useAccountingFilterPanel<AssetFilterState>(DEFAULT_FILTERS, filterConfig);

  const listFilters = {
    category: filters.category !== 'all' ? (filters.category as AssetCategory) : undefined,
    status: filters.status !== 'all' ? (filters.status as AssetStatus) : undefined,
  };
  const assetList = useFixedAssets(listFilters);
  const { refetch: refetchList, createAsset } = assetList;

  // 🔴 ADR-ACC-010 §2.1.1 — οι κάρτες από τον ΔΙΑΚΟΜΙΣΤΗ, πάνω σε ΟΛΗ την εμβέλεια των ίδιων φίλτρων: αξίες μόνο των
  //    παγίων στην κατοχή, αναπόσβεστη = η αποθηκευμένη (ως 2026-10-30: φορτωμένη σελίδα, με τα εκποιημένα μέσα).
  const { data: summary, loading: summaryLoading, refetch: refetchSummary } =
    useListSummary<FixedAssetListSummary>(API_ROUTES.ACCOUNTING.FIXED_ASSETS_SUMMARY, listFilters);

  // Καταχώριση αποσβέσεων / αλλαγή παγίου αλλάζει ΚΑΙ τις αξίες των καρτών.
  const refetch = useCallback(async () => {
    await Promise.all([refetchList(), refetchSummary()]);
  }, [refetchList, refetchSummary]);

  const handleCreateAsset = useCallback(
    async (data: CreateFixedAssetInput) => {
      const result = await createAsset(data);
      setAddDialogOpen(false);
      void refetchSummary();
      return result;
    },
    [createAsset, refetchSummary],
  );

  const dashboardStats: DashboardStat[] = useMemo(() => [
    {
      title: t('dashboard.totalAssets'),
      value: summaryStatValue(summary, (s) => s.assetCount),
      icon: Package,
      color: 'blue' as const,
      loading: summaryLoading,
    },
    {
      title: t('dashboard.totalValue'),
      value: summaryStatValue(summary, (s) => formatAccountingCurrency(s.totalCost)),
      icon: DollarSign,
      color: 'green' as const,
      loading: summaryLoading,
    },
    {
      title: t('dashboard.totalDepreciation'),
      value: summaryStatValue(summary, (s) => formatAccountingCurrency(s.totalAccumulatedDepreciation)),
      icon: TrendingDown,
      color: 'orange' as const,
      loading: summaryLoading,
    },
    {
      title: t('dashboard.netBookValue'),
      value: summaryStatValue(summary, (s) => formatAccountingCurrency(s.netBookValue)),
      icon: BarChart3,
      color: 'purple' as const,
      loading: summaryLoading,
    },
  ], [summary, summaryLoading, t]);

  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <AccountingPageHeader
        icon={HardDrive}
        titleKey="assets.title"
        descriptionKey="assets.description"
        showDashboard={showDashboard}
        onDashboardToggle={() => setShowDashboard(!showDashboard)}
        actions={[
          <Button key="depreciation-run" variant="outline" onClick={() => setDepreciationOpen(true)}>
            <CalendarCheck className="mr-2 h-4 w-4" />
            {t('assets.depreciationRun.open')}
          </Button>,
          <Button key="add-asset" onClick={() => setAddDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            {t('assets.addAsset')}
          </Button>,
        ]}
      />

      <AccountingListBody
        showDashboard={showDashboard}
        stats={dashboardStats}
        filterPanel={filterPanel}
      >
        <PagedListSection
          list={assetList}
          icon={HardDrive}
          loadingKey="assets.loading"
          loadErrorKey="assets.loadError"
          empty={
            <div className="text-center py-12">
              <p className="text-lg font-medium text-foreground mb-1">{t('assets.noAssets')}</p>
              <p className={cn("mb-4", colors.text.muted)}>{t('assets.noAssetsDescription')}</p>
              <Button onClick={() => setAddDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                {t('assets.addAsset')}
              </Button>
            </div>
          }
        >
          {(items) => <AssetsList assets={items} onRefresh={refetch} />}
        </PagedListSection>
      </AccountingListBody>

      {/* Add Asset Dialog */}
      <AddAssetForm
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onSubmit={handleCreateAsset}
      />

      {/* Αποσβέσεις χρήσης — ADR-ACC-010 §2.1.1 Φάση 5 */}
      <DepreciationRunDialog open={depreciationOpen} onOpenChange={setDepreciationOpen} onPosted={refetch} />
    </main>
  );
}
