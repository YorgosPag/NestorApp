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
    trigger: `w-full ${PANEL_COLORS.BG_SECONDARY} border ${PANEL_COLORS.BORDER_PRIMARY} text-white focus:border-ring focus:ring-ring/20`, // ✅ ENTERPRISE: Using centralized PANEL_COLORS
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

/**
 * Το θέμα του select, δίπλα στα δεδομένα του (ADR-806).
 *
 * ⚠️ Ζούσε στο `config/modal-select.ts`, ένα facade 811 γραμμών που κρατούσε **87
 * exports για 3 ζωντανά σύμβολα**. Μετά την έξωση του λεξιλογίου (ADR-804 Φ.4) και τον
 * καθαρισμό των νεκρών, ό,τι απέμενε ήταν **καθαρά ψευδώνυμα** — και ένα αρχείο που δεν
 * κάνει τίποτα άλλο από το να προωθεί είναι ακριβώς το barrel που το Atlassian αφαίρεσε
 * από το Jira (μετρημένα −75% χρόνος build). Ο accessor ανήκει εκεί που ζει η σταθερά.
 */
export function getSelectStyles(theme: keyof typeof MODAL_SELECT_STYLES = 'DXF_TECHNICAL') {
  return MODAL_SELECT_STYLES[theme];
}
