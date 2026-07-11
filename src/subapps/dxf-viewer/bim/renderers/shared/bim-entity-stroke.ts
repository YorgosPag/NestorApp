/**
 * ADR-375 Phase D — Unified BIM entity stroke resolver (shared helper / SSoT).
 *
 * Collapses the per-renderer boilerplate — store reads (`objectStyles` +
 * `drawingScale`) + `layerOverride` assembly + `resolveSubcategoryStyle` call —
 * into ONE call so EVERY BIM 2D renderer (structural AND MEP / furniture /
 * architectural) resolves its CONTENT line width + pattern + color identically.
 *
 * Before this helper the same ~10-line block was copy-pasted across the
 * structural renderers (Wall/Column/Slab/Beam/Opening/Foundation/Stair/
 * SlabOpening) — a token-clone that N.18 (jscpd) + N.0.2 flag. Every migrated
 * renderer now routes its footprint/body outline through here in a few lines.
 *
 * **Scope — CONTENT only.** UI *chrome* (hover glow, grips, selection marquee,
 * snap markers) stays fixed screen-px per renderer (`RENDER_LINE_WIDTHS`) and
 * MUST NOT go through this helper — Revit likewise paints chrome at a constant
 * screen weight. Schematic *symbol glyphs* inside an entity (radiator fins,
 * breaker-row dividers, family X-marks) also stay thin/fixed as symbolic
 * annotation; only the entity's real body/footprint outline is CONTENT.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-375-bim-object-styles-pen-table.md
 * @see bim/renderers/ColumnRenderer.ts — canonical caller pattern
 */
import {
  resolveSubcategoryStyle,
  type ResolvedSubcategoryStyle,
  type BimLayerOverride,
} from '../../../config/bim-line-weight-resolver';
import type {
  BimCategory,
  BimElementStyleOverride,
  ObjectStyle,
} from '../../../config/bim-object-styles';
import type { CutState } from '../../../config/bim-view-range';
import { isConcreteLineweight } from '../../../config/lineweight-iso-catalog';
import { bimDashPx } from '../../../config/bim-dash-resolver';
import { useDrawingScaleStore } from '../../../state/drawing-scale-store';
import type { SceneLayer } from '../../../types/entities';

/**
 * Build the ADR-375 C.6 layer override from a `SceneLayer` (was duplicated
 * verbatim across every structural renderer). Concrete layer lineweight → mm
 * override; layer color → color override. Returns `undefined` for no layer.
 */
export function buildBimLayerOverride(
  layer: SceneLayer | null | undefined,
): BimLayerOverride | undefined {
  if (!layer) return undefined;
  return {
    lineweightMm: isConcreteLineweight(layer.lineweight) ? layer.lineweight : undefined,
    color: layer.color ?? undefined,
  };
}

export interface BimEntityStrokeInput {
  /** BIM category — drives the pen from `DEFAULT_OBJECT_STYLES`. */
  category: BimCategory;
  /** Cut vs projection vs beyond. Flat 2D symbols pass `'projection'`. */
  cutState: CutState;
  /** Optional subcategory key (e.g. `'edges'`, `'shear-wall'`). */
  subcategoryKey?: string;
  /** `SceneLayer` already fetched for the visibility check (`getLayer`). */
  layer?: SceneLayer | null;
  /** Per-element override (`entity.styleOverride`). */
  elementOverride?: BimElementStyleOverride;
  /** Defaults to the drawing-scale store's `objectStyles`. */
  objectStyles?: Partial<Record<BimCategory, ObjectStyle>>;
  /** Defaults to the drawing-scale store's `drawingScale`. */
  scaleDenominator?: number;
  /** Screen DPI (default 96). */
  dpi?: number;
}

/**
 * Resolve a BIM entity's CONTENT stroke (width + pattern + color) via the
 * ADR-375/377 SSoT. Reads `objectStyles` + `drawingScale` from the store when
 * not explicitly supplied (single synchronous `getState()` — ADR-040 safe).
 */
export function resolveBimEntityStroke(
  input: BimEntityStrokeInput,
): ResolvedSubcategoryStyle {
  const store = useDrawingScaleStore.getState();
  return resolveSubcategoryStyle({
    category: input.category,
    subcategoryKey: input.subcategoryKey,
    cutState: input.cutState,
    scaleDenominator: input.scaleDenominator ?? store.drawingScale,
    dpi: input.dpi ?? 96,
    objectStyles: input.objectStyles ?? store.objectStyles,
    elementOverride: input.elementOverride,
    layerOverride: buildBimLayerOverride(input.layer),
  });
}

/** Options for {@link applyBimContentStroke}. */
export interface ApplyBimStrokeOptions {
  /** `transform.scale` — converts the resolved `linePattern` to device-px dashes. */
  scale: number;
  /**
   * When true, also set `ctx.strokeStyle` from the resolved color (if non-null).
   * Default **false** — renderers whose color is dynamic (colour-by-system /
   * per-classification / per-kind identity, e.g. MEP) keep their own strokeStyle
   * and take only the width + pattern from the SSoT.
   */
  applyColor?: boolean;
}

/**
 * Resolve + apply a BIM entity's CONTENT stroke to a canvas context: sets
 * `lineWidth` and the dash pattern, and (opt-in) `strokeStyle`. Returns the
 * resolved style so callers can read `.color` for a custom fallback.
 */
export function applyBimContentStroke(
  ctx: CanvasRenderingContext2D,
  input: BimEntityStrokeInput,
  opts: ApplyBimStrokeOptions,
): ResolvedSubcategoryStyle {
  const style = resolveBimEntityStroke(input);
  ctx.lineWidth = style.lineWidthPx;
  ctx.setLineDash(bimDashPx(style.linePattern, opts.scale));
  if (opts.applyColor && style.color !== null) ctx.strokeStyle = style.color;
  return style;
}
