'use client';

/**
 * dimension-property-model — ADR-362 §7 / ADR-357 Phase 10.
 *
 * Read/apply model for a DIMENSION in the Full Properties Palette (F11/Ctrl+1),
 * mirror of the LINE model in `entity-property-schema.ts`. Pure — no React.
 *
 * REUSE (μηδέν νέο write-path / formatter / resolver):
 *  - `resolveDimStyle(entity, registry)` — resolved per-part DIMSTYLE (base+overrides).
 *  - `buildDimensionGeometry` + `formatLinear/AngularMeasurement` — read-only μετρημένη τιμή.
 *  - `formatCoordinateForDisplay` — SSoT coordinate readout (mm → display unit).
 *  - `resolveDimColorTC` / `findClosestAci` / `hexToTrueColor` — ίδιο color pipeline με το bridge.
 *  - Apply → ΕΝΑ generic `UpdateEntityCommand({ overrides, layerId, textRotation, userText })`
 *    (η παλέτα το εκτελεί)· εδώ χτίζουμε μόνο το patch object.
 *
 * Split προορισμός του patch: entity-root fields (`layerId/textRotation/userText`) vs
 * nested `overrides` (per-part DIMSTYLE) — ίδιο μοντέλο με το `useRibbonDimBridge`.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-362-enterprise-dimension-system.md §7
 */

import type { DisplayUnit } from '../../config/units';
import type { DimensionEntity, DimStyle } from '../../types/dimension';
import { resolveDimStyle } from '../dimensions/dim-style-resolver';
import { getDimStyleRegistry } from '../dimensions/dim-style-registry';
import { buildDimensionGeometry } from '../dimensions/dim-geometry-builder';
import {
  formatLinearMeasurement,
  formatAngularMeasurement,
} from '../dimensions/dim-text-formatter';
import { resolveArrowBlockNames } from '../dimensions/dim-arrowhead-blocks';
import { resolveDimColorTC } from '../../rendering/entities/dimension/dim-color-resolver';
import { formatCoordinateForDisplay } from '../../config/display-length-format';
import { findClosestAci } from '../../settings/standards/aci';
import { hexToTrueColor } from '../../utils/dxf-true-color';
import { LINEWEIGHT_SPECIAL } from '../../config/lineweight-iso-catalog';
import type { LineweightMm } from '../../types/entities';

const BYLAYER = 'ByLayer';

// Form state = all values as strings (like LineFormState). The static DIMENSION_SCHEMA
// (groups/descriptors) lives in `entity-property-schema.ts` (pure data, no dim-domain
// imports) to keep the shared schema module free of a runtime cycle with this model.
export type DimensionFormState = Record<string, string>;

/** LineweightMm → combobox string (-2 → 'ByLayer'). Mirror του bridge. */
function lineweightToValue(lw: LineweightMm): string {
  return lw === LINEWEIGHT_SPECIAL.BYLAYER ? BYLAYER : String(lw);
}

/** Read-only measured value (mm→display for linear/radial, rad→deg for angular). */
function readMeasurement(dim: DimensionEntity, style: DimStyle): string {
  try {
    const geometry = buildDimensionGeometry(dim, style);
    const isAngular = dim.dimensionType.startsWith('angular');
    return isAngular
      ? formatAngularMeasurement(geometry.measurementValue, style)
      : formatLinearMeasurement(geometry.measurementValue, style);
  } catch {
    return '—'; // degenerate / unresolved geometry
  }
}

/** «x, y» formatted coordinate for a def point, or '' when the point is absent. */
function readPoint(dim: DimensionEntity, index: number, unit: DisplayUnit): string {
  const p = dim.defPoints[index];
  if (!p) return '';
  return `${formatCoordinateForDisplay(p.x, { unit })}, ${formatCoordinateForDisplay(p.y, { unit })}`;
}

/** Editable style-derived values from the RESOLVED style (base + entity overrides). */
function readStyleValues(style: DimStyle): DimensionFormState {
  return {
    dimclrd: resolveDimColorTC(style.dimclrdTrueColor, style.dimclrd),
    dimlwd: lineweightToValue(style.dimlwd),
    dimltype: String(style.dimltype ?? ''),
    dimclrt: resolveDimColorTC(style.dimclrtTrueColor, style.dimclrt),
    dimtxt: String(style.dimtxt ?? ''),
    dimtad: String(style.dimtad ?? ''),
    dimblk: String(resolveArrowBlockNames(style).block1),
    dimasz: String(style.dimasz ?? ''),
    dimscale: String(style.dimscale ?? 1),
    dimlunit: String(style.dimlunit ?? ''),
    dimdec: String(style.dimdec ?? ''),
  };
}

/** Build the full form-state for a selected dimension (editable + read-only rows). */
export function buildDimensionFormState(
  dim: DimensionEntity,
  displayUnit: DisplayUnit,
): DimensionFormState {
  const style = resolveDimStyle(dim, getDimStyleRegistry());
  const styleName = getDimStyleRegistry().getStyle(dim.styleId)?.name ?? dim.styleId;
  return {
    ...readStyleValues(style),
    // Entity-level (not DIMSTYLE) fields.
    layerId: dim.layerId ?? '',
    textRotation: String(dim.textRotation ?? 0),
    userText: dim.userText ?? '',
    // Read-only geometry inspector.
    dimType: dim.dimensionType,
    measurement: readMeasurement(dim, style),
    point1: readPoint(dim, 0, displayUnit),
    point2: readPoint(dim, 1, displayUnit),
    styleName,
    associations: String(dim.associations?.length ?? 0),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Apply (form → undoable patch: entity-root fields + nested `overrides`)
// ─────────────────────────────────────────────────────────────────────────────

/** Parse a numeric form value, or `undefined` when invalid / negative. */
function parseNonNegative(value: string): number | undefined {
  const n = parseFloat(value);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

/** Diff a color row (hex) vs the resolved style → write ACI + true-color companion. */
function applyColor(
  formHex: string,
  currentHex: string,
  aciField: keyof DimStyle,
  tcField: keyof DimStyle,
  ov: Record<string, unknown>,
): boolean {
  if (formHex.trim().toLowerCase() === currentHex.trim().toLowerCase()) return false;
  ov[aciField] = findClosestAci(formHex);
  ov[tcField] = hexToTrueColor(formHex);
  return true;
}

/**
 * Build the undoable patch from the edited form. Compares each field against the
 * RESOLVED style / entity so only genuine changes are written. Returns `{}` when
 * nothing changed (caller skips the command → no undo pollution).
 */
export function buildDimensionPatch(
  dim: DimensionEntity,
  form: DimensionFormState,
): Record<string, unknown> {
  const style = resolveDimStyle(dim, getDimStyleRegistry());
  const current = readStyleValues(style);
  const patch: Record<string, unknown> = {};
  const ov: Record<string, unknown> = { ...(dim.overrides ?? {}) };
  let ovChanged = false;

  // Colors (hex → ACI + true-color companion).
  if (applyColor(form.dimclrd, current.dimclrd, 'dimclrd', 'dimclrdTrueColor', ov)) ovChanged = true;
  if (applyColor(form.dimclrt, current.dimclrt, 'dimclrt', 'dimclrtTrueColor', ov)) ovChanged = true;

  // Lineweight (ByLayer → -2 sentinel).
  if (form.dimlwd !== current.dimlwd) {
    ov.dimlwd = form.dimlwd === BYLAYER ? LINEWEIGHT_SPECIAL.BYLAYER : parseFloat(form.dimlwd);
    ovChanged = true;
  }

  // Plain string enums / names.
  if (form.dimltype !== current.dimltype) { ov.dimltype = form.dimltype; ovChanged = true; }
  if (form.dimtad !== current.dimtad) { ov.dimtad = form.dimtad; ovChanged = true; }
  if (form.dimlunit !== current.dimlunit) { ov.dimlunit = form.dimlunit; ovChanged = true; }
  // Arrow style writes dimblk + clears dimblk1/2 so both heads inherit the unified block.
  if (form.dimblk !== current.dimblk) {
    ov.dimblk = form.dimblk; ov.dimblk1 = ''; ov.dimblk2 = ''; ovChanged = true;
  }

  // Numerics (skip invalid input silently).
  for (const key of ['dimtxt', 'dimasz', 'dimscale', 'dimdec'] as const) {
    if (form[key] !== current[key]) {
      const n = parseNonNegative(form[key]);
      if (n !== undefined) { ov[key] = key === 'dimdec' ? Math.round(n) : n; ovChanged = true; }
    }
  }

  if (ovChanged) patch.overrides = ov;

  // Entity-root fields (NOT DIMSTYLE overrides).
  if (form.layerId && form.layerId !== (dim.layerId ?? '')) patch.layerId = form.layerId;
  const deg = parseFloat(form.textRotation);
  if (Number.isFinite(deg) && deg !== (dim.textRotation ?? 0)) patch.textRotation = deg;
  if (form.userText !== (dim.userText ?? '')) patch.userText = form.userText;

  return patch;
}
