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
  ENTITY_ICONS,
  ENTITY_LABELS,
  ENTITY_COLORS,
  ENTITY_LABEL_KEYS,
} from './SearchResultItem';
export type {
  SearchResultItemProps,
  SearchResultGroupProps,
} from './SearchResultItem';
