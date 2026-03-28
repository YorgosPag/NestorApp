/**
 * 🏢 ENTERPRISE Search System Constants
 * Κεντρικοποιημένες σταθερές για consistent search behavior
 *
 * @version 1.0.0
 * @author Enterprise Team
 * @compliance CLAUDE.md Protocol - No inline styles, centralized values
 */

import type { SearchConfig } from './types';

/**
 * 🎯 ENTERPRISE SEARCH CONFIG
 * Single source of truth για όλες τις search configurations
 */
// 🌐 i18n: All placeholders converted to i18n keys - 2026-01-18
export const SEARCH_CONFIG: SearchConfig = {
  debounceDelay: 300,
  maxLength: 500,
  placeholderDefault: 'placeholders.search',
  iconSize: 4,
  iconPosition: 'left-3',
  paddingLeft: 'pl-11', // Consistent με existing implementations
} as const;

/**
 * 🏗️ EXISTING PATTERNS MAPPING
 * Backward compatibility για τα υπάρχοντα patterns
 */
// 🌐 i18n: All placeholders converted to i18n keys - 2026-01-18
export const LEGACY_PATTERNS = {
  // Pattern από public-property-filters/parts/SearchField.tsx
  PROPERTY_SEARCH: {
    iconClasses: 'absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground',
    inputClasses: 'pl-9',
    placeholder: 'placeholders.searchProperty',
  },

  // Pattern από navigation/dialogs/SelectCompanyContactModal.tsx
  COMPANY_SEARCH: {
    iconClasses: 'absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground',
    inputClasses: 'pl-11',
    placeholder: 'placeholders.searchCompany',
  },

  // Pattern από header/search-bar.tsx
  HEADER_SEARCH: {
    iconClasses: 'absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground',
    inputClasses: 'pl-10',
    placeholder: 'placeholders.searchContacts',
  },
} as const;

/**
 * 🎨 UI CONSTANTS
 * Κεντρικοποιημένα UI values για consistency
 */
export const SEARCH_UI = {
  ICON: {
    SIZE: 'h-4 w-4',
    COLOR: 'text-muted-foreground',
    POSITION: 'absolute left-4 top-1/2 -translate-y-1/2', // Αλλαγή από left-3 σε left-4
    ACCESSIBILITY: 'pointer-events-none',
  },

  CONTAINER: {
    BASE: 'relative w-full', // 🔧 Ensure full width container
    SPACING: 'space-y-2',
  },

  INPUT: {
    FOCUS: 'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2', // 🎨 SSoT focus ring — aligned with Input/Textarea base component
    DISABLED: 'disabled:cursor-not-allowed disabled:bg-muted/50',
    RESPONSIVE: 'w-full flex-1', // 🔧 Ensure full width + flex behavior
  },

  LABEL: {
    BASE: 'text-sm font-medium',
    WITH_ICON: 'flex items-center gap-2',
    COLOR: 'text-foreground',
  },
} as const;

/**
 * 🔧 DEBOUNCE PRESETS
 * Προκαθορισμένες τιμές για διαφορετικά use cases
 */
export const DEBOUNCE_PRESETS = {
  INSTANT: 0,           // Για instant search
  FAST: 150,           // Για γρήγορα searches
  STANDARD: 300,       // Default για τα περισσότερα cases
  SLOW: 500,          // Για heavy operations
  API_CALL: 600,      // Για API searches με rate limiting
} as const;
