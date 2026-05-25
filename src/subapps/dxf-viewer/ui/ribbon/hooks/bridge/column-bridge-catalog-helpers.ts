/**
 * ADR-363 Phase 8E — Catalog-change helpers for `useRibbonColumnBridge`.
 *
 * Extracted so the bridge hook stays under the 500-line limit (N.7.1).
 * Covers: preset application (entity + drawing-tool paths) and the
 * "custom sentinel" logic (clear catalogProfile on manual dim edit).
 */

import type { ColumnEntity, ColumnIShapeParams, ColumnKind, ColumnParams } from '../../../../bim/types/column-types';
import type { ColumnToolBridgeHandle } from './column-tool-bridge-store';
import type { ColumnParamOverrides } from '../../../../hooks/drawing/column-completion';
import {
  CATALOG_CUSTOM_SENTINEL,
  findIShapePreset,
  findShearWallPreset,
} from '../../../../bim/columns/section-catalog';
import { COLUMN_RIBBON_KEYS } from './column-command-keys';

// ─── Custom-sentinel guards ──────────────────────────────────────────────────

/**
 * True when a top-level number param edit should clear the active catalog
 * preset. Mirrors Revit: manual dim change → section becomes "Custom".
 */
export function catalogOwnsDimension(commandKey: string, kind: ColumnKind): boolean {
  if (kind === 'I-shape') {
    return (
      commandKey === COLUMN_RIBBON_KEYS.params.width ||
      commandKey === COLUMN_RIBBON_KEYS.params.depth
    );
  }
  if (kind === 'shear-wall') {
    return commandKey === COLUMN_RIBBON_KEYS.params.depth;
  }
  return false;
}

/** True when a nested param edit (flangeThickness / webThickness) should clear the catalog. */
export function catalogOwnsNestedParam(commandKey: string, kind: ColumnKind): boolean {
  if (kind !== 'I-shape') return false;
  return (
    commandKey === COLUMN_RIBBON_KEYS.params.flangeThickness ||
    commandKey === COLUMN_RIBBON_KEYS.params.webThickness
  );
}

// ─── Entity path ─────────────────────────────────────────────────────────────

type DispatchParams = (column: ColumnEntity, nextParams: ColumnParams) => void;

/**
 * Apply a catalog preset to a selected entity. Batch-writes all preset
 * dimensions + `catalogProfile` in one `UpdateColumnParamsCommand`.
 * No-ops on 'custom' sentinel or unknown preset ID.
 */
export function applyEntityCatalogPreset(
  column: ColumnEntity,
  presetId: string,
  dispatchParams: DispatchParams,
): void {
  if (presetId === CATALOG_CUSTOM_SENTINEL) return;
  const { kind } = column.params;

  if (kind === 'shear-wall') {
    const preset = findShearWallPreset(presetId);
    if (!preset) return;
    dispatchParams(column, { ...column.params, depth: preset.thickness, catalogProfile: preset.id });
    return;
  }

  if (kind === 'I-shape') {
    const preset = findIShapePreset(presetId);
    if (!preset) return;
    const nextIshape: ColumnIShapeParams = {
      ...(column.params.ishape ?? {}),
      flangeThickness: preset.flangeThickness,
      webThickness: preset.webThickness,
    };
    dispatchParams(column, {
      ...column.params,
      width: preset.flangeWidth,
      depth: preset.sectionDepth,
      ishape: nextIshape,
      catalogProfile: preset.id,
    });
  }
}

// ─── Drawing-tool path ───────────────────────────────────────────────────────

/**
 * Apply a catalog preset to the column drawing-tool handle (no selected
 * entity). Drives `useColumnTool` overrides so the next canvas click uses
 * the preset dimensions.
 */
export function applyToolCatalogPreset(
  handle: ColumnToolBridgeHandle,
  presetId: string,
): void {
  if (presetId === CATALOG_CUSTOM_SENTINEL) return;
  const { kind } = handle;

  if (kind === 'shear-wall') {
    const preset = findShearWallPreset(presetId);
    if (!preset) return;
    handle.setParamOverrides({ depth: preset.thickness, catalogProfile: preset.id });
    return;
  }

  if (kind === 'I-shape') {
    const preset = findIShapePreset(presetId);
    if (!preset) return;
    const overrides: ColumnParamOverrides = {
      width: preset.flangeWidth,
      depth: preset.sectionDepth,
      ishape: { flangeThickness: preset.flangeThickness, webThickness: preset.webThickness },
      catalogProfile: preset.id,
    };
    handle.setParamOverrides(overrides);
  }
}
