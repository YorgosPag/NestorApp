/**
 * 🏢 ENTERPRISE Unified Search System
 * Centralized exports για όλα τα search components
 *
 * @version 1.0.0
 * @author Enterprise Team
 * @compliance CLAUDE.md Protocol - Clean centralized exports
 */

// 🎯 Core Search Components
export { SearchInput } from './SearchInput';
export { SearchField, PropertySearchField, CompanySearchField } from './SearchField';
export { HeaderSearch } from './HeaderSearch';
export { QuickSearch } from './QuickSearch';

// 🏗️ Specialized Search Components
export {
  TableHeaderSearch,
  UnitsHeaderSearch,
  BuildingsHeaderSearch,
  ProjectsHeaderSearch,
  ContactsHeaderSearch
} from './TableHeaderSearch';

// 🏗️ Types & Interfaces
export type {
  BaseSearchProps,
  SearchInputProps,
  SearchFieldProps,
  EnterpriseSearchProps,
  SearchVariant,
  SearchConfig,
} from './types';

// 🔧 Constants & Configuration
export {
  SEARCH_CONFIG,
  LEGACY_PATTERNS,
  SEARCH_UI,
  DEBOUNCE_PRESETS,
} from './constants';

/**
 * 🚀 MIGRATION GUIDE
 *
 * OLD → NEW MIGRATIONS:
 *
 * 1. Basic Search Input:
 *    OLD: Custom implementation με Search icon + Input
 *    NEW: import { SearchInput } from '@/components/ui/search';
 *
 * 2. Search Field με Label:
 *    OLD: components/public-property-filters/parts/SearchField.tsx
 *    NEW: import { PropertySearchField } from '@/components/ui/search';
 *
 * 3. Company Search:
 *    OLD: Custom implementation στο navigation modal
 *    NEW: import { CompanySearchField } from '@/components/ui/search';
 *
 * BENEFITS:
 * ✅ Zero visual changes - 100% backward compatible
 * ✅ Centralized logic - no more duplicates
 * ✅ Enterprise features - debouncing, accessibility
 * ✅ Type safety - proper TypeScript interfaces
 * ✅ Maintainable - single source of truth
 */