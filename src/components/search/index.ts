/**
 * =============================================================================
 * 🔍 GLOBAL SEARCH COMPONENTS
 * =============================================================================
 *
 * Centralized exports for Global Search v1 components.
 *
 * @module components/search
 * @enterprise ADR-029 - Global Search v1
 */

// === Main Components ===
export { GlobalSearchDialog } from './GlobalSearchDialog';
export type { GlobalSearchDialogProps } from './GlobalSearchDialog';

// === Sub-Components ===
export {
  SearchResultItem,
  SearchResultGroup,
  ENTITY_LABELS,
  ENTITY_LABEL_KEYS,
  SEARCH_TO_NAVIGATION_ENTITY,
} from './SearchResultItem';
export type {
  SearchResultItemProps,
  SearchResultGroupProps,
} from './SearchResultItem';

// 🏢 ENTERPRISE: Entity icons/colors are now centralized in NAVIGATION_ENTITIES
// Use: import { NAVIGATION_ENTITIES } from '@/components/navigation/config';
