'use client';

import React from 'react';
import { INTERACTIVE_PATTERNS } from '@/components/ui/effects';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { PeriodConfig } from '@/config/period-selector-config';

// ============================================================================
// INTERFACES
// ============================================================================

export interface GenericPeriodSelectorProps {
  /** Period selector configuration */
  periods: PeriodConfig[];
  /** Currently selected period value */
  value: string;
  /** Callback when period changes */
  onChange: (value: string) => void;
  /** Additional CSS classes */
  className?: string;
  /** Custom styling theme */
  theme?: 'default' | 'compact' | 'large';
  /** Disabled state */
  disabled?: boolean;
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * Generic Period Selector
 *
 * Renders period selection buttons based on configuration
 * Maintains the same small styling as the original PeriodSelector
 *
 * @example
 * ```tsx
 * import { getSortedPeriods } from '@/config/period-selector-config';
 * import { GenericPeriodSelector } from '@/components/generic';
 *
 * function Dashboard({ selectedPeriod, setSelectedPeriod }) {
 *   const periods = getSortedPeriods();
 *
 *   return (
 *     <GenericPeriodSelector
 *       periods={periods}
 *       value={selectedPeriod}
 *       onChange={setSelectedPeriod}
 *       theme="compact"
 *     />
 *   );
 * }
 * ```
 */
export function GenericPeriodSelector({
  periods,
  value,
  onChange,
  className = '',
  theme = 'compact',
  disabled = false,
}: GenericPeriodSelectorProps) {
  // Φιλτράρισμα enabled periods
  const enabledPeriods = periods.filter(period => period.enabled !== false);

  const handlePeriodClick = (period: PeriodConfig) => {
    if (disabled || period.enabled === false) return;
    onChange(period.value);
  };

  return (
    <Tabs value={value} onValueChange={onChange} className={className}>
      <TabsList className="w-auto">
        {enabledPeriods.map(period => (
          <Tooltip key={period.id}>
            <TooltipTrigger asChild>
              <TabsTrigger
                value={period.value}
                disabled={disabled || period.enabled === false}
                className={`text-xs data-[state=active]:bg-orange-500 data-[state=active]:text-white ${INTERACTIVE_PATTERNS.BUTTON_ORANGE_GHOST}`}
              >
                {period.label}
              </TabsTrigger>
            </TooltipTrigger>
            <TooltipContent>{period.description}</TooltipContent>
          </Tooltip>
        ))}
      </TabsList>
    </Tabs>
  );
}

// ============================================================================
// EXPORTS
// ============================================================================

export default GenericPeriodSelector;