
'use client';

import React from 'react';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { Filter } from 'lucide-react';
import { PropertyViewerFilters, type FilterState } from '@/components/property-viewer/PropertyViewerFilters';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';

interface FiltersPanelProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
}

export function FiltersPanel({ filters, onFiltersChange }: FiltersPanelProps) {
  const iconSizes = useIconSizes();
  const { quick } = useBorderTokens();
  // 🏢 ENTERPRISE: i18n support
  const { t } = useTranslation('common');

  return (
    <div className="px-4 pt-4 shrink-0">
      <Collapsible className={`${quick.card} bg-card rounded-lg`}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="w-full justify-start p-4 text-sm font-semibold">
            <Filter className={`${iconSizes.sm} mr-2`} />
            {t('filters.searchFilters')}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <PropertyViewerFilters filters={filters} onFiltersChange={onFiltersChange} />
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
