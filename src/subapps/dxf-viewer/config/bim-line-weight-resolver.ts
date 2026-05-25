/**
 * ADR-375 — BIM Line Weight Resolver (orchestrator)
 *
 * Pipeline: category + cutState + scale → pen index → ISO mm → px
 *
 * Uses lineweightToPx from ADR-358 SSoT (no mm→px duplication).
 */
import { PEN_TABLE_MM, SCALE_COLUMNS, type PenIndex } from './bim-pen-table';
import { DEFAULT_OBJECT_STYLES, type BimCategory, type ObjectStyle } from './bim-object-styles';
import { type CutState } from './bim-view-range';
import { lineweightToPx } from './lineweight-iso-catalog';

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

/** <Beyond> uses the finest pen (Pen #3) per Revit Line Styles default. */
const BEYOND_PEN: PenIndex = 3;

/**
 * Resolve line weight in screen pixels for a BIM entity.
 *
 * 1. Lookup ObjectStyle by category → projectionPen | cutPen
 * 2. If cutState='beyond' → use BEYOND_PEN (#3)
 * 3. Lookup mm value from PEN_TABLE_MM[penIndex-1][scaleColumn]
 * 4. Convert mm → px via lineweightToPx (ADR-358 SSoT)
 */
export function resolveLineWeightPx(ctx: LineWeightContext): number {
  if (ctx.cutState === 'hidden') return 0;

  const styles = ctx.objectStyles
    ? { ...DEFAULT_OBJECT_STYLES, ...ctx.objectStyles }
    : DEFAULT_OBJECT_STYLES;
  const style = styles[ctx.category];
  let penIdx: PenIndex;
  if (ctx.cutState === 'cut') {
    penIdx = style.cutPen;
  } else if (ctx.cutState === 'projection') {
    penIdx = style.projectionPen;
  } else {
    penIdx = BEYOND_PEN;
  }

  const scaleCol = closestScaleColumn(ctx.scaleDenominator);
  const mm = PEN_TABLE_MM[penIdx - 1][scaleCol];
  return lineweightToPx(mm, ctx.dpi ?? 96);
}
