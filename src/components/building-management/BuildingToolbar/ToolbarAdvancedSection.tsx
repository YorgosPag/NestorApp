'use client';

import React from 'react';
import { ToolbarButton } from '@/components/ui/ToolbarButton';
import { BuildingBadge } from '@/core/badges';
import {
  Copy,
  Archive,
  Star,
  Share,
  MapPin,
  BarChart3,
  Calendar
} from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
// 🏢 ENTERPRISE: i18n - Full internationalization support
import { useTranslation } from '@/i18n/hooks/useTranslation';

interface ToolbarAdvancedSectionProps {
  selectedItems: number[];
  activeFilters: string[];
}

export function ToolbarAdvancedSection({
  selectedItems,
  activeFilters
}: ToolbarAdvancedSectionProps) {
  // 🏢 ENTERPRISE: i18n hook for translations
  const { t } = useTranslation('building');
  const iconSizes = useIconSizes();
  return (
    <div className="px-2 pb-2 border-t border-border/50">
      <div className="flex items-center gap-1 pt-2">
        <ToolbarButton
          tooltip={t('toolbar.advanced.copy')}
          disabled={selectedItems.length === 0}
        >
          <Copy className={iconSizes.sm} />
        </ToolbarButton>

        <ToolbarButton
          tooltip={t('toolbar.advanced.archive')}
          disabled={selectedItems.length === 0}
        >
          <Archive className={iconSizes.sm} />
        </ToolbarButton>

        <ToolbarButton
          tooltip={t('toolbar.advanced.addToFavorites')}
          disabled={selectedItems.length === 0}
        >
          <Star className={iconSizes.sm} />
        </ToolbarButton>

        <ToolbarButton
          tooltip={t('toolbar.advanced.share')}
          disabled={selectedItems.length === 0}
        >
          <Share className={iconSizes.sm} />
        </ToolbarButton>

        <div className={`w-px ${iconSizes.lg} bg-border mx-2`} />

        <ToolbarButton
          tooltip={t('toolbar.advanced.viewOnMap')}
          disabled={selectedItems.length === 0}
        >
          <MapPin className={iconSizes.sm} />
        </ToolbarButton>

        <ToolbarButton
          tooltip={t('toolbar.advanced.createReport')}
          disabled={selectedItems.length === 0}
        >
          <BarChart3 className={iconSizes.sm} />
        </ToolbarButton>

        <ToolbarButton
          tooltip={t('toolbar.advanced.scheduleVisit')}
          disabled={selectedItems.length === 0}
        >
          <Calendar className={iconSizes.sm} />
        </ToolbarButton>

        <div className="flex-1" />

        {/* Status Indicators */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {selectedItems.length > 0 && (
            <BuildingBadge
              status="occupied"
              customLabel={t('toolbar.advanced.selectedCount', { count: selectedItems.length })}
              variant="secondary"
              className="text-xs"
            />
          )}
          {activeFilters.length > 0 && (
            <BuildingBadge
              status="partially-occupied"
              customLabel={t('toolbar.advanced.activeFilters', { count: activeFilters.length })}
              variant="outline"
              className="text-xs"
            />
          )}
          <span className="flex items-center gap-1">
            <div className={`${iconSizes.xs} bg-green-500 rounded-full animate-pulse`} />
            {t('toolbar.advanced.synced')}
          </span>
        </div>
      </div>
    </div>
  );
}