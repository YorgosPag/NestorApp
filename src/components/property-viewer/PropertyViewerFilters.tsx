'use client';

import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { useIconSizes } from '@/hooks/useIconSizes';
import { Button } from "@/components/ui/button";
import { RotateCcw, Filter } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import type { FilterState } from '@/types/property-viewer';
// 🏢 ADR-051: Use centralized useGenericFilters instead of ad-hoc useFilterState
import { useGenericFilters } from '@/components/core/AdvancedFilters';
import { FilterControls } from './filters/FilterControls';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';


interface PropertyViewerFiltersProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
}

// 🏢 ENTERPRISE: Feature options for advanced filters (ADR-051)
const FEATURE_OPTIONS = [
  { id: 'parking', labelKey: 'filters.advanced.features.parking' },
  { id: 'storage', labelKey: 'filters.advanced.features.storage' },
  { id: 'fireplace', labelKey: 'filters.advanced.features.fireplace' },
  { id: 'view', labelKey: 'filters.advanced.features.view' },
  { id: 'pool', labelKey: 'filters.advanced.features.pool' },
];

export function PropertyViewerFilters({ filters, onFiltersChange }: PropertyViewerFiltersProps) {
  const iconSizes = useIconSizes();
  const { quick } = useBorderTokens();
  const colors = useSemanticColors();
  const spacing = useSpacingTokens();
  // 🏢 ENTERPRISE: i18n hook
  const { t } = useTranslation('properties');
  const [showAdvanced, setShowAdvanced] = useState(false);
  // 🏢 ADR-051: Use centralized useGenericFilters with 'features' key (not 'advancedFeatures')
  // FilterState extends GenericFilterState, so no type casting needed
  const {
    handleFilterChange,
    handleRangeChange,
    handleFeatureChange: handleFeatureChangeBase,
    clearAllFilters,
    hasActiveFilters,
  } = useGenericFilters(filters, onFiltersChange);

  // 🏢 ENTERPRISE: Wrapper to use 'features' key instead of default 'advancedFeatures'
  const handleFeatureChange = (featureId: string, checked: boolean | 'indeterminate') =>
    handleFeatureChangeBase(featureId, checked, 'features');

  return (
    <Card className="w-full bg-card/50 border-none shadow-none">
      <CardContent className="space-y-4 p-2">
        <FilterControls
          filters={filters}
          onFilterChange={handleFilterChange}
          onRangeChange={handleRangeChange}
        />
        {/* 🏢 ADR-051: Inline advanced filters (replaced deleted AdvancedFilters component) */}
        <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced} className="pt-2">
          <CollapsibleTrigger asChild>
            <Button variant="link" size="sm">
              <Filter className={`${iconSizes.sm} mr-2`}/>
              {showAdvanced ? t('filters.advanced.hide') : t('filters.advanced.show')}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className={`mt-4 p-4 ${quick.card} ${colors.bg.primary} animate-in fade-in-0 zoom-in-95`}>
            <div className={`grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 ${spacing.gap.md}`}>
              {FEATURE_OPTIONS.map(feature => (
                <div key={feature.id} className={`flex items-center ${spacing.gap.sm}`}>
                  <Checkbox
                    id={`feature-${feature.id}`}
                    checked={filters.features.includes(feature.id)}
                    onCheckedChange={(checked) => handleFeatureChange(feature.id, checked)}
                    aria-label={t(feature.labelKey)}
                  />
                  <Label htmlFor={`feature-${feature.id}`} className="text-sm font-normal">
                    {t(feature.labelKey)}
                  </Label>
                </div>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
        {hasActiveFilters && (
          <div className="flex justify-end pt-2">
              <Button variant="ghost" size="sm" onClick={clearAllFilters}>
                  <RotateCcw className={`${iconSizes.sm} mr-2`} />
                  {t('viewerFilters.resetFilters')}
              </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
