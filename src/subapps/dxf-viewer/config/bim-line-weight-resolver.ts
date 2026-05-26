/**
 * ADR-375 — BIM Line Weight Resolver (orchestrator)
 * ADR-377 — Subcategory style resolution extension
 *
 * Pipeline: category + cutState + scale → pen index → ISO mm → px
 *
 * Uses lineweightToPx from ADR-358 SSoT (no mm→px duplication).
 */
import { PEN_TABLE_MM, SCALE_COLUMNS, type PenIndex } from './bim-pen-table';
import type { EffectivePenTable } from './bim-pen-table-types';
import { DEFAULT_OBJECT_STYLES, type BimCategory, type ObjectStyle, type BimElementStyleOverride } from './bim-object-styles';
import { type CutState } from './bim-view-range';
import { lineweightToPx, isConcreteLineweight, type ConcreteLineweightMm } from './lineweight-iso-catalog';
import { type LinePatternKey } from './bim-line-patterns';

/** Map a numeric view scale denominator (e.g., 100 for 1:100) to nearest SCALE_COLUMN index. */
export function closestScaleColumn(scaleDenominator: number): number {
  const numerics = SCALE_COLUMNS.map(s => parseInt(s.split(':')[1], 10));
  let bestIdx = 0;
  let bestDiff = Math.abs(numerics[0] - scaleDenominator);
  for (let i = 1; i < numerics.length; i++) {
    const diff = Math.abs(numerics[i] - scaleDenominator);
    if (diff < bestDiff) { bestDiff = diff; bestIdx = i; }
  }
  return bestIdx;
}

export interface LineWeightContext {
  category: BimCategory;
  cutState: CutState;
  /** Print scale denominator, e.g. 100 for 1:100 (default 100). */
  scaleDenominator: number;
  /** Screen DPI (default 96). */
  dpi?: number;
  /**
   * ADR-375 Phase B.2: per-view ObjectStyles overrides.
   * When present, merged with DEFAULT_OBJECT_STYLES (override wins).
   * Renderers pass `useBimRenderSettingsStore.getState().objectStyles`.
   */
  objectStyles?: Partial<Record<BimCategory, ObjectStyle>>;
}

/** ADR-375 Phase C.6 — Layer-driven lineweight/color override. */
export interface BimLayerOverride {
  /** Concrete ISO mm value from SceneLayer.lineweight. undefined = no override. */
  lineweightMm?: ConcreteLineweightMm;
  /** Layer color hex or null. undefined = no override. */
  color?: string | null;
}

export interface SubcategoryResolutionContext extends LineWeightContext {
  /** Subcategory key for this render pass (e.g., 'treads', 'common-edges'). */
  subcategoryKey?: string;
  /** Per-element style override (ADR-375 C.5). Highest priority after hidden/category-visible. */
  elementOverride?: BimElementStyleOverride;
  /** Per-layer lineweight/color override (ADR-375 C.6). */
  layerOverride?: BimLayerOverride;
}

export interface ResolvedSubcategoryStyle {
  /** Pixel line width (post-conversion mm → px). */
  lineWidthPx: number;
  /** Line pattern key (defaults to 'solid'). */
  linePattern: LinePatternKey;
  /** Color hex or null (null = use canvas token). */
  color: string | null;
}

/**
 * Resolve whether a BIM category is visible in the current per-view override.
 *
 * ADR-375 Phase C.4: per-view visibility toggle.
 * Returns false only when the override explicitly sets `visible: false`.
 */
export function resolveIsCategoryVisible(
  category: BimCategory,
  objectStyles?: Partial<Record<BimCategory, ObjectStyle>>,
): boolean {
  if (!objectStyles) return true;
  return objectStyles[category]?.visible !== false;
}

/**
 * Active pen table — defaults to PEN_TABLE_MM.
 * Replaced at runtime by `setPenTableSource` when the pen table store loads
 * per-company overrides (ADR-375 Phase C.1). No renderer changes needed.
 */
let _activePenTable: EffectivePenTable = PEN_TABLE_MM;

/** Called by bim-pen-table-store whenever overrides are loaded or updated. */
export function setPenTableSource(table: EffectivePenTable): void {
  _activePenTable = table;
}

/** <Beyond> uses the finest pen (Pen #3) per Revit Line Styles default. */
const BEYOND_PEN: PenIndex = 3;

/**
 * Resolve full subcategory style for a BIM render pass (ADR-377 Phase B, ADR-375 Phase C.4+C.5+C.6).
 *
 * Resolution order (highest priority first):
 *   1. hidden cutState → zero/solid/null
 *   2. category visible=false (C.4 per-view) → zero/solid/null
 *   3. elementOverride.visible === false (C.5 per-element) → zero/solid/null
 *   4. elementOverride.cutPen / projectionPen (C.5) → override pen + optional color/pattern
 *   5. layerOverride.lineweightMm (C.6) → concrete mm → px (bypass pen table)
 *   6. subcategory override (per-subcategory key)
 *   7. per-view category V/G override (C.4: color + pattern)
 *   8. DEFAULT_OBJECT_STYLES global defaults
 *
 * Partial elementOverride (color/pattern only, no pen) falls through to step 5-8 for pen,
 * but the override color/pattern takes priority at final assembly.
 */
export function resolveSubcategoryStyle(
  ctx: SubcategoryResolutionContext,
): ResolvedSubcategoryStyle {
  if (ctx.cutState === 'hidden') {
    return { lineWidthPx: 0, linePattern: 'solid', color: null };
  }

  const styles = ctx.objectStyles
    ? { ...DEFAULT_OBJECT_STYLES, ...ctx.objectStyles }
    : DEFAULT_OBJECT_STYLES;
  const parent = styles[ctx.category];

  // ADR-375 C.4 — category visibility toggle
  if (parent.visible === false) {
    return { lineWidthPx: 0, linePattern: 'solid', color: null };
  }

  const sub = ctx.subcategoryKey
    ? parent.subcategories?.[ctx.subcategoryKey]
    : undefined;

  // ADR-375 C.5 — per-element visibility (beats subcategory and V/G)
  if (ctx.elementOverride?.visible === false) {
    return { lineWidthPx: 0, linePattern: 'solid', color: null };
  }

  // ADR-375 C.5 — per-element pen override (wins over subcategory + objectStyles)
  if (ctx.elementOverride) {
    const overridePen = ctx.cutState === 'cut'
      ? (ctx.elementOverride.cutPen ?? null)
      : (ctx.elementOverride.projectionPen ?? null);
    if (overridePen !== null) {
      const scaleCol = closestScaleColumn(ctx.scaleDenominator);
      const mm = _activePenTable[overridePen - 1][scaleCol];
      const lineWidthPx = lineweightToPx(mm, ctx.dpi ?? 96);
      const color = ctx.elementOverride.color !== undefined
        ? ctx.elementOverride.color
        : (ctx.cutState === 'cut'
            ? (sub?.cutColor ?? parent.cutColor ?? null)
            : (sub?.projectionColor ?? parent.projectionColor ?? null));
      const linePattern = ctx.elementOverride.linePattern
        ?? (sub?.linePattern ?? (ctx.cutState === 'cut'
            ? (parent.cutPattern ?? 'solid')
            : (parent.projectionPattern ?? 'solid')));
      return { lineWidthPx, linePattern, color };
    }
  }

  // ADR-375 C.6 — layer lineweight override (concrete mm → px, bypasses pen table)
  if (ctx.layerOverride?.lineweightMm !== undefined) {
    const lineWidthPx = lineweightToPx(ctx.layerOverride.lineweightMm, ctx.dpi ?? 96);
    const color = ctx.elementOverride?.color !== undefined
      ? ctx.elementOverride.color
      : (ctx.layerOverride.color !== undefined
          ? ctx.layerOverride.color
          : (ctx.cutState === 'cut'
              ? (sub?.cutColor ?? parent.cutColor ?? null)
              : (sub?.projectionColor ?? parent.projectionColor ?? null)));
    const linePattern = ctx.elementOverride?.linePattern
      ?? (sub?.linePattern ?? (ctx.cutState === 'cut'
          ? (parent.cutPattern ?? 'solid')
          : (parent.projectionPattern ?? 'solid')));
    return { lineWidthPx, linePattern, color };
  }

  let penIdx: PenIndex;
  if (ctx.cutState === 'cut') {
    penIdx = sub?.cutPen ?? parent.cutPen;
  } else if (ctx.cutState === 'projection') {
    penIdx = sub?.projectionPen ?? parent.projectionPen;
  } else {
    penIdx = BEYOND_PEN;
  }

  const scaleCol = closestScaleColumn(ctx.scaleDenominator);
  const mm = _activePenTable[penIdx - 1][scaleCol];
  const lineWidthPx = lineweightToPx(mm, ctx.dpi ?? 96);

  // ADR-375 C.4+C.5+C.6 — color: elementOverride > layerOverride > subcategory > parent V/G > null
  const color = ctx.elementOverride?.color !== undefined
    ? ctx.elementOverride.color
    : (ctx.layerOverride?.color !== undefined
        ? ctx.layerOverride.color
        : (ctx.cutState === 'cut'
            ? (sub?.cutColor ?? parent.cutColor ?? null)
            : (sub?.projectionColor ?? parent.projectionColor ?? null)));

  // ADR-375 C.4+C.5 — pattern: elementOverride > subcategory > parent V/G > 'solid'
  const linePattern = ctx.elementOverride?.linePattern
    ?? (sub?.linePattern ?? (ctx.cutState === 'cut'
        ? (parent.cutPattern ?? 'solid')
        : (parent.projectionPattern ?? 'solid')));

  return { lineWidthPx, linePattern, color };
}

/** Resolve line weight in pixels. Backward-compatible wrapper around resolveSubcategoryStyle. */
export function resolveLineWeightPx(ctx: LineWeightContext): number {
  return resolveSubcategoryStyle(ctx).lineWidthPx;
}
