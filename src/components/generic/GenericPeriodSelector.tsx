'use client';

import React from 'react';
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

  // Styling variants based on theme
  const getContainerClasses = () => {
    const baseClasses = 'flex items-center rounded-lg p-1';

    switch (theme) {
      case 'large':
        return `${baseClasses} bg-gray-100 p-2`;
      case 'compact':
        return `${baseClasses} bg-gray-100`;
      default:
        return `${baseClasses} bg-gray-100`;
    }
  };

  const getButtonClasses = (period: PeriodConfig) => {
    const baseClasses = 'rounded-md transition-colors';
    const sizeClasses = theme === 'large' ? 'px-4 py-2 text-base' : 'px-3 py-1.5 text-sm';

    const stateClasses = value === period.value
      ? 'bg-white shadow text-blue-600 font-medium'
      : disabled
        ? 'text-gray-400 cursor-not-allowed'
        : 'text-gray-600 hover:text-gray-900';

    return `${baseClasses} ${sizeClasses} ${stateClasses}`;
  };

  const handlePeriodClick = (period: PeriodConfig) => {
    if (disabled || period.enabled === false) return;
    onChange(period.value);
  };

  return (
    <div className={`${getContainerClasses()} ${className}`}>
      {enabledPeriods.map(period => (
        <button
          key={period.id}
          onClick={() => handlePeriodClick(period)}
          disabled={disabled || period.enabled === false}
          className={getButtonClasses(period)}
          title={period.description}
        >
          {period.label}
        </button>
      ))}
    </div>
  );
}

// ============================================================================
// EXPORTS
// ============================================================================

export default GenericPeriodSelector;