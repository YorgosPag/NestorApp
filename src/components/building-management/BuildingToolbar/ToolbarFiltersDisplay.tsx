'use client';

import React, { useMemo } from 'react';
import { CommonBadge } from '@/core/badges';
import { Button } from '@/components/ui/button';
import { HOVER_TEXT_EFFECTS } from '@/components/ui/effects';
import { X } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
// 🏢 ENTERPRISE: i18n - Full internationalization support
import { useTranslation } from '@/i18n/hooks/useTranslation';
// 🏢 ENTERPRISE: Centralized building features translation utility
import { translateBuildingFeature } from '@/utils/building-features-i18n';

interface ToolbarFiltersDisplayProps {
  activeFilters: string[];
  onActiveFiltersChange: (filters: string[]) => void;
}

export function ToolbarFiltersDisplay({
  activeFilters,
  onActiveFiltersChange
}: ToolbarFiltersDisplayProps) {
  // 🏢 ENTERPRISE: i18n hook for translations
  const { t, isNamespaceReady } = useTranslation('building');
  const iconSizes = useIconSizes();

  // 🏢 ENTERPRISE: Translate filter label using centralized utility
  const translateFilter = useMemo(() => {
    return (filter: string): string => {
      return translateBuildingFeature(filter, t, isNamespaceReady);
    };
  }, [t, isNamespaceReady]);

  const handleRemoveFilter = (filterToRemove: string) => {
    onActiveFiltersChange(activeFilters.filter(f => f !== filterToRemove));
  };

  const handleClearAll = () => {
    onActiveFiltersChange([]);
  };

  return (
    <div className="px-2 pb-2 border-t border-border/50">
      <div className="flex items-center gap-2 pt-2">
        <span className="text-xs text-muted-foreground">{t('filtersDisplay.activeFilters')}</span>
        <div className="flex flex-wrap gap-1">
          {activeFilters.map((filter) => (
            <CommonBadge
              key={filter}
              status="building"
              customLabel={
                <div className="flex items-center gap-1">
                  {translateFilter(filter)}
                  <button
                    onClick={() => handleRemoveFilter(filter)}
                    className={`ml-1 ${HOVER_TEXT_EFFECTS.DESTRUCTIVE}`}
                  >
                    <X className={iconSizes.xs} />
                  </button>
                </div>
              }
              variant="secondary"
              className="text-xs px-2 py-0.5"
            />
          ))}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearAll}
            className="h-6 px-2 text-xs"
          >
            {t('filtersDisplay.clearAll')}
          </Button>
        </div>
      </div>
    </div>
  );
}
