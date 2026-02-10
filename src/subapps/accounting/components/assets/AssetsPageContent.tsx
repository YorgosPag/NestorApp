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
import { Spinner } from '@/components/ui/spinner';
import { UnifiedDashboard } from '@/components/property-management/dashboard/UnifiedDashboard';
import type { DashboardStat } from '@/components/property-management/dashboard/UnifiedDashboard';
import { AdvancedFiltersPanel } from '@/components/core/AdvancedFilters/AdvancedFiltersPanel';
import type { FilterPanelConfig, GenericFilterState } from '@/components/core/AdvancedFilters/types';
import type { AssetCategory, AssetStatus, CreateFixedAssetInput } from '@/subapps/accounting/types';
import { formatCurrency } from '../../utils/format';
import { AccountingPageHeader } from '../shared/AccountingPageHeader';
import { useFixedAssets } from '../../hooks/useFixedAssets';
import { AssetsList } from './AssetsList';
import { AddAssetForm } from './AddAssetForm';

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
            options: [
              { value: 'all', label: t('filterOptions.allCategories') },
              { value: 'computer_equipment', label: t('assets.categories.computer_equipment') },
              { value: 'office_equipment', label: t('assets.categories.office_equipment') },
              { value: 'vehicles', label: t('assets.categories.vehicles') },
              { value: 'machinery', label: t('assets.categories.machinery') },
              { value: 'software', label: t('assets.categories.software') },
              { value: 'furniture', label: t('assets.categories.furniture') },
              { value: 'tools', label: t('assets.categories.tools') },
              { value: 'other', label: t('assets.categories.other') },
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
              { value: 'active', label: t('assets.statuses.active') },
              { value: 'fully_depreciated', label: t('assets.statuses.fully_depreciated') },
              { value: 'disposed', label: t('assets.statuses.disposed') },
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
  const { t } = useTranslation('accounting');

  const [filters, setFilters] = useState<AssetFilterState>({ ...DEFAULT_FILTERS });
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [showDashboard, setShowDashboard] = useState(true);

  const filterConfig = useMemo(() => buildFilterConfig(t), [t]);

  const { assets, loading, error, refetch, createAsset } = useFixedAssets({
    category: filters.category !== 'all' ? (filters.category as AssetCategory) : undefined,
    status: filters.status !== 'all' ? (filters.status as AssetStatus) : undefined,
  });

  const handleCreateAsset = useCallback(
    async (data: CreateFixedAssetInput) => {
      const result = await createAsset(data);
      if (result) {
        setAddDialogOpen(false);
      }
      return result;
    },
    [createAsset],
  );

  // Compute dashboard stats
  const dashboardStats: DashboardStat[] = useMemo(() => {
    const totalValue = assets.reduce((s, a) => s + a.acquisitionCost, 0);
    const totalDepreciation = assets.reduce((s, a) => s + a.accumulatedDepreciation, 0);
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
        value: formatCurrency(totalValue),
        icon: DollarSign,
        color: 'green' as const,
        loading,
      },
      {
        title: t('dashboard.totalDepreciation'),
        value: formatCurrency(totalDepreciation),
        icon: TrendingDown,
        color: 'orange' as const,
        loading,
      },
      {
        title: t('dashboard.netBookValue'),
        value: formatCurrency(netBookValue),
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

      {/* Stats Dashboard */}
      {showDashboard && <UnifiedDashboard stats={dashboardStats} columns={4} />}

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
        ) : assets.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-lg font-medium text-foreground mb-1">{t('assets.noAssets')}</p>
            <p className="text-muted-foreground mb-4">{t('assets.noAssetsDescription')}</p>
            <Button onClick={() => setAddDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              {t('assets.addAsset')}
            </Button>
          </div>
        ) : (
          <AssetsList assets={assets} onRefresh={refetch} />
        )}
      </section>

      {/* Add Asset Dialog */}
      <AddAssetForm
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onSubmit={handleCreateAsset}
      />
    </main>
  );
}
