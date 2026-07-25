/* eslint-disable design-system/no-hardcoded-colors */
/**
 * =============================================================================
 * ENTERPRISE: FloorplanGallery DXF Canvas Renderer
 * =============================================================================
 *
 * Renders DXF scene data to an HTML canvas element.
 * Supports zoom, pan offset, and dark/light drawing modes.
 * Extracted from FloorplanGallery.tsx for SRP compliance (ADR-033).
 *
 * @module components/shared/files/media/floorplan-dxf-renderer
 */

import type { DxfSceneData } from '@/types/file-record';
import type { PanOffset } from '@/hooks/useZoomPan';
import type { DxfDrawingMode } from '@/components/shared/files/media/floorplan-gallery-config';
import { computeSceneBounds } from '@/lib/dxf-scene/scene-bounds';
import { paintSceneEntityGeometry } from '@/lib/dxf-scene/canvas-scene-painter';
import { readSceneTextContent } from '@/lib/dxf-scene/scene-text-content';
import {
  computeFitTransform,
  projectX,
  projectY,
  type FitTransform,
  type SceneBounds,
} from '@/lib/dxf-scene/scene-fit-transform';

// ============================================================================
// DRAWING MODE CONFIG
// ============================================================================

/**
 * SSoT ink for the «Μαύρο σχέδιο» (monochrome) display axis — big-player B/W
 * (AutoCAD/Revit «Monochrome»). ONE owner of the ink hex: both the legacy
 * force-black path (`DRAWING_MODE_CONFIG.light`, no-bounds fallback renderer) and
 * the engine-path recolor (`applyMonochromeInk`, `floorplan-monochrome.ts`) read
 * this same value, so the two render paths never drift on the ink colour.
 */
export const MONOCHROME_INK = '#1a1a1a';

/** Visual config per drawing mode */
export const DRAWING_MODE_CONFIG = {
  dark: {
    background: '#111827',
    entityColor: null, // Use layer colors
    textColor: null,   // Use layer colors
  },
  light: {
    background: '#ffffff',
    entityColor: MONOCHROME_INK, // Force black
    textColor: MONOCHROME_INK,   // Force black
  },
} as const;

// ============================================================================
// BOUNDS COMPUTATION
// ============================================================================

/** Re-exported from the fit-transform SSoT — this module must not own a second shape. */
export type { SceneBounds };

/**
 * Compute the actual bounding box from all entities in the scene.
 * Always returns bounds that include every entity, regardless of scene.bounds.
 *
 * WHY: scene.bounds comes from the original DXF parsing and is never updated
 * when the user adds entities outside the original drawing bounds in the DXF
 * Viewer. This function derives the true viewport from the live entity data.
 *
 * Named alias over the `@/lib/dxf-scene/scene-bounds` SSoT — kept because
 * `FloorplanGallery` imports this name and the overlay pass must resolve the
 * SAME bounds value the geometry pass uses.
 */
export function computeActualBounds(entities: DxfSceneData['entities']): SceneBounds {
  return computeSceneBounds(entities);
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Extract the explicit run-level color from a textNode AST (ADR-344).
 * Mirrors useDxfSceneConversion.extractFirstRunStyle — reads only the TrueColor
 * from the first run so the gallery matches the DXF-viewer canvas color exactly.
 * Returns undefined for ByLayer / ByBlock (inherit from entity/layer color chain).
 */
function extractTextNodeColor(e: Record<string, unknown>): string | undefined {
  type TrueColor = { kind: string; r: number; g: number; b: number };
  type TextRun = { style?: { color?: TrueColor } };
  type TextParagraph = { runs?: TextRun[] };
  type TextNodeShape = { paragraphs?: TextParagraph[] };
  const textNode = e.textNode as TextNodeShape | undefined;
  const run = textNode?.paragraphs?.[0]?.runs?.[0];
  const color = run?.style?.color;
  if (!color || color.kind !== 'TrueColor') return undefined;
  return `#${color.r.toString(16).padStart(2, '0')}${color.g.toString(16).padStart(2, '0')}${color.b.toString(16).padStart(2, '0')}`;
}

// ============================================================================
// CANVAS RENDERING
// ============================================================================

/**
 * Render DXF scene data to a canvas element.
 * Accepts zoom, panOffset, and drawing mode for interactive viewing.
 */
export function renderDxfToCanvas(
  canvas: HTMLCanvasElement,
  scene: DxfSceneData,
  zoom: number,
  panOffset: PanOffset,
  drawingMode: DxfDrawingMode = 'dark',
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  if (!scene.entities || scene.entities.length === 0) return;

  // Size canvas to container
  const container = canvas.parentElement;
  if (container) {
    const rect = container.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
  }

  // Drawing mode config
  const modeConfig = DRAWING_MODE_CONFIG[drawingMode];

  // Clear canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = modeConfig.background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Compute bounds from ALL entities — never trust scene.bounds (stale after DXF Viewer edits).
  const bounds = computeActualBounds(scene.entities);
  const fit = computeFitTransform(canvas.width, canvas.height, bounds, zoom, panOffset);

  // Entity color helper — resolution order: mode override → entity.color → layer.color → fallback.
  // Light mode forces '#1a1a1a' for all entities (print readability).
  // Dark mode uses entity.color when set (preserves user-chosen colors from DXF Viewer),
  // then falls back to layer color.
  const getEntityColor = (layerName: string, entityColor?: string): string =>
    modeConfig.entityColor || entityColor || scene.layers?.[layerName]?.color || '#e2e8f0';

  ctx.lineWidth = 1;

  // Render entities. Primitive geometry (line/polyline/circle/arc) goes through the
  // `canvas-scene-painter` SSoT; only text stays local, because its baseline/font rules
  // are surface-specific (ADR-370: no font clamp here, unlike the thumbnail generator).
  scene.entities.forEach((entity) => {
    if (scene.layers?.[entity.layer]?.visible === false) return;

    const e = entity as Record<string, unknown>;
    const resolvedColor = getEntityColor(entity.layer, e.color as string | undefined);
    ctx.strokeStyle = resolvedColor;

    if (paintSceneEntityGeometry(ctx, entity, bounds, fit)) return;

    if (entity.type === 'text' || entity.type === 'mtext') {
      paintGalleryText(ctx, e, {
        bounds,
        fit,
        inkOverride: modeConfig.entityColor,
        fallbackColor: resolvedColor,
      });
    }
  });
}

/** Style inputs the gallery text pass needs on top of the shared projection. */
interface GalleryTextContext {
  readonly bounds: SceneBounds;
  readonly fit: FitTransform;
  /** Drawing-mode ink that overrides every per-entity colour (monochrome mode). */
  readonly inkOverride: string | null;
  /** Entity/layer-resolved colour used when no override and no run colour applies. */
  readonly fallbackColor: string;
}

/**
 * Gallery text pass. Kept OUT of the shared painter on purpose:
 *  - `textNode` entities anchor TL (baseline `top`), DXF-imported ones anchor BL.
 *  - ADR-370 — the font scales PURELY with zoom (`height × scale`) with NO min/max
 *    clamp: a fixed floor freezes on-screen text size, so at low zoom the glyphs stop
 *    shrinking and overlap into an unreadable blob. `|| 10` is only a fallback height
 *    for entities that carry no intrinsic height.
 */
function paintGalleryText(
  ctx: CanvasRenderingContext2D,
  e: Record<string, unknown>,
  { bounds, fit, inkOverride, fallbackColor }: GalleryTextContext,
): void {
  const position = e.position as { x: number; y: number } | undefined;
  const text = readSceneTextContent(e);
  if (!position || !text) return;

  // Text color priority: mode override → textNode TrueColor → entity.color → layer → fallback
  ctx.fillStyle = inkOverride || extractTextNodeColor(e) || fallbackColor;
  ctx.textBaseline = e.textNode ? 'top' : 'alphabetic';
  ctx.font = `${((e.height as number | undefined) || 10) * fit.scale}px Arial`;
  ctx.fillText(text, projectX(position.x, bounds, fit), projectY(position.y, bounds, fit));
  ctx.textBaseline = 'alphabetic';
}
