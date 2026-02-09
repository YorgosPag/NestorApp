'use client';

/**
 * @fileoverview Accounting Subapp — Fixed Assets Page Content
 * @description Main page for fixed assets management with filters and CRUD
 * @author Claude Code (Anthropic AI) + Georgios Pagonis
 * @created 2026-02-09
 * @version 1.0.0
 * @see ADR-ACC-007 Fixed Assets & Depreciation
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, no inline styles, semantic HTML
 */

import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { AssetCategory, AssetStatus, CreateFixedAssetInput } from '@/subapps/accounting/types';
import { useFixedAssets } from '../../hooks/useFixedAssets';
import { AssetsList } from './AssetsList';
import { AddAssetForm } from './AddAssetForm';

// ============================================================================
// TYPES
// ============================================================================

interface AssetFilterState {
  category: AssetCategory | '';
  status: AssetStatus | '';
}

// ============================================================================
// CONSTANTS
// ============================================================================

const ASSET_CATEGORIES: AssetCategory[] = [
  'buildings',
  'machinery',
  'vehicles',
  'furniture',
  'computers',
  'measurement_instruments',
  'other',
];

const ASSET_STATUSES: AssetStatus[] = ['active', 'fully_depreciated', 'disposed', 'inactive'];

// ============================================================================
// COMPONENT
// ============================================================================

export function AssetsPageContent() {
  const { t } = useTranslation('accounting');

  const [filters, setFilters] = useState<AssetFilterState>({
    category: '',
    status: '',
  });

  const [addDialogOpen, setAddDialogOpen] = useState(false);

  const { assets, loading, error, refetch, createAsset } = useFixedAssets({
    category: filters.category || undefined,
    status: filters.status || undefined,
  });

  const handleFilterChange = useCallback((partial: Partial<AssetFilterState>) => {
    setFilters((prev) => ({ ...prev, ...partial }));
  }, []);

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

  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t('assets.title')}</h1>
            <p className="text-sm text-muted-foreground mt-1">{t('assets.description')}</p>
          </div>
          <Button onClick={() => setAddDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            {t('assets.addAsset')}
          </Button>
        </div>

        {/* Filters */}
        <nav className="flex flex-wrap gap-3" aria-label={t('assets.filters')}>
          {/* Category Filter */}
          <div className="w-48">
            <Select
              value={filters.category || 'all'}
              onValueChange={(v) =>
                handleFilterChange({ category: v === 'all' ? '' : (v as AssetCategory) })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder={t('assets.category')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('common.all')}</SelectItem>
                {ASSET_CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {t(`assets.categories.${cat}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Status Filter */}
          <div className="w-44">
            <Select
              value={filters.status || 'all'}
              onValueChange={(v) =>
                handleFilterChange({ status: v === 'all' ? '' : (v as AssetStatus) })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder={t('assets.status')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('common.all')}</SelectItem>
                {ASSET_STATUSES.map((st) => (
                  <SelectItem key={st} value={st}>
                    {t(`assets.statuses.${st}`)}
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
