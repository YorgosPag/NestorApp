'use client';

import React, { useState } from 'react';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from "@/components/ui/card";
import { Filter, RotateCcw } from 'lucide-react';
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { FilterField, type FilterFieldValue } from './FilterField';
import { useGenericFilters } from './useGenericFilters';
import type { FilterPanelConfig, GenericFilterState } from './types';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
// 🏢 ENTERPRISE: Centralized layout classes
import { useLayoutClasses } from '@/hooks/useLayoutClasses';
// 🏢 ENTERPRISE: Centralized spacing tokens
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';

interface AdvancedFiltersPanelProps<T extends GenericFilterState> {
  config: FilterPanelConfig;
  filters: T;
  onFiltersChange: (filters: T) => void;
  defaultOpen?: boolean; // Control if panel is open by default
}

export function AdvancedFiltersPanel<T extends GenericFilterState>({
  config,
  filters,
  onFiltersChange,
  defaultOpen = false
}: AdvancedFiltersPanelProps<T>) {
  // 🏢 ENTERPRISE: i18n hook with configurable namespace (PR1.2)
  const currentNamespace = config.i18nNamespace || 'building';
  const { t } = useTranslation(currentNamespace);
  const iconSizes = useIconSizes();
  const { quick } = useBorderTokens();
  const colors = useSemanticColors();
  const layout = useLayoutClasses();
  const spacing = useSpacingTokens();
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isPanelOpen, setIsPanelOpen] = useState(defaultOpen);

  // 🏢 ENTERPRISE: Helper to translate labels with namespace prefix removal
  // Handles labels like 'filters.advancedOptions.x' when namespace is 'filters'
  const translateLabel = (label: string): string => {
    if (!label) return '';
    // If label starts with current namespace prefix, remove it
    const prefix = `${currentNamespace}.`;
    if (label.startsWith(prefix)) {
      return t(label.slice(prefix.length));
    }
    return t(label);
  };

  const {
    handleFilterChange,
    handleRangeChange,
    handleFeatureChange,
    handleSelectChange,
    clearAllFilters,
    hasActiveFilters
  } = useGenericFilters(filters, onFiltersChange);

  const getFieldValue = (fieldId: string): FilterFieldValue => {
    if (fieldId.includes('Range')) {
      // 🏢 ENTERPRISE: Support both direct ranges (areaRange) and nested ranges (ranges.areaRange)
      const directRange = (filters as Record<string, unknown>)[fieldId];
      if (directRange !== undefined) {
        return directRange as FilterFieldValue;
      }
      // Fallback to nested ranges (legacy support)
      return filters.ranges?.[fieldId] || { min: undefined, max: undefined };
    }
    return (filters as Record<string, unknown>)[fieldId] as FilterFieldValue;
  };

  const handleFieldChange = (fieldId: string, value: unknown) => {
    if (fieldId.includes('Range')) {
      // 🔧 ENTERPRISE FIX: Handle range dropdown mode (preset selections)
      // Check if value is a complete range object from dropdown
      if (value && typeof value === 'object' && 'min' in value && 'max' in value) {
        // Direct range object from dropdown preset selection
        handleFilterChange(fieldId as keyof T, value as T[keyof T]);
        return;
      }
      // Individual range changes are handled by handleRangeChange
      return;
    }

    const field = config.rows
      .flatMap(row => row.fields)
      .find(f => f.id === fieldId);

    if (field?.type === 'select') {
      // Type-safe: handleSelectChange expects string
      handleSelectChange(fieldId, typeof value === 'string' ? value : String(value || ''));
    } else {
      // Type assertion needed for generic type T
      handleFilterChange(fieldId as keyof T, value as T[keyof T]);
    }
  };

  const handleFieldRangeChange = (fieldId: string, subKey: 'min' | 'max', value: string) => {
    handleRangeChange(fieldId, subKey, value);
  };

  return (
    <div className={`${layout.filterPaddingResponsive} shrink-0 w-full overflow-hidden`}>
      <Collapsible open={isPanelOpen} onOpenChange={setIsPanelOpen} className="rounded-lg bg-card">
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className={`w-full justify-start ${layout.filterButtonPadding} text-sm font-semibold`}>
            <Filter className={`${iconSizes.sm} ${spacing.margin.right.sm}`} />
            {/* 🏢 ENTERPRISE: Support both translation keys and direct labels */}
            {t(config.title)}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <Card className="w-full bg-card/50 border-none shadow-none !m-0">
            <CardContent className={`!p-2 !m-0 ${spacing.spaceBetween.sm}`}>
              {/* Render filter rows */}
              {config.rows.map(row => (
                <div key={row.id} className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 ${layout.filterGridGap} items-end w-full min-w-0 overflow-hidden`}>
                  {row.fields.map(field => (
                    <FilterField
                      key={field.id}
                      config={field}
                      value={getFieldValue(field.id)}
                      onValueChange={(value) => handleFieldChange(field.id, value)}
                      onRangeChange={(subKey, value) => handleFieldRangeChange(field.id, subKey, value)}
                      i18nNamespace={currentNamespace}
                    />
                  ))}
                </div>
              ))}

              {/* Advanced Filters Section */}
              {config.advancedFilters && (
                <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
                  <CollapsibleTrigger asChild>
                    <Button variant="outline" size="sm" className="text-sm font-medium">
                      <Filter className={`${iconSizes.sm} ${spacing.margin.right.sm}`}/>
                      {showAdvanced ? t('hideAdvanced') : t('showAdvanced')}
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className={`!mt-2 !p-2 ${quick.card} ${colors.bg.primary} animate-in fade-in-0 zoom-in-95`}>
                    <div className={`grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 ${layout.filterGridGap} w-full min-w-0 overflow-hidden`}>
                      {config.advancedFilters.options.map(option => (
                        <div key={option.id} className={`flex items-center ${spacing.gap.sm}`}>
                          <Checkbox
                            id={`feature-${option.id}`}
                            checked={filters.advancedFeatures?.includes(option.id) || false}
                            onCheckedChange={(checked) => handleFeatureChange(option.id, checked)}
                            aria-label={translateLabel(option.label)}
                          />
                          <Label htmlFor={`feature-${option.id}`} className="text-sm font-normal">
                            {translateLabel(option.label)}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )}

              {/* Clear filters button */}
              {hasActiveFilters && (
                <div className="flex justify-end">
                  <Button variant="ghost" size="sm" onClick={clearAllFilters}>
                    <RotateCcw className={`${iconSizes.sm} ${spacing.margin.right.sm}`} />
                    {t('filters.resetFilters')}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}