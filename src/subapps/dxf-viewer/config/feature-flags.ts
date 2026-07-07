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
 * 🤖 ADR-581 §12: Optional AI layer for «Αντιγραφή Ιδιοτήτων» (Match/Transfer Properties)
 *
 * Gates the optional AI intent layer on top of the deterministic Match engine.
 * The deterministic core (roles/registry/resolver/applier) works 100% offline;
 * this flag only enables the natural-language intent surface (NL → which roles to
 * transfer vs preserve). The LLM never produces values — it only picks role strings.
 * Set NEXT_PUBLIC_DXF_AI_MATCH=true in .env.local to enable.
 *
 * @default false - Disabled until explicitly enabled
 */
export const USE_AI_MATCH_PROPERTIES = process.env.NEXT_PUBLIC_DXF_AI_MATCH === 'true';

/**
 * Re-export for backward compatibility
 */
export const FEATURE_FLAGS = {
  USE_UNIFIED_OVERLAY_TOOLBAR,
  USE_AI_DRAWING_ASSISTANT,
  USE_AI_MATCH_PROPERTIES,
} as const;
