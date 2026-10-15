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
import { AssetsList } from './AssetsList';
import { AddAssetForm } from './AddAssetForm';

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
  const { t } = useTranslation(['accounting', 'accounting-setup', 'accounting-tax-offices']);
  const colors = useSemanticColors();

  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [showDashboard, setShowDashboard] = useState(true);

  const filterConfig = useMemo(() => buildFilterConfig(t), [t]);
  const { filters, filterPanel } = useAccountingFilterPanel<AssetFilterState>(DEFAULT_FILTERS, filterConfig);

  const assetList = useFixedAssets({
    category: filters.category !== 'all' ? (filters.category as AssetCategory) : undefined,
    status: filters.status !== 'all' ? (filters.status as AssetStatus) : undefined,
  });

  const { items: assets, loading, refetch, createAsset } = assetList;

  const handleCreateAsset = useCallback(
    async (data: CreateFixedAssetInput) => {
      const result = await createAsset(data);
      setAddDialogOpen(false);
      return result;
    },
    [createAsset],
  );

  // Compute dashboard stats
  const dashboardStats: DashboardStat[] = useMemo(() => {
    const totalValue = (assets ?? []).reduce((s, a) => s + a.acquisitionCost, 0);
    const totalDepreciation = (assets ?? []).reduce((s, a) => s + a.accumulatedDepreciation, 0);
    const netBookValue = totalValue - totalDepreciation;

    return [
      {
        title: t('dashboard.totalAssets'),
        value: assets.length,
        icon: Package,
        color: 'blue' as const,
        loading,
      },
      {
        title: t('dashboard.totalValue'),
        value: formatAccountingCurrency(totalValue),
        icon: DollarSign,
        color: 'green' as const,
        loading,
      },
      {
        title: t('dashboard.totalDepreciation'),
        value: formatAccountingCurrency(totalDepreciation),
        icon: TrendingDown,
        color: 'orange' as const,
        loading,
      },
      {
        title: t('dashboard.netBookValue'),
        value: formatAccountingCurrency(netBookValue),
        icon: BarChart3,
        color: 'purple' as const,
        loading,
      },
    ];
  }, [assets, loading, t]);

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
    </main>
  );
}
