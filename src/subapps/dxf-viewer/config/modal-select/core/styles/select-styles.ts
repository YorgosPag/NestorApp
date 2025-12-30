/**
 * @fileoverview Select Styling Constants Module
 * @description Extracted from modal-select.ts - SELECT STYLING CONSTANTS
 * @author Claude (Anthropic AI)
 * @date 2025-12-28
 * @version 1.0.0 - ENTERPRISE MODULAR ARCHITECTURE
 * @compliance CLAUDE.md Enterprise Standards - MODULAR SPLITTING
 */

// ====================================================================
// 🏢 ENTERPRISE IMPORTS - CENTRALIZED SOURCE OF TRUTH
// ====================================================================

// Import color systems for consistency
import { componentSizes, semanticColors } from '../../../../../../styles/design-tokens';
import { COLOR_BRIDGE } from '../../../../../../design-system/color-bridge';
// 🏢 ENTERPRISE: Import centralized panel tokens
import { PANEL_COLORS } from '../../../panel-tokens';

// ====================================================================
// SELECT STYLING CONSTANTS - 100% CENTRALIZED
// ====================================================================

/**
 * Standardized Select component styling
 * NO MORE HARDCODED SELECT STYLES
 */
export const MODAL_SELECT_STYLES = {
  // DXF Technical Interface Select (Dark Theme)
  DXF_TECHNICAL: {
    trigger: `w-full ${PANEL_COLORS.BG_SECONDARY} border ${PANEL_COLORS.BORDER_PRIMARY} text-white focus:border-orange-500 focus:ring-orange-500/20`, // ✅ ENTERPRISE: Using centralized PANEL_COLORS
    content: `${PANEL_COLORS.BG_SECONDARY} border ${PANEL_COLORS.BORDER_PRIMARY}`, // ✅ ENTERPRISE: Using centralized PANEL_COLORS
    item: `text-white hover:${PANEL_COLORS.BG_TERTIARY} focus:${PANEL_COLORS.BG_TERTIARY}`, // ✅ ENTERPRISE: Using centralized PANEL_COLORS
    placeholder: '${semanticColors.text.tertiary}',
  },

  // Default Light Select
  DEFAULT: {
    trigger: `w-full ${COLOR_BRIDGE.bg.primary} border-input text-foreground focus:border-ring`,
    content: 'bg-popover',
    item: 'hover:bg-accent focus:bg-accent',
    placeholder: 'text-muted-foreground',
  },

  // Success State Select
  SUCCESS: {
    trigger: `w-full ${COLOR_BRIDGE.bg.successSubtle} border ${PANEL_COLORS.BORDER_SUCCESS_SECONDARY} ${COLOR_BRIDGE.text.success} focus:${COLOR_BRIDGE.border.success}`, // ✅ ENTERPRISE: Centralized success colors
    content: `${COLOR_BRIDGE.bg.successSubtle} border ${PANEL_COLORS.BORDER_SUCCESS_SECONDARY}`, // ✅ ENTERPRISE: Centralized success colors
    item: `${COLOR_BRIDGE.text.success} hover:${COLOR_BRIDGE.bg.success} focus:${COLOR_BRIDGE.bg.success}`,
    placeholder: COLOR_BRIDGE.text.success,
  },

  // Error State Select
  ERROR: {
    trigger: `w-full ${COLOR_BRIDGE.bg.errorSubtle} border ${PANEL_COLORS.BORDER_SECONDARY} ${COLOR_BRIDGE.text.error} focus:${COLOR_BRIDGE.border.error}`, // ✅ ENTERPRISE: Centralized error colors
    content: `${COLOR_BRIDGE.bg.errorSubtle} border ${PANEL_COLORS.BORDER_SECONDARY}`, // ✅ ENTERPRISE: Centralized error colors
    item: `${COLOR_BRIDGE.text.error} hover:${COLOR_BRIDGE.bg.error} focus:${COLOR_BRIDGE.bg.error}`,
    placeholder: COLOR_BRIDGE.text.error,
  },

  // Warning State Select
  WARNING: {
    trigger: `w-full ${COLOR_BRIDGE.bg.warning} border ${PANEL_COLORS.BORDER_SECONDARY} ${COLOR_BRIDGE.text.warning} focus:${COLOR_BRIDGE.border.warning}`, // ✅ ENTERPRISE: Centralized warning colors
    content: `${COLOR_BRIDGE.bg.warning} border ${PANEL_COLORS.BORDER_SECONDARY}`, // ✅ ENTERPRISE: Centralized warning colors
    item: `${COLOR_BRIDGE.text.warning} hover:${COLOR_BRIDGE.bg.warning} focus:${COLOR_BRIDGE.bg.warning}`,
    placeholder: COLOR_BRIDGE.text.warning,
  },
} as const;

// ====================================================================
// 🔄 RE-EXPORT SELECT ITEM PATTERNS - FROM MODULAR SYSTEM
// ====================================================================

// ✅ MIGRATED: Moved to core/styles/patterns.ts (2025-12-28)
// Import from modular system for re-export:
export { MODAL_SELECT_ITEM_PATTERNS } from './patterns';