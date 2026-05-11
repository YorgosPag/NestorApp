/**
 * ADR-344 Phase 7.D — Pure canvas renderer for `DxfTextNode` previews.
 *
 * Renders a resolved `DxfTextNode` to a Canvas 2D context using the same
 * per-run style attributes (font family / weight / italic / colour / height)
 * the full DxfRenderer applies. The implementation is intentionally a thin
 * subset — it covers the styling that templates actually carry and ignores
 * features irrelevant to the preview (bgMask, multi-column layout, tab
 * stops, oblique angle, width factor adjustments at sub-pixel level).
 *
 * Auto-fit: total bbox computed in DxfTextNode "drawing units" (treating
 * each unit as 1px for measurement); resulting bbox is then scaled
 * uniformly so the longest dimension fits the target canvas minus a small
 * margin. The 9-point attachment grid positions the rendered block within
 * the canvas.
 *
 * Stacks (\S tolerance / diagonal / horizontal) render as `top` + `bottom`
 * stacked vertically at 0.6× the run height, separated by a thin line for
 * the horizontal variant.
 */
import type {
  DxfTextNode,
  TextJustification,
  TextParagraph,
  TextRun,
  TextRunStyle,
  TextStack,
} from '@/subapps/dxf-viewer/text-engine/types/text-ast.types';
import { dxfColorToCss } from './dxf-color-to-css';

const STACK_HEIGHT_RATIO = 0.6;
const STACK_GAP = 2;
const CANVAS_MARGIN = 12;

interface RenderOptions {
  readonly canvasWidth: number;
  readonly canvasHeight: number;
  readonly background?: string;
}

interface InlineSegment {
  readonly text: string;
  readonly style: TextRunStyle;
  readonly stack?: TextStack;
  width: number;
  height: number;
}

function buildFontString(style: TextRunStyle): string {
  const weight = style.bold ? '700' : '400';
  const italic = style.italic ? 'italic ' : '';
  const family = style.fontFamily || 'sans-serif';
  return `${italic}${weight} ${Math.max(1, style.height)}px "${family}", sans-serif`;
}

function measureRun(ctx: CanvasRenderingContext2D, run: TextRun): InlineSegment {
  ctx.font = buildFontString(run.style);
  const metrics = ctx.measureText(run.text);
  return {
    text: run.text,
    style: run.style,
    width: metrics.width * Math.max(0.1, run.style.widthFactor),
    height: run.style.height,
  };
}

function measureStack(ctx: CanvasRenderingContext2D, stack: TextStack): InlineSegment {
  const stackStyle: TextRunStyle = {
    fontFamily: stack.style.fontFamily,
    bold: false,
    italic: false,
    underline: false,
    overline: false,
    strikethrough: false,
    height: stack.style.height * STACK_HEIGHT_RATIO,
    widthFactor: 1,
    obliqueAngle: 0,
    tracking: 1,
    color: stack.style.color,
  };
  ctx.font = buildFontString(stackStyle);
  const topWidth = ctx.measureText(stack.top).width;
  const bottomWidth = ctx.measureText(stack.bottom).width;
  return {
    text: '',
    style: stackStyle,
    stack,
    width: Math.max(topWidth, bottomWidth),
    height: stack.style.height,
  };
}

function measureParagraph(
  ctx: CanvasRenderingContext2D,
  para: TextParagraph,
): { segments: InlineSegment[]; width: number; height: number } {
  const segments: InlineSegment[] = para.runs.map((item) =>
    'text' in item ? measureRun(ctx, item) : measureStack(ctx, item),
  );
  const width = segments.reduce((acc, s) => acc + s.width, 0);
  const height = segments.reduce((acc, s) => Math.max(acc, s.height), 0);
  return { segments, width, height };
}

function paragraphLineSpacing(node: DxfTextNode, para: TextParagraph, lineHeight: number): number {
  const factor =
    para.lineSpacingMode && para.lineSpacingFactor > 0
      ? para.lineSpacingFactor
      : node.lineSpacing.factor;
  return lineHeight * Math.max(1, factor);
}

function attachmentOffset(
  attachment: TextJustification,
  bboxWidth: number,
  bboxHeight: number,
  canvasWidth: number,
  canvasHeight: number,
): { offsetX: number; offsetY: number } {
  const horiz = attachment.charAt(1);
  const vert = attachment.charAt(0);
  const availW = canvasWidth - CANVAS_MARGIN * 2;
  const availH = canvasHeight - CANVAS_MARGIN * 2;

  let offsetX = CANVAS_MARGIN;
  if (horiz === 'C') offsetX = CANVAS_MARGIN + (availW - bboxWidth) / 2;
  else if (horiz === 'R') offsetX = CANVAS_MARGIN + (availW - bboxWidth);

  let offsetY = CANVAS_MARGIN;
  if (vert === 'M') offsetY = CANVAS_MARGIN + (availH - bboxHeight) / 2;
  else if (vert === 'B') offsetY = CANVAS_MARGIN + (availH - bboxHeight);
  return { offsetX, offsetY };
}

function paragraphJustificationOffset(
  paraJustification: TextParagraph['justification'],
  paraWidth: number,
  bboxWidth: number,
): number {
  if (paraJustification === 1) return (bboxWidth - paraWidth) / 2;
  if (paraJustification === 2) return bboxWidth - paraWidth;
  return 0;
}

function drawDecoration(
  ctx: CanvasRenderingContext2D,
  segment: InlineSegment,
  x: number,
  baseline: number,
): void {
  const { style, width } = segment;
  const decorations: Array<{ y: number; thickness: number }> = [];
  if (style.underline) decorations.push({ y: baseline + 2, thickness: 1 });
  if (style.overline) decorations.push({ y: baseline - segment.height, thickness: 1 });
  if (style.strikethrough) decorations.push({ y: baseline - segment.height * 0.4, thickness: 1 });
  if (decorations.length === 0) return;
  ctx.fillStyle = dxfColorToCss(style.color);
  for (const dec of decorations) {
    ctx.fillRect(x, dec.y, width, dec.thickness);
  }
}

function drawSegment(
  ctx: CanvasRenderingContext2D,
  segment: InlineSegment,
  x: number,
  baseline: number,
): void {
  ctx.fillStyle = dxfColorToCss(segment.style.color);
  ctx.font = buildFontString(segment.style);
  ctx.textBaseline = 'alphabetic';
  if (segment.stack) {
    const halfHeight = segment.height / 2;
    ctx.fillText(segment.stack.top, x, baseline - halfHeight - STACK_GAP);
    ctx.fillText(segment.stack.bottom, x, baseline);
    if (segment.stack.type === 'horizontal') {
      ctx.fillRect(x, baseline - halfHeight, segment.width, 1);
    }
    return;
  }
  ctx.fillText(segment.text, x, baseline);
  drawDecoration(ctx, segment, x, baseline);
}

/**
 * Render `node` (placeholders already resolved) into `ctx`. Returns
 * `false` when there is no content to draw (caller may render an empty
 * state).
 */
export function drawTextNodePreview(
  ctx: CanvasRenderingContext2D,
  node: DxfTextNode,
  options: RenderOptions,
): boolean {
  const { canvasWidth, canvasHeight, background = '#ffffff' } = options;
  ctx.save();
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  ctx.restore();

  if (node.paragraphs.length === 0) return false;

  const measured = node.paragraphs.map((p) => ({ para: p, ...measureParagraph(ctx, p) }));
  const bboxWidth = Math.max(...measured.map((m) => m.width), 1);
  const bboxHeight = measured.reduce(
    (acc, m, idx) => acc + (idx === 0 ? m.height : paragraphLineSpacing(node, m.para, m.height)),
    0,
  );

  const availW = Math.max(1, canvasWidth - CANVAS_MARGIN * 2);
  const availH = Math.max(1, canvasHeight - CANVAS_MARGIN * 2);
  const scale = Math.min(availW / bboxWidth, availH / bboxHeight, 1);

  ctx.save();
  const { offsetX, offsetY } = attachmentOffset(
    node.attachment,
    bboxWidth * scale,
    bboxHeight * scale,
    canvasWidth,
    canvasHeight,
  );
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);

  let cursorY = 0;
  for (let i = 0; i < measured.length; i++) {
    const { para, segments, width, height } = measured[i];
    const lineSpacing = i === 0 ? height : paragraphLineSpacing(node, para, height);
    cursorY += i === 0 ? height : lineSpacing;
    const baseline = cursorY;
    let cursorX = paragraphJustificationOffset(para.justification, width, bboxWidth) + para.indent;
    for (const segment of segments) {
      drawSegment(ctx, segment, cursorX, baseline);
      cursorX += segment.width;
    }
  }
  ctx.restore();
  return true;
}
