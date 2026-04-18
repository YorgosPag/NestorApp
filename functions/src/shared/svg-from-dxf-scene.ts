/**
 * =============================================================================
 * SSoT: DXF scene → SVG serializer (server-side)
 * =============================================================================
 *
 * Pure, deterministic transformation of a parsed DXF scene into a single SVG
 * string. The serializer is a **mirror** of the browser-side renderer in
 * `src/services/thumbnail-generator.ts::generateDxfThumbnail` and
 * `src/subapps/geo-canvas/floor-plan-system/utils/dxf-thumbnail-generator.ts`.
 * Keeping the two renderers visually identical is a SSoT contract: a DXF that
 * renders correctly in the DXF Viewer must produce the same-looking thumbnail
 * in the Storage pipeline. Any change to geometry handling, layer colour
 * resolution, or the Y-axis flip must land in both places at once.
 *
 * Axis conventions:
 *   - DXF:    Y+ up, angles in degrees, counter-clockwise from East
 *   - SVG:    Y+ down, angles in radians (we compute cartesian vertices
 *             directly — the renderer does NOT use SVG rotation)
 *
 * Every entity is transformed once at serialize time:
 *   svgX = (x - bounds.min.x) * scale + offsetX
 *   svgY = (bounds.max.y - y) * scale + offsetY
 *
 * This file is deliberately dependency-free — it ships inside Cloud Functions
 * and must not import anything that pulls Admin SDK / DOM / Next.
 *
 * @module functions/shared/svg-from-dxf-scene
 * @enterprise ADR-033 (Floorplan Processing), ADR-312 (Property Showcase Phase 3)
 */

export interface DxfSceneEntityLike {
  type: string;
  layer?: string;
  [key: string]: unknown;
}

export interface DxfSceneLayerLike {
  color?: string;
  visible?: boolean;
}

export interface DxfSceneBoundsLike {
  min: { x: number; y: number };
  max: { x: number; y: number };
}

export interface DxfSceneInput {
  entities: ReadonlyArray<DxfSceneEntityLike>;
  layers?: Record<string, DxfSceneLayerLike>;
  bounds?: DxfSceneBoundsLike;
}

export interface SvgRenderOptions {
  width?: number;
  height?: number;
  background?: string;
  defaultStroke?: string;
  strokeWidth?: number;
  paddingRatio?: number;
}

export interface SvgRenderResult {
  svg: string;
  width: number;
  height: number;
  skippedEntities: number;
  renderedEntities: number;
}

const DEFAULTS: Required<SvgRenderOptions> = {
  width: 1200,
  height: 800,
  background: '#f8f9fa',
  defaultStroke: '#64748b',
  strokeWidth: 1,
  paddingRatio: 0.05,
};

/** XML-escape a string for safe embedding in SVG attribute / text content. */
function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function computeBounds(entities: ReadonlyArray<DxfSceneEntityLike>): DxfSceneBoundsLike {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const consume = (x: number, y: number) => {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  };
  for (const e of entities) {
    const ex = e as Record<string, unknown>;
    switch (e.type) {
      case 'line': {
        const s = ex.start as { x: number; y: number } | undefined;
        const en = ex.end as { x: number; y: number } | undefined;
        if (s) consume(s.x, s.y);
        if (en) consume(en.x, en.y);
        break;
      }
      case 'polyline': {
        const vs = ex.vertices as Array<{ x: number; y: number }> | undefined;
        if (vs) for (const v of vs) consume(v.x, v.y);
        break;
      }
      case 'circle':
      case 'arc': {
        const c = ex.center as { x: number; y: number } | undefined;
        const r = ex.radius as number | undefined;
        if (c && typeof r === 'number') {
          consume(c.x - r, c.y - r);
          consume(c.x + r, c.y + r);
        }
        break;
      }
      case 'text': {
        const p = ex.position as { x: number; y: number } | undefined;
        if (p) consume(p.x, p.y);
        break;
      }
    }
  }
  if (!Number.isFinite(minX)) return { min: { x: 0, y: 0 }, max: { x: 1, y: 1 } };
  return { min: { x: minX, y: minY }, max: { x: maxX, y: maxY } };
}

/**
 * Serialize a parsed DXF scene into a self-contained SVG 1.1 document.
 *
 * The caller decides the raster output size (default 1200×800). Aspect is
 * preserved via a uniform `scale = min(fitW/drawingW, fitH/drawingH)` with
 * `paddingRatio` margin on every side.
 *
 * Supported entity types (same as the browser renderer):
 *   - `line`      → `<line>`
 *   - `polyline`  → `<polyline>` or `<polygon>` when `closed`
 *   - `circle`    → `<circle>`
 *   - `arc`       → `<path d="M ... A ...">` with Y-flipped sweep
 *   - `text`      → `<text>`
 *
 * Any other entity type is counted in `skippedEntities` — keeps parity with
 * the browser renderer rather than raising. Downstream rasterization consumes
 * the SVG as-is.
 */
export function serializeDxfSceneToSvg(
  scene: DxfSceneInput,
  options: SvgRenderOptions = {}
): SvgRenderResult {
  const opts = { ...DEFAULTS, ...options };
  if (!scene.entities || scene.entities.length === 0) {
    return emptySvg(opts);
  }
  const bounds = scene.bounds ?? computeBounds(scene.entities);
  const drawingWidth = bounds.max.x - bounds.min.x;
  const drawingHeight = bounds.max.y - bounds.min.y;
  if (drawingWidth <= 0 || drawingHeight <= 0) {
    return emptySvg(opts);
  }

  const paddedWidth = opts.width * (1 - 2 * opts.paddingRatio);
  const paddedHeight = opts.height * (1 - 2 * opts.paddingRatio);
  const scale = Math.min(paddedWidth / drawingWidth, paddedHeight / drawingHeight);
  const offsetX = (opts.width - drawingWidth * scale) / 2;
  const offsetY = (opts.height - drawingHeight * scale) / 2;

  const tx = (x: number) => (x - bounds.min.x) * scale + offsetX;
  const ty = (y: number) => (bounds.max.y - y) * scale + offsetY;
  const fmt = (n: number) => Number.isFinite(n) ? Number(n.toFixed(3)) : 0;

  const body: string[] = [];
  const defaults = `stroke="${opts.defaultStroke}" stroke-width="${opts.strokeWidth}" fill="none"`;
  let rendered = 0;
  let skipped = 0;

  for (const entity of scene.entities) {
    const layerName = entity.layer || '0';
    const layer = scene.layers?.[layerName];
    if (layer?.visible === false) { skipped += 1; continue; }
    const stroke = layer?.color || opts.defaultStroke;
    const ex = entity as Record<string, unknown>;

    switch (entity.type) {
      case 'line': {
        const s = ex.start as { x: number; y: number } | undefined;
        const en = ex.end as { x: number; y: number } | undefined;
        if (!s || !en) { skipped += 1; break; }
        body.push(
          `<line x1="${fmt(tx(s.x))}" y1="${fmt(ty(s.y))}" x2="${fmt(tx(en.x))}" y2="${fmt(ty(en.y))}" stroke="${stroke}" stroke-width="${opts.strokeWidth}"/>`
        );
        rendered += 1;
        break;
      }
      case 'polyline': {
        const vs = ex.vertices as Array<{ x: number; y: number }> | undefined;
        const closed = ex.closed as boolean | undefined;
        if (!vs || vs.length < 2) { skipped += 1; break; }
        const pts = vs.map((v) => `${fmt(tx(v.x))},${fmt(ty(v.y))}`).join(' ');
        const tag = closed ? 'polygon' : 'polyline';
        body.push(
          `<${tag} points="${pts}" stroke="${stroke}" stroke-width="${opts.strokeWidth}" fill="none"/>`
        );
        rendered += 1;
        break;
      }
      case 'circle': {
        const c = ex.center as { x: number; y: number } | undefined;
        const r = ex.radius as number | undefined;
        if (!c || typeof r !== 'number' || r <= 0) { skipped += 1; break; }
        body.push(
          `<circle cx="${fmt(tx(c.x))}" cy="${fmt(ty(c.y))}" r="${fmt(r * scale)}" stroke="${stroke}" stroke-width="${opts.strokeWidth}" fill="none"/>`
        );
        rendered += 1;
        break;
      }
      case 'arc': {
        const c = ex.center as { x: number; y: number } | undefined;
        const r = ex.radius as number | undefined;
        const sDeg = ex.startAngle as number | undefined;
        const eDeg = ex.endAngle as number | undefined;
        if (!c || typeof r !== 'number' || r <= 0 || sDeg === undefined || eDeg === undefined) {
          skipped += 1;
          break;
        }
        // DXF: CCW from East in degrees. SVG path A-flag 'sweep-flag=0' draws
        // CCW in user space — but our user space is Y-flipped, so a DXF CCW
        // arc becomes an SVG CW arc. sweep-flag=1 (CW) matches the canvas
        // renderer's `ctx.arc(...-startRad,-endRad,true)` call.
        const startRad = (sDeg * Math.PI) / 180;
        const endRad = (eDeg * Math.PI) / 180;
        const startX = c.x + r * Math.cos(startRad);
        const startY = c.y + r * Math.sin(startRad);
        const endX = c.x + r * Math.cos(endRad);
        const endY = c.y + r * Math.sin(endRad);
        let sweepDeg = eDeg - sDeg;
        if (sweepDeg < 0) sweepDeg += 360;
        const largeArc = sweepDeg > 180 ? 1 : 0;
        const rx = fmt(r * scale);
        body.push(
          `<path d="M ${fmt(tx(startX))} ${fmt(ty(startY))} A ${rx} ${rx} 0 ${largeArc} 1 ${fmt(tx(endX))} ${fmt(ty(endY))}" stroke="${stroke}" stroke-width="${opts.strokeWidth}" fill="none"/>`
        );
        rendered += 1;
        break;
      }
      case 'text': {
        const p = ex.position as { x: number; y: number } | undefined;
        const text = ex.text as string | undefined;
        const h = ex.height as number | undefined;
        if (!p || !text) { skipped += 1; break; }
        const fontPx = Math.max(6, (h ?? 10) * scale);
        body.push(
          `<text x="${fmt(tx(p.x))}" y="${fmt(ty(p.y))}" font-family="Arial,Helvetica,sans-serif" font-size="${fmt(fontPx)}" fill="${stroke}">${escapeXml(text)}</text>`
        );
        rendered += 1;
        break;
      }
      default:
        skipped += 1;
        break;
    }
  }

  const svg = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" width="${opts.width}" height="${opts.height}" viewBox="0 0 ${opts.width} ${opts.height}" ${defaults}>`,
    `<rect width="100%" height="100%" fill="${opts.background}"/>`,
    `<g stroke-linecap="round" stroke-linejoin="round">${body.join('')}</g>`,
    `</svg>`,
  ].join('');

  return { svg, width: opts.width, height: opts.height, skippedEntities: skipped, renderedEntities: rendered };
}

function emptySvg(opts: Required<SvgRenderOptions>): SvgRenderResult {
  const svg = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" width="${opts.width}" height="${opts.height}" viewBox="0 0 ${opts.width} ${opts.height}">`,
    `<rect width="100%" height="100%" fill="${opts.background}"/>`,
    `</svg>`,
  ].join('');
  return { svg, width: opts.width, height: opts.height, skippedEntities: 0, renderedEntities: 0 };
}
