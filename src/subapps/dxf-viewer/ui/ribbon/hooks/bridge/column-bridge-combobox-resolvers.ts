'use client';

/**
 * ADR-363 Phase 4.5 / 8D — Pure combobox resolvers extracted from
 * `useRibbonColumnBridge` so the hook stays under the 500-line GOL limit
 * (N.7.1). Same routing logic, lifted verbatim out of the React callbacks.
 *
 * `resolveColumnComboboxState` reads either the selected `ColumnEntity` or the
 * drawing-tool handle (`toolHandle`). `applyColumnComboboxChange` writes the
 * same two targets — via `dispatchParams` (selected entity) or the tool-handle
 * store (drawing mode). Both no-op on keys they don't own.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §6 Phase 4.5 / 8D
 */

import type {
  ColumnAnchor,
  ColumnEntity,
  ColumnIShapeParams,
  ColumnKind,
  ColumnParams,
} from '../../../../bim/types/column-types';
import {
  COLUMN_RIBBON_KEYS,
  COLUMN_FINISH_KEY_TO_FIELD,
  isColumnRibbonKey,
  isColumnRibbonStringKey,
  isColumnFinishKey,
  isColumnStructuralKey,
  isColumnStructuralReadoutKey,
} from './column-command-keys';
import { resolveFinishComboboxState, applyFinishComboboxChange } from './finish-param';
import {
  resolveColumnStructuralState,
  resolveColumnStructuralReadout,
  applyColumnStructuralChange,
} from './column-structural-bridge';
import {
  readEnvelopeFunctionValue,
  parseEnvelopeFunctionValue,
} from './envelope-function-param';
import {
  applyEntityCatalogPreset,
  applyToolCatalogPreset,
  catalogOwnsDimension,
  catalogOwnsNestedParam,
} from './column-bridge-catalog-helpers';
import {
  NESTED_NUMBER_KEY_TO_PATH,
  NUMBER_KEY_TO_FIELD,
  STRING_KEY_TO_FIELD,
  isNestedNumberKey,
  patchNestedParams,
  readNestedValue,
} from './column-bridge-param-routing';
import { CATALOG_CUSTOM_SENTINEL } from '../../../../bim/columns/section-catalog';
import {
  columnToolBridgeStore,
  type ColumnToolBridgeHandle,
} from './column-tool-bridge-store';
import { deriveStoreyBoundHeightMm, isColumnHeightDerived } from './column-height-display';
import type { RibbonComboboxState } from '../../context/RibbonCommandContext';

/**
 * Resolve the combobox state for `commandKey`. Reads the selected column first;
 * falls back to the drawing-tool handle when no entity is selected. Returns
 * `null` for keys this bridge doesn't own.
 */
export function resolveColumnComboboxState(
  commandKey: string,
  column: ColumnEntity | null,
  toolHandle: ColumnToolBridgeHandle | null,
): RibbonComboboxState | null {
  // ── SELECTED ENTITY BRANCH ────────────────────────────────────────────
  if (column) {
    // ADR-396 v2 Φ6a — ETICS override: undefined (απών) → 'auto' sentinel.
    if (commandKey === COLUMN_RIBBON_KEYS.stringParams.envelopeFunction) {
      return { value: readEnvelopeFunctionValue(column.params.envelopeFunction), options: [] };
    }
    // ADR-449 Slice 5 — σοβάς per-element override (enabled/υλικά/πάχος).
    if (isColumnFinishKey(commandKey)) {
      return resolveFinishComboboxState(column.params.finish, commandKey, COLUMN_FINISH_KEY_TO_FIELD);
    }
    // ADR-456 Slice 2 — δομοστατικά: editable keys (κανονισμός/σκυρ./οπλισμός)
    // + read-only readouts (βάρη/ρ%).
    if (isColumnStructuralKey(commandKey)) {
      return resolveColumnStructuralState(column, commandKey);
    }
    if (isColumnStructuralReadoutKey(commandKey)) {
      return resolveColumnStructuralReadout(column, commandKey);
    }
    if (isColumnRibbonStringKey(commandKey)) {
      const field = STRING_KEY_TO_FIELD[commandKey];
      const raw = column.params[field];
      // ADR-363 Phase 8E — catalogProfile absent = 'custom' sentinel.
      if (field === 'catalogProfile') return { value: raw != null ? String(raw) : CATALOG_CUSTOM_SENTINEL, options: [] };
      // ADR-363 Phase 4.5d — surface 'rc' as the active selection when
      // `params.material` is undefined; mirrors the `resolveMaterialKey`
      // fallback used by `ColumnRenderer.drawMaterialHatch`.
      if (raw == null) {
        if (field === 'material') return { value: 'rc', options: [] };
        return null;
      }
      return { value: String(raw), options: [] };
    }
    if (isNestedNumberKey(commandKey)) {
      const path = NESTED_NUMBER_KEY_TO_PATH[commandKey];
      return { value: String(Math.round(readNestedValue(column.params, path))), options: [] };
    }
    if (isColumnRibbonKey(commandKey)) {
      const field = NUMBER_KEY_TO_FIELD[commandKey];
      const raw = column.params[field];
      if (typeof raw !== 'number') return null;
      // ADR-449/451 — storey/level-bound κολώνα: το «Ύψος» είναι derived (storey ceiling),
      // ΟΧΙ editable· read-only + δείξε τη resolved τιμή (ΙΔΙΑ SSoT με τον πυρήνα). Editable
      // ΜΟΝΟ σε `unconnected` top (όπου το `params.height` έχει πραγματικό νόημα).
      if (commandKey === COLUMN_RIBBON_KEYS.params.height && isColumnHeightDerived(column.params.topBinding)) {
        const derived = deriveStoreyBoundHeightMm(column) ?? raw;
        return { value: String(Math.round(derived)), options: [], disabled: true };
      }
      return { value: String(Math.round(raw)), options: [] };
    }
    return null;
  }
  // ── DRAWING-MODE BRANCH (no selection, tool active) ──────────────────
  // ADR-363 Phase 8D — Read from `columnToolBridgeStore` so the kind dropdown
  // + variant numeric inputs drive `useColumnTool` directly when creating a new
  // column. Mirrors Revit/ArchiCAD "Properties" panel UX.
  if (!toolHandle || !toolHandle.isActive) return null;
  if (commandKey === COLUMN_RIBBON_KEYS.stringParams.kind) {
    return { value: toolHandle.kind, options: [] };
  }
  if (commandKey === COLUMN_RIBBON_KEYS.stringParams.anchor) {
    return { value: toolHandle.anchor, options: [] };
  }
  if (commandKey === COLUMN_RIBBON_KEYS.stringParams.catalogProfile) {
    return { value: toolHandle.overrides.catalogProfile ?? CATALOG_CUSTOM_SENTINEL, options: [] };
  }
  if (isNestedNumberKey(commandKey)) {
    const path = NESTED_NUMBER_KEY_TO_PATH[commandKey];
    const group = path.group === 'polygon' ? toolHandle.overrides.polygon : toolHandle.overrides.ishape;
    const raw = group ? (group as Record<string, unknown>)[path.field] : undefined;
    const value = typeof raw === 'number' ? raw : path.defaultValue;
    return { value: String(Math.round(value)), options: [] };
  }
  if (isColumnRibbonKey(commandKey)) {
    const field = NUMBER_KEY_TO_FIELD[commandKey];
    const raw = (toolHandle.overrides as Record<string, unknown>)[field];
    if (typeof raw !== 'number') return null;
    return { value: String(Math.round(raw)), options: [] };
  }
  return null;
}

/**
 * Apply a combobox change for `commandKey`. Writes the selected column via
 * `dispatchParams`, or the drawing-tool handle (read live from the store) when
 * no entity is selected. No-ops on keys this bridge doesn't own.
 */
export function applyColumnComboboxChange(
  commandKey: string,
  value: string,
  column: ColumnEntity | null,
  dispatchParams: (column: ColumnEntity, nextParams: ColumnParams) => void,
): void {
  // ── SELECTED ENTITY BRANCH ────────────────────────────────────────────
  if (column) {
    // ADR-396 v2 Φ6a — ETICS override: 'auto' → clear (undefined)· άκυρη → no-op.
    if (commandKey === COLUMN_RIBBON_KEYS.stringParams.envelopeFunction) {
      const parsed = parseEnvelopeFunctionValue(value);
      if (!parsed) return;
      dispatchParams(column, { ...column.params, envelopeFunction: parsed.fn });
      return;
    }
    // ADR-449 Slice 5 — σοβάς per-element override (enabled/υλικά/πάχος).
    if (isColumnFinishKey(commandKey)) {
      const next = applyFinishComboboxChange(column.params, commandKey, value, COLUMN_FINISH_KEY_TO_FIELD);
      if (next) dispatchParams(column, next);
      return;
    }
    // ADR-456 Slice 2 — δομοστατικά: κανονισμός→building setting, κατηγορία
    // σκυρ.→per-element, οπλισμός→patch (από τον effective code-suggested).
    if (isColumnStructuralKey(commandKey)) {
      applyColumnStructuralChange(column, commandKey, value, (next) => dispatchParams(column, next));
      return;
    }
    // ADR-363 Phase 8E — catalog preset: batch-write all preset dims + catalogProfile.
    if (commandKey === COLUMN_RIBBON_KEYS.stringParams.catalogProfile) {
      applyEntityCatalogPreset(column, value, dispatchParams);
      return;
    }
    if (isColumnRibbonStringKey(commandKey)) {
      const field = STRING_KEY_TO_FIELD[commandKey];
      if (field === 'kind') {
        const nextParams: ColumnParams = { ...column.params, kind: value as ColumnKind };
        dispatchParams(column, nextParams);
        return;
      }
      if (field === 'anchor') {
        const nextParams: ColumnParams = { ...column.params, anchor: value as ColumnAnchor };
        dispatchParams(column, nextParams);
        return;
      }
      if (field === 'material') {
        const nextParams: ColumnParams = { ...column.params, material: value };
        dispatchParams(column, nextParams);
      }
      return;
    }
    if (isNestedNumberKey(commandKey)) {
      const numeric = Number.parseFloat(value);
      if (Number.isNaN(numeric)) return;
      const path = NESTED_NUMBER_KEY_TO_PATH[commandKey];
      const patched = patchNestedParams(column.params, path, numeric);
      const clearCatalog = catalogOwnsNestedParam(commandKey, column.params.kind);
      dispatchParams(column, clearCatalog ? { ...patched, catalogProfile: undefined } : patched);
      return;
    }
    if (isColumnRibbonKey(commandKey)) {
      const numeric = Number.parseFloat(value);
      if (Number.isNaN(numeric)) return;
      const field = NUMBER_KEY_TO_FIELD[commandKey];
      const clearCatalog = catalogOwnsDimension(commandKey, column.params.kind);
      const nextParams = {
        ...column.params,
        [field]: numeric,
        ...(clearCatalog ? { catalogProfile: undefined } : {}),
      } as ColumnParams;
      dispatchParams(column, nextParams);
    }
    return;
  }

  // ── DRAWING-MODE BRANCH ───────────────────────────────────────────────
  // ADR-363 Phase 8D/8E — Forward writes to `useColumnTool` via the store handle
  // so subsequent canvas clicks create columns with the chosen kind + variant
  // params + anchor + catalog profile.
  const handle = columnToolBridgeStore.get();
  if (!handle || !handle.isActive) return;
  if (commandKey === COLUMN_RIBBON_KEYS.stringParams.kind) {
    handle.setKind(value as ColumnKind);
    return;
  }
  if (commandKey === COLUMN_RIBBON_KEYS.stringParams.anchor) {
    handle.setAnchor(value as ColumnAnchor);
    return;
  }
  // ADR-363 Phase 8E — catalog preset in drawing mode.
  if (commandKey === COLUMN_RIBBON_KEYS.stringParams.catalogProfile) {
    applyToolCatalogPreset(handle, value);
    return;
  }
  if (isNestedNumberKey(commandKey)) {
    const numeric = Number.parseFloat(value);
    if (Number.isNaN(numeric)) return;
    const path = NESTED_NUMBER_KEY_TO_PATH[commandKey];
    if (path.group === 'polygon') {
      handle.setParamOverrides({ polygon: { ...(handle.overrides.polygon ?? {}), [path.field]: numeric } });
    } else {
      const clearCatalog = catalogOwnsNestedParam(commandKey, handle.kind);
      const nextIshape: ColumnIShapeParams = { ...(handle.overrides.ishape ?? {}), [path.field]: numeric };
      handle.setParamOverrides({ ishape: nextIshape, ...(clearCatalog ? { catalogProfile: undefined } : {}) });
    }
    return;
  }
  if (isColumnRibbonKey(commandKey)) {
    const numeric = Number.parseFloat(value);
    if (Number.isNaN(numeric)) return;
    const field = NUMBER_KEY_TO_FIELD[commandKey];
    const clearCatalog = catalogOwnsDimension(commandKey, handle.kind);
    handle.setParamOverrides({ [field]: numeric, ...(clearCatalog ? { catalogProfile: undefined } : {}) });
  }
}
