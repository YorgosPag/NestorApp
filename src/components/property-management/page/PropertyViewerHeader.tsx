
'use client';

import React from 'react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { cn } from '@/lib/utils';
// 🏢 ENTERPRISE: Centralized entity/action icons (ZERO hardcoded values)
import { NAVIGATION_ENTITIES, NAVIGATION_ACTIONS } from '@/components/navigation/config';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { PropertyViewerFilters } from '@/components/property-viewer/PropertyViewerFilters';
import type { FilterState } from '@/types/property-viewer';
import { PageHeader } from '@/core/headers';
import type { ViewMode as CoreViewMode } from '@/core/headers';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('PropertyViewerHeader');

interface PropertyViewerHeaderProps {
  showDashboard: boolean;
  setShowDashboard: (show: boolean) => void;
  viewMode: 'list' | 'grid';
  setViewMode: (mode: 'list' | 'grid') => void;
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
}

export function PropertyViewerHeader({
  showDashboard,
  setShowDashboard,
  viewMode,
  setViewMode,
  filters,
  onFiltersChange
}: PropertyViewerHeaderProps) {
  const iconSizes = useIconSizes();
  // 🏢 ENTERPRISE: i18n support
  const { t } = useTranslation('common');

  return (
    <div className="shrink-0">
      <PageHeader
        variant="static"
        layout="single-row"
        title={{
          icon: NAVIGATION_ENTITIES.unit.icon,
          title: t('propertyViewer.title'),
          subtitle: t('propertyViewer.subtitle')
        }}
        actions={{
          showDashboard,
          onDashboardToggle: () => setShowDashboard(!showDashboard),
          viewMode: viewMode as CoreViewMode,
          onViewModeChange: (mode) => setViewMode(mode as 'list' | 'grid'),
          viewModes: ['list', 'grid'] as CoreViewMode[],
          addButton: {
            label: t('propertyViewer.newProperty'),
            onClick: () => logger.info('Add property')
          }
        }}
      />
      <div className="border-b bg-card p-4">
        <Collapsible>
          <CollapsibleTrigger asChild>
            <Button variant="outline" className="w-full justify-start p-4 text-sm font-semibold">
              <NAVIGATION_ACTIONS.filter.icon className={cn(iconSizes.sm, NAVIGATION_ACTIONS.filter.color, 'mr-2')}/>
              {t('filters.searchFilters')}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <PropertyViewerFilters filters={filters} onFiltersChange={onFiltersChange} />
          </CollapsibleContent>
        </Collapsible>
      </div>
    </div>
  );
}
