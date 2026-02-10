/**
 * @fileoverview Select Item Patterns Module
 * @description Extracted from select-styles.ts - SELECT ITEM PATTERNS
 * @author Claude (Anthropic AI)
 * @date 2025-12-28
 * @version 1.0.0 - ENTERPRISE MODULAR ARCHITECTURE
 * @compliance CLAUDE.md Enterprise Standards - MODULAR SPLITTING
 */

// ====================================================================
// 🏢 ENTERPRISE IMPORTS - CENTRALIZED SOURCE OF TRUTH
// ====================================================================

// Import color systems for consistency
import { componentSizes } from '../../../../../../styles/design-tokens';

// ====================================================================
// SELECT ITEM PATTERNS
// ====================================================================

/**
 * Common patterns for SelectItem content
 */
export const MODAL_SELECT_ITEM_PATTERNS = {
  // Icon + Text pattern - 🏢 ENTERPRISE CENTRALIZED
  WITH_ICON: {
    container: 'flex items-center space-x-2',
    icon: componentSizes.icon.sm,          // h-4 w-4 - Centralized
    text: '',
    description: '${semanticColors.text.muted} text-xs',
  },

  // Text + Badge pattern
  WITH_BADGE: {
    container: 'flex items-center justify-between',
    text: '',
    badge: 'text-xs px-2 py-1 rounded',
  },

  // Multi-line pattern (text + subtitle)
  MULTI_LINE: {
    container: 'flex flex-col space-y-1',
    title: 'font-medium',
    subtitle: 'text-xs ${semanticColors.text.muted}',
  },

  // Company/Organization pattern - 🏢 ENTERPRISE CENTRALIZED
  ORGANIZATION: {
    container: 'flex items-center space-x-2',
    icon: componentSizes.icon.sm,          // h-4 w-4 - Centralized
    name: 'font-medium',
    industry: 'text-xs ${semanticColors.text.muted} ml-auto',
  },

  // Project pattern - 🏢 ENTERPRISE CENTRALIZED
  PROJECT: {
    container: 'flex items-center space-x-2',
    icon: componentSizes.icon.sm,          // h-4 w-4 - Centralized
    name: '',
    count: 'text-xs ${semanticColors.text.muted} ml-auto',
  },

  // Building pattern - 🏢 ENTERPRISE CENTRALIZED
  BUILDING: {
    container: 'flex items-center space-x-2',
    icon: componentSizes.icon.sm,          // h-4 w-4 - Centralized
    name: '',
    floors: 'text-xs ${semanticColors.text.muted} ml-auto',
  },

  // Unit pattern - 🏢 ENTERPRISE CENTRALIZED
  UNIT: {
    container: 'flex items-center space-x-2',
    icon: componentSizes.icon.sm,          // h-4 w-4 - Centralized
    name: '',
    type: 'text-xs ${semanticColors.text.muted}',
    floor: 'text-xs ${semanticColors.text.muted}',
  },
} as const;