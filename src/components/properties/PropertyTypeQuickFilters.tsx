/**
 * 🏢 ENTERPRISE: Property Type Quick Filters Component
 *
 * Re-export from centralized TypeQuickFilters for backward compatibility.
 *
 * @version 2.0.0 - Now uses centralized TypeQuickFilters
 * @see @/components/shared/TypeQuickFilters.tsx
 * @renamed 2026-03-31 Unit → Property
 */

// 🏢 ENTERPRISE: Re-export from centralized location
export {
  UnitTypeQuickFilters as PropertyTypeQuickFilters,
  UnitTypeQuickFilters,
  UNIT_TYPE_OPTIONS,
  type TypeFilterOption as PropertyTypeOption,
  type TypeQuickFiltersProps as PropertyTypeQuickFiltersProps
} from '@/components/shared/TypeQuickFilters';
