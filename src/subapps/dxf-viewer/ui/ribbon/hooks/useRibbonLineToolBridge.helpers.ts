/**
 * Pure value/patch helpers for {@link useRibbonLineToolBridge}.
 *
 * Extracted from the bridge hook (N.7.1 500-line budget). These are stateless
 * read/format/patch helpers over a selected entity + the ribbon combobox model —
 * no React, no store subscriptions. Kept in one place so the bridge hook stays a
 * thin orchestrator.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-510-line-creation-system.md §Φ2E/Φ4
 */

import type { AnySceneEntity } from '../../../types/entities';
import { LINEWEIGHT_SPECIAL } from '../../../config/lineweight-iso-catalog';
import { toDisplay, fromDisplay } from '../../../config/units';
import { displayUnitState } from '../../../config/display-unit-state';
import type { RibbonComboboxOption } from '../types/ribbon-types';
import {
  LINE_STYLE_BYLAYER_LWT,
  LINE_STYLE_BYLAYER_PEN,
  type LineStyle,
} from '../../../systems/line-styles/line-style-types';
import { hexToTrueColor } from '../../../utils/dxf-true-color';
import { findClosestAci } from '../../../settings/standards/aci';
import type { Point2D } from '../../../rendering/types/Types';
import {
  LINE_TOOL_RIBBON_KEYS,
  LINE_TOOL_PANEL_VISIBILITY_KEYS,
} from './bridge/line-tool-command-keys';

export const BYLAYER = 'ByLayer';
// Transparency helpers κεντρικοποιήθηκαν στο `ribbon-entity-bridge-shared` (κοινά με το
// hatch bridge, N.18) — re-export ώστε η διαδρομή import από εδώ να μένει σταθερή.
export { entityTransparencyValue, clampTransparency } from './ribbon-entity-bridge-shared';

/** Combobox display value for an entity's linetype (declared, not resolved — Revit shows «By Layer»). */
export function entityLinetypeValue(entity: AnySceneEntity): string {
  return entity.linetypeName && entity.linetypeName.length > 0 ? entity.linetypeName : BYLAYER;
}

/** Combobox display value for an entity's lineweight. */
export function entityLineweightValue(entity: AnySceneEntity): string {
  const lw = entity.lineweightMm;
  if (lw === undefined || lw === LINEWEIGHT_SPECIAL.BYLAYER) return BYLAYER;
  return String(lw);
}

/** Combobox display value for an entity's per-object linetype scale (CELTSCALE). */
export function entityLtscaleValue(entity: AnySceneEntity): string {
  return String(entity.ltscale ?? 1);
}

/** Polyline-like entity shape carrying the Φ3d per-segment width arrays. */
export interface WidthCapableEntity {
  readonly type: string;
  readonly vertices?: ReadonlyArray<unknown>;
  readonly closed?: boolean;
  readonly startWidths?: readonly number[];
  readonly endWidths?: readonly number[];
  readonly constantWidth?: number;
}

/** Only polylines carry an edge-to-edge width. */
export function isPolylineLike(type: string): boolean {
  return type === 'polyline' || type === 'lwpolyline';
}

/** Current uniform width of a polyline, in the active display unit (string). */
export function entityWidthDisplayValue(entity: WidthCapableEntity): string {
  const mm = entity.startWidths?.find((w) => w > 0)
    ?? entity.endWidths?.find((w) => w > 0)
    ?? entity.constantWidth
    ?? 0;
  const { value } = toDisplay(mm, displayUnitState.getUnit());
  return String(value);
}

/**
 * Build a uniform-width patch (all segments share one width) from a display-unit
 * input. Returns null for a non-polyline, a degenerate polyline, or invalid input.
 */
export function widthPatchForEntity(
  entity: WidthCapableEntity,
  displayValue: string,
): Record<string, unknown> | null {
  if (!isPolylineLike(entity.type)) return null;
  const n = entity.vertices?.length ?? 0;
  if (n < 2) return null;
  const parsed = parseFloat(displayValue);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  const mm = fromDisplay(parsed, displayUnitState.getUnit());
  const segs = entity.closed ? n : n - 1;
  return {
    startWidths: new Array(segs).fill(mm),
    endWidths: new Array(segs).fill(mm),
  };
}

// ─── ADR-510 Φ4 — General (layer/transparency) + Geometry (line) helpers ───────

/** Minimal shape of a scene layer for the ribbon dropdown (SSoT: LayerStore). */
interface LayerLike {
  readonly id?: string;
  readonly name: string;
}

/** Layer combobox options (value = id ?? name, label = name) from the live store. */
export function buildLayerOptions(layers: ReadonlyArray<LayerLike>): readonly RibbonComboboxOption[] {
  return layers.map((l) => ({
    value: l.id ?? l.name, labelKey: l.name, isLiteralLabel: true,
  }));
}

/** Combobox display value for an entity's per-object layer. */
export function entityLayerValue(entity: AnySceneEntity): string {
  return entity.layerId ?? '';
}

/**
 * ADR-570 Φ1 — entity patch that applies a LineStyle ByStyle: stores the pointer
 * and materialises its properties so the change is instantly visible + undoable.
 * ByLayer sentinels are skipped so the entity keeps inheriting its layer (Revit
 * built-ins carry ByLayer color; only weight + linetype differentiate them).
 */
export function byStylePatch(style: LineStyle): Record<string, unknown> {
  const patch: Record<string, unknown> = { lineStyleId: style.id };
  if (style.pattern) patch.linetypeName = style.pattern;
  if (style.lineweight !== LINE_STYLE_BYLAYER_LWT) {
    // `patch` is Record<string, unknown> — no cast needed; `style.lineweight` is the
    // ByStyle mm value (LineweightMm SSoT owned by lineweight-iso-catalog, not re-cast here).
    patch.lineweightMm = style.lineweight;
  }
  if (style.penColor !== LINE_STYLE_BYLAYER_PEN) {
    patch.colorMode = 'Concrete';
    patch.color = style.penColor;
    patch.colorTrueColor = hexToTrueColor(style.penColor);
    patch.colorAci = findClosestAci(style.penColor);
  }
  return patch;
}

/** Narrow a selected entity to a line with valid endpoints (Geometry gate). */
export function asLine(entity: AnySceneEntity | null): { start: Point2D; end: Point2D } | null {
  if (!entity || entity.type !== 'line') return null;
  const l = entity as unknown as { start?: Point2D; end?: Point2D };
  if (!l.start || !l.end) return null;
  return { start: l.start, end: l.end };
}

// ADR-677 Φάση 2β — the mm↔display string pair moved to the ribbon display-unit SSoT
// (`../units/ribbon-display-unit`), where the numeric-combobox boundary consumes it too.
// Re-exported so this module's import path stays stable; declaring it twice would be the
// exact sibling clone CHECK 3.28 exists to catch (CLAUDE.md N.18).
export { toDisp, fromDisp } from '../units/ribbon-display-unit';

/** The 8 AutoCAD «Geometry» command keys (line start/end/length/angle/delta). */
const LINE_GEOMETRY_KEYS: ReadonlySet<string> = new Set([
  LINE_TOOL_RIBBON_KEYS.length, LINE_TOOL_RIBBON_KEYS.angle,
  LINE_TOOL_RIBBON_KEYS.startX, LINE_TOOL_RIBBON_KEYS.startY,
  LINE_TOOL_RIBBON_KEYS.endX, LINE_TOOL_RIBBON_KEYS.endY,
  LINE_TOOL_RIBBON_KEYS.deltaX, LINE_TOOL_RIBBON_KEYS.deltaY,
]);
export function isLineGeometryKey(key: string): boolean {
  return LINE_GEOMETRY_KEYS.has(key);
}

/**
 * ADR-510 Φ4/Φ4g — pure panel-visibility resolver for the Line-Tool tab.
 * The Geometry panel is line-only; the fillet/chamfer option panels are
 * active-tool-only (Revit «Options Bar»); «Πλάτος» is polyline-only (or
 * draw-defaults). Extracted from the bridge hook for the N.7.1 size budget.
 */
export function resolveLinePanelVisibility(
  visibilityKey: string,
  selected: AnySceneEntity | null,
  activeTool: string,
): boolean {
  if (visibilityKey === LINE_TOOL_PANEL_VISIBILITY_KEYS.geometry) {
    return asLine(selected) !== null;
  }
  if (visibilityKey === LINE_TOOL_PANEL_VISIBILITY_KEYS.filletOptions) {
    return activeTool === 'fillet';
  }
  if (visibilityKey === LINE_TOOL_PANEL_VISIBILITY_KEYS.chamferOptions) {
    return activeTool === 'chamfer';
  }
  if (visibilityKey === LINE_TOOL_PANEL_VISIBILITY_KEYS.widthApplicable) {
    return selected === null || isPolylineLike(selected.type);
  }
  return true;
}
