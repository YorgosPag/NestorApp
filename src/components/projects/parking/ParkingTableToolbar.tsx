'use client';

import React from 'react';

import { CommonBadge } from '@/core/badges';
import { INTERACTIVE_PATTERNS } from '@/components/ui/effects';
import {
  Plus,
  Minus,
  Save,
  RefreshCw,
  HelpCircle,
  Download,
  Upload
} from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import type { ParkingFilters, ParkingStats } from '@/types/parking';
import { ToolbarButton } from '@/components/ui/ToolbarButton';
import { ParkingStatsSummary } from './ParkingStatsSummary';
import { ParkingFilterPanel } from './ParkingFilterPanel';
// 🏢 ENTERPRISE: i18n - Full internationalization support
import { useTranslation } from '@/i18n/hooks/useTranslation';


interface ParkingTableToolbarProps {
  filters: ParkingFilters;
  onFiltersChange: (filters: Partial<ParkingFilters>) => void;
  stats: ParkingStats;
  onExport?: () => void;
  onImport?: () => void;
  onAdd?: () => void;
  onDelete?: () => void;
  onSave?: () => void;
  onRefresh?: () => void;
  selectedCount?: number;
}

export function ParkingTableToolbar({
  filters,
  onFiltersChange,
  stats,
  onExport,
  onImport,
  onAdd,
  onDelete,
  onSave,
  onRefresh,
  selectedCount = 0
}: ParkingTableToolbarProps) {
  // 🏢 ENTERPRISE: i18n hook for translations
  const { t } = useTranslation('building');
  const iconSizes = useIconSizes();
  const { quick } = useBorderTokens();

  return (
      <div className="space-y-4">
        {/* Action Toolbar */}
        <div className="flex items-center justify-between p-3 bg-muted/30 ${quick.card}">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <ToolbarButton
                tooltip={t('spaces.parking.toolbar.newSpot')}
                className={`text-green-600 dark:text-green-500 ${INTERACTIVE_PATTERNS.SUCCESS_HOVER}`}
                onClick={onAdd}
              >
                <Plus className={iconSizes.sm} />
              </ToolbarButton>

              <ToolbarButton
                tooltip={t('spaces.parking.toolbar.deleteSelected')}
                className={`text-red-600 dark:text-red-500 ${INTERACTIVE_PATTERNS.DESTRUCTIVE_HOVER}`}
                onClick={onDelete}
                disabled={selectedCount === 0}
              >
                <Minus className={iconSizes.sm} />
              </ToolbarButton>

              <div className="w-px h-6 bg-border mx-1" />

              <ToolbarButton
                tooltip={t('spaces.parking.toolbar.saveChanges')}
                onClick={onSave}
              >
                <Save className={iconSizes.sm} />
              </ToolbarButton>

              <ToolbarButton
                tooltip={t('spaces.parking.toolbar.refreshData')}
                onClick={onRefresh}
              >
                <RefreshCw className={iconSizes.sm} />
              </ToolbarButton>

              <div className="w-px h-6 bg-border mx-1" />

              <ToolbarButton
                tooltip={t('spaces.parking.toolbar.exportData')}
                onClick={onExport}
              >
                <Download className={iconSizes.sm} />
              </ToolbarButton>

              <ToolbarButton
                tooltip={t('spaces.parking.toolbar.importData')}
                onClick={onImport}
              >
                <Upload className={iconSizes.sm} />
              </ToolbarButton>
            </div>
            
            {selectedCount > 0 && (
              <CommonBadge
                status="company"
                customLabel={t('spaces.parking.toolbar.selectedCount', { count: selectedCount })}
                variant="secondary"
                className="ml-2"
              />
            )}
          </div>

          <div className="flex items-center gap-2">
            <ToolbarButton
              tooltip={t('spaces.parking.toolbar.help')}
            >
              <HelpCircle className={iconSizes.sm} />
            </ToolbarButton>
          </div>
        </div>

        <ParkingStatsSummary stats={stats} />
        <ParkingFilterPanel filters={filters} onFiltersChange={onFiltersChange} />
      </div>
  );
}
