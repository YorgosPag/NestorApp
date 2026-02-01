/**
 * @file Layer Configuration Constants
 * @module config/layer-config
 *
 * ADR-130: Default Layer Name Centralization
 *
 * Single source of truth for all layer-related constants.
 * Eliminates hardcoded 'default' strings scattered across the codebase.
 *
 * PROBLEM SOLVED:
 * - 10+ files had hardcoded 'default' || entity.layer patterns
 * - Inconsistent values: 'default' vs 'general' vs '0'
 * - ENTERPRISE_CONSTANTS.DEFAULT_LAYER existed but was unused
 *
 * @author Anthropic Claude + Georgios Pagonis
 * @since 2026-02-01
 */

// ============================================================================
// LAYER NAME CONSTANTS
// ============================================================================

/**
 * DXF standard default layer (AutoCAD compatible)
 *
 * In DXF/DWG files, layer '0' is the default layer that always exists.
 * Use this for DXF import/export operations to maintain compatibility.
 *
 * @see https://knowledge.autodesk.com/support/autocad/learn-explore/caas/CloudHelp/cloudhelp/2023/ENU/AutoCAD-Core/files/GUID-0A2A0F4C-C4D5-4F74-8C87-9C4D4D7F2F1F-htm.html
 */
export const DXF_DEFAULT_LAYER = '0' as const;

/**
 * Application default layer for UI display and internal operations
 *
 * Used when:
 * - Entity doesn't have a layer assigned
 * - Layer lookup fails
 * - New entities are created without explicit layer
 *
 * This is the canonical fallback layer name for the application.
 */
export const DEFAULT_LAYER_NAME = 'default' as const;

// ============================================================================
// LAYER NAME UTILITIES
// ============================================================================

/**
 * Get layer name with fallback to default
 *
 * Use this for all internal operations where entities may not have a layer.
 *
 * @param layer - Layer name or undefined/null
 * @returns Layer name or DEFAULT_LAYER_NAME ('default')
 *
 * @example
 * ```typescript
 * // Before (hardcoded, scattered):
 * const layerName = entity.layer || 'default';
 *
 * // After (centralized):
 * const layerName = getLayerNameOrDefault(entity.layer);
 * ```
 */
export function getLayerNameOrDefault(layer: string | undefined | null): string {
  return layer || DEFAULT_LAYER_NAME;
}

/**
 * Get layer name for DXF operations
 *
 * Use this for DXF import/export where AutoCAD compatibility matters.
 *
 * @param layer - Layer name or undefined/null
 * @returns Layer name or DXF_DEFAULT_LAYER ('0')
 *
 * @example
 * ```typescript
 * // For DXF export:
 * const dxfLayer = getDxfLayerName(entity.layer);
 * ```
 */
export function getDxfLayerName(layer: string | undefined | null): string {
  return layer || DXF_DEFAULT_LAYER;
}

/**
 * Check if a layer name is a default/fallback layer
 *
 * @param layer - Layer name to check
 * @returns true if the layer is 'default', '0', 'general', or falsy
 */
export function isDefaultLayer(layer: string | undefined | null): boolean {
  if (!layer) return true;
  const normalized = layer.toLowerCase().trim();
  return normalized === 'default' || normalized === '0' || normalized === 'general';
}

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Layer name type for strict typing
 */
export type LayerName = string;

/**
 * Default layer literal types
 */
export type DefaultLayerType = typeof DEFAULT_LAYER_NAME | typeof DXF_DEFAULT_LAYER;
