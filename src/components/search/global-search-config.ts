/**
 * =============================================================================
 * 🔍 GLOBAL SEARCH DIALOG — CONFIG, TYPES & CONSTANTS
 * =============================================================================
 *
 * Extracted from GlobalSearchDialog.tsx to keep it under 500 lines (SRP).
 * Single source of truth for:
 *   - GlobalSearchDialogProps interface
 *   - ENTITY_DISPLAY_ORDER constant
 *   - KBD_STYLES constant
 *
 * @module components/search/global-search-config
 * @enterprise ADR-029 - Global Search v1
 */

import { SEARCH_ENTITY_TYPES } from '@/types/search';
import type { SearchEntityType } from '@/types/search';

// =============================================================================
// TYPES
// =============================================================================

export interface GlobalSearchDialogProps {
  /** Whether the dialog is open (controlled) */
  open?: boolean;

  /** Callback when open state changes */
  onOpenChange?: (open: boolean) => void;

  /** Filter by specific entity types */
  types?: SearchEntityType[];
}

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * Order in which entity groups should be displayed.
 */
export const ENTITY_DISPLAY_ORDER: SearchEntityType[] = [
  SEARCH_ENTITY_TYPES.PROJECT,
  SEARCH_ENTITY_TYPES.CONTACT,
  SEARCH_ENTITY_TYPES.BUILDING,
  SEARCH_ENTITY_TYPES.PROPERTY,
  SEARCH_ENTITY_TYPES.FILE,
  SEARCH_ENTITY_TYPES.PARKING,
  SEARCH_ENTITY_TYPES.STORAGE,
  // 🏢 ADR-029 Phase 2: CRM Entities
  SEARCH_ENTITY_TYPES.OPPORTUNITY,
  SEARCH_ENTITY_TYPES.COMMUNICATION,
  SEARCH_ENTITY_TYPES.TASK,
];

/**
 * 🏢 ENTERPRISE: Centralized keyboard hint styling
 * Single source of truth for kbd element appearance in search dialog
 *
 * @design Based on macOS/Windows keyboard shortcut UI patterns
 * @see SAP Fiori, Salesforce Lightning Design System kbd patterns
 */
export const KBD_STYLES = {
  /** Base classes for all kbd elements */
  base: 'inline-flex items-center justify-center font-medium bg-muted border rounded',
  /** Small kbd for arrow keys and single characters */
  sm: 'min-w-[1.5rem] h-6 px-1.5 text-xs',
  /** Medium kbd for text labels like "ESC" */
  md: 'min-w-[2rem] h-7 px-2 text-xs',
} as const;
