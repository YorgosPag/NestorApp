/**
 * 🏢 ENTERPRISE FEATURE FLAGS
 * Centralized feature flag configuration for DXF Viewer
 *
 * @version 1.0.0
 * @since 2027-01-27
 */

/**
 * 🏢 ADR-050: Unified Toolbar Integration (2027-01-27)
 *
 * Controls whether overlay toolbar is integrated into main EnhancedDXFToolbar
 * as collapsible Row 2 (unified mode) or rendered as separate floating window (legacy mode).
 *
 * - true: Unified toolbar (Row 2 in EnhancedDXFToolbar, no floating window)
 * - false: Legacy floating toolbar (DraggableOverlayToolbar)
 *
 * @default true - Unified toolbar is LIVE in production
 */
export const USE_UNIFIED_OVERLAY_TOOLBAR = true;

/**
 * 🤖 ADR-185: AI Drawing Assistant
 *
 * Controls whether the AI drawing assistant chat panel is available in DXF Viewer.
 * Set NEXT_PUBLIC_DXF_AI_ASSISTANT=true in .env.local to enable.
 *
 * @default false - Disabled until explicitly enabled
 */
export const USE_AI_DRAWING_ASSISTANT = process.env.NEXT_PUBLIC_DXF_AI_ASSISTANT === 'true';

/**
 * Re-export for backward compatibility
 */
export const FEATURE_FLAGS = {
  USE_UNIFIED_OVERLAY_TOOLBAR,
  USE_AI_DRAWING_ASSISTANT,
} as const;
