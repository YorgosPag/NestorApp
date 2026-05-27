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
 * Resolve full subcategory style for a BIM render pass (ADR-377 Phase B, ADR-375 Phase C.4–C.6).
 *
 * **Industry-faithful priority stack (Revit V/G + ArchiCAD Graphic Override + AutoCAD Layer Override)**
 * — highest priority first:
 *
 *   1. cutState === 'hidden'                                        → zero/solid/null
 *   2. parent.visible === false  (C.4 category V/G visibility)      → zero/solid/null
 *   3. elementOverride.visible === false  (C.5 per-element)         → zero/solid/null
 *   4. elementOverride  (C.5 per-element user-set in view)          → pen/color/pattern wins
 *   5. **Sub Object Style default** (ADR-377 hardcoded subcategory) → when sub field is defined
 *   6. **V/G category override (C.4)** — user-explicit in `objectStyles[cat]` → wins over Layer
 *   7. **Layer override (C.6)** — `layerOverride.lineweightMm/.color` (LayerStore)
 *   8. DEFAULT_OBJECT_STYLES global (parent fallback)
 *
 * **Why V/G beats Layer (industry parity, 2026-05-26 v2.8 fix)**: Revit's "Override Graphics in View"
 * is the canonical "make this category look like X in THIS view" knob. It overrides Material/Layer
 * colors but NOT Object Style subcategory defaults (which encode structural intent like
 * `walkline` = dashed, `hidden-lines` = dashed — these are not user-V/G entries). ArchiCAD Graphic
 * Override Rule + AutoCAD Layer State Override σε layouts follow the same V/G > Layer pattern.
 * v2.6/v2.7 had the stack flipped (Layer > V/G), so V/G color/pen toggles did nothing on entities
 * with assigned layers (production entities). Resolves Giorgio runtime report 2026-05-26.
 *
 * **Beyond cutState special case**: Revit Line Styles always uses the finest pen (BEYOND_PEN) for
 * geometry below the view range — V/G category pen and Layer mm bypass are skipped to preserve
 * the representational convention.
 *
 * **User-set detection**: we look up `ctx.objectStyles?.[ctx.category]` (raw user input — NO merge
 * with DEFAULT_OBJECT_STYLES) so a `field !== undefined` check distinguishes user-explicit values
 * from globals. DEFAULT_OBJECT_STYLES carries only pen indices (no colors/patterns), so absence in
 * raw user input ⇒ "no V/G override active for this field".
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

  // ── Raw user V/G overrides (v2.8: `field !== undefined` ⇒ user explicitly set in panel) ───
  const userOverride = ctx.objectStyles?.[ctx.category];
  const userVgPen = ctx.cutState === 'cut'
    ? userOverride?.cutPen
    : userOverride?.projectionPen;
  const userVgColor = ctx.cutState === 'cut'
    ? userOverride?.cutColor
    : userOverride?.projectionColor;
  const userVgPattern = ctx.cutState === 'cut'
    ? userOverride?.cutPattern
    : userOverride?.projectionPattern;

  // ── Pre-compute fallbacks for color/pattern (shared across all pen branches) ───
  const subColor = sub
    ? (ctx.cutState === 'cut' ? sub.cutColor : sub.projectionColor)
    : undefined;
  const parentColorRaw = ctx.cutState === 'cut' ? parent.cutColor : parent.projectionColor;
  const parentPatternRaw = ctx.cutState === 'cut' ? parent.cutPattern : parent.projectionPattern;

  /** Color priority: elem > sub Object Style > V/G user > Layer > parent DEFAULT > null. */
  const resolveColor = (): string | null => {
    if (ctx.elementOverride?.color !== undefined) return ctx.elementOverride.color;
    if (subColor !== undefined) return subColor;
    if (userVgColor !== undefined) return userVgColor;
    if (ctx.layerOverride?.color !== undefined) return ctx.layerOverride.color;
    return parentColorRaw ?? null;
  };

  /** Pattern priority: elem > sub Object Style > V/G user > parent DEFAULT > 'solid'. */
  const resolvePattern = (): LinePatternKey =>
    ctx.elementOverride?.linePattern
    ?? sub?.linePattern
    ?? userVgPattern
    ?? parentPatternRaw
    ?? 'solid';

  const color = resolveColor();
  const linePattern = resolvePattern();
  const scaleCol = closestScaleColumn(ctx.scaleDenominator);

  // ── Line width priority: elem pen > sub Object Style pen > V/G user pen > Layer mm > parent DEFAULT ──

  // 1. Element pen override (C.5)
  const elemPen = ctx.elementOverride
    ? (ctx.cutState === 'cut' ? ctx.elementOverride.cutPen : ctx.elementOverride.projectionPen) ?? null
    : null;
  if (elemPen !== null) {
    const mm = _activePenTable[elemPen - 1][scaleCol];
    const lineWidthPx = lineweightToPx(mm, ctx.dpi ?? 96);
    return { lineWidthPx, linePattern, color };
  }

  // 2. Subcategory Object Style pen (ADR-377 hardcoded structural intent).
  // 'beyond' cutState bypasses sub pen — Revit Line Styles always uses BEYOND_PEN below the
  // view range as a representational convention.
  const subPen = ctx.cutState === 'cut' ? sub?.cutPen
    : ctx.cutState === 'projection' ? sub?.projectionPen
    : undefined;
  if (ctx.cutState !== 'beyond' && subPen !== undefined) {
    const mm = _activePenTable[subPen - 1][scaleCol];
    const lineWidthPx = lineweightToPx(mm, ctx.dpi ?? 96);
    return { lineWidthPx, linePattern, color };
  }

  // 3. V/G category user pen (C.4 — wins over Layer per Revit V/G semantics).
  // Skip for 'beyond' (BEYOND_PEN convention, same as sub pen above).
  if (ctx.cutState !== 'beyond' && userVgPen !== undefined) {
    const mm = _activePenTable[userVgPen - 1][scaleCol];
    const lineWidthPx = lineweightToPx(mm, ctx.dpi ?? 96);
    return { lineWidthPx, linePattern, color };
  }

  // 4. Layer concrete mm (C.6 — bypasses pen table, wins over DEFAULT).
  if (ctx.cutState !== 'beyond' && ctx.layerOverride?.lineweightMm !== undefined) {
    const lineWidthPx = lineweightToPx(ctx.layerOverride.lineweightMm, ctx.dpi ?? 96);
    return { lineWidthPx, linePattern, color };
  }

  // 5. Parent DEFAULT pen (from merged DEFAULT_OBJECT_STYLES + user V/G overlay).
  let penIdx: PenIndex;
  if (ctx.cutState === 'cut') {
    penIdx = parent.cutPen;
  } else if (ctx.cutState === 'projection') {
    penIdx = parent.projectionPen;
  } else {
    penIdx = BEYOND_PEN;
  }
  const mm = _activePenTable[penIdx - 1][scaleCol];
  const lineWidthPx = lineweightToPx(mm, ctx.dpi ?? 96);

  return { lineWidthPx, linePattern, color };
}

/** Resolve line weight in pixels. Backward-compatible wrapper around resolveSubcategoryStyle. */
export function resolveLineWeightPx(ctx: LineWeightContext): number {
  return resolveSubcategoryStyle(ctx).lineWidthPx;
}
