/* eslint-disable design-system/no-hardcoded-colors */
/**
 * ADR-370 Phase 10 — Read-only floorplan scene render via the DXF Viewer's OWN engine.
 *
 * Big-players / SSoT (Autodesk Viewer, Figma view-only): a shared/published view
 * renders through the SAME engine as the editor, interaction disabled — never a
 * second, crippled renderer that drifts. This module drives the editor's real
 * `DxfRenderer` + `convertSceneToDxf` over the loaded scene, so EVERY entity the
 * `/dxf/viewer` can draw (raster `image` «έπιπλα», image/predefined `hatch`,
 * expanded `block`s, `column`, `stair`, ByLayer styling, layer visibility, σοβάς,
 * οπλισμοί) renders here verbatim, read-only. Adding a new entity type never needs
 * a change here again — the registry is the single source of truth.
 *
 * WHY this replaced the previous BIM-Firestore façade (`bim-readonly-render.ts`):
 *  - The «missing» furniture image + material hatches are ALREADY inside the
 *    persisted `.scene.json` the public page loads (they are baked at auto-save,
 *    dual-persistence). They were dropped only because the legacy
 *    `renderDxfToCanvas` handled 6 primitive types (line/polyline/arc/circle/text)
 *    and silently skipped `image`/`hatch`/`block`.
 *  - The Firestore BIM feed can NEVER hydrate on the public read-only page: the
 *    adapted `FileRecord` carries no `projectId`, so the `(projectId, floorId)`
 *    scope never resolves → empty snapshot. Reading the scene the page already
 *    has is both correct and projectId-free.
 *
 * SSoT contract (N.18 clone-free):
 *  - `DxfRenderer` + `convertSceneToDxf` reused verbatim — zero duplicated renderer
 *    or conversion logic, zero per-type list to drift.
 *  - `buildBimViewTransform` reused as the world→pixel bridge, so scene geometry,
 *    overlays and (legacy) BIM pass stack with zero misalignment.
 *  - Async assets (furniture image, material-image hatches) decode off-thread and
 *    signal a redraw through `subscribeImageAssetReady` (ADR-654), which the canvas
 *    render effect (`useFloorplanCanvasRender`) already listens to.
 *
 * The module-level singleton stores the engine reads (`LayerStore`, isolate,
 * cut-plane, linetype-scale) default to «everything visible, no override» when the
 * editor is not mounted — exactly the read-only result.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-370-bim-readonly-visualization.md
 */

import type { PanOffset } from '@/hooks/useZoomPan';
import type { DxfSceneData } from '@/types/file-record';
import type { DxfDrawingMode } from '@/components/shared/files/media/floorplan-gallery-config';
import {
  buildBimViewTransform,
  type SceneBounds,
} from '@/components/shared/files/media/bim-canvas-transform';

import { DxfRenderer } from '@/subapps/dxf-viewer/canvas-v2/dxf-canvas/DxfRenderer';
import type { DxfScene } from '@/subapps/dxf-viewer/canvas-v2/dxf-canvas/dxf-types';
import { convertSceneToDxf } from '@/subapps/dxf-viewer/hooks/canvas/useDxfSceneConversion';
import { createSceneLayer } from '@/subapps/dxf-viewer/types/scene-types';
import type { Entity, SceneLayer, SceneModel } from '@/subapps/dxf-viewer/types/entities';
import { EMPTY_BOUNDS } from '@/subapps/dxf-viewer/config/geometry-constants';
import { rehydrateBimGeometry } from '@/components/shared/files/media/floorplan-scene-bim';
// ADR-340 «Μαύρο σχέδιο» — SSoT ink recolor of the rendered entities (engine untouched).
import { applyMonochromeInk } from '@/components/shared/files/media/floorplan-monochrome';

/** Read-only render options — no grids, no grips, no interactive affordances. */
const DXF_READONLY_OPTIONS = {
  showGrid: false,
  showLayerNames: false,
  wireframeMode: false,
  selectedEntityIds: [] as string[],
  skipInteractive: true,
};

/** Gallery background per drawing mode (mirrors DRAWING_MODE_CONFIG backgrounds). */
const SCENE_BACKGROUND = { dark: '#111827', light: '#ffffff' } as const;

/**
 * The persisted `.scene.json` is a serialized {@link SceneModel} (`entities` +
 * `layersById` + `bounds` + `units`), merely typed loosely as `DxfSceneData` by the
 * public loader. Reinterpret it as the editor scene the converter expects. The
 * PATH-D client-parse fallback instead yields name-keyed `layers`; rebuild
 * `layersById` from it via the SSoT `createSceneLayer` so ByLayer styling survives.
 */
function toSceneModel(data: DxfSceneData): SceneModel {
  const raw = data as unknown as Partial<SceneModel> & {
    readonly layers?: Record<string, { name?: string; color?: string; visible?: boolean }>;
  };

  let layersById = raw.layersById;
  if (!layersById && raw.layers) {
    const rebuilt: Record<string, SceneLayer> = {};
    for (const [name, layer] of Object.entries(raw.layers)) {
      rebuilt[name] = createSceneLayer({
        id: name,
        name: layer.name ?? name,
        color: layer.color,
        visible: layer.visible ?? true,
      });
    }
    layersById = rebuilt;
  }

  return {
    // Rehydrate BIM geometry (column/wall/slab/… carry only `params` in the snapshot;
    // the entity renderers need `geometry`) — SSoT `computeXxxGeometry`, done once per
    // scene (cached by `getDxfScene`).
    entities: rehydrateBimGeometry(data.entities as unknown as Entity[]),
    layersById: layersById ?? {},
    bounds: raw.bounds ?? { ...EMPTY_BOUNDS },
    units: raw.units ?? 'mm',
  } as unknown as SceneModel;
}

/**
 * Converted `DxfScene` per scene-data identity. `convertSceneToDxf` is O(n) with
 * block/array/group expansion; the loaded scene object is stable per file, so a
 * WeakMap keeps the per-frame path (pan/zoom) at a cache hit while the entry is
 * GC'd with the scene it keys.
 */
const sceneCache = new WeakMap<DxfSceneData, DxfScene>();

/**
 * ADR-370 Phase 12 — the SAME converted `DxfScene` the 2D read-only render uses,
 * exposed so the read-only 3D overlay (`Bim3DReadOnlyOverlay` → `BimViewport3D`)
 * can feed the editor's `DxfToThreeConverter` verbatim. Keyed on the loaded
 * scene-data identity, so the 2D pass and the 3D overlay share ONE conversion
 * (zero recompute, zero drift). Returns the cached scene when already built.
 */
export function getFloorplanDxfScene(data: DxfSceneData): DxfScene {
  let scene = sceneCache.get(data);
  if (!scene) {
    const model = toSceneModel(data);
    scene = convertSceneToDxf(model, model.units);
    sceneCache.set(data, scene);
  }
  return scene;
}

/**
 * Persist ONE renderer per canvas. Its composite owns async asset caches (hatch /
 * image decodes); recreating it every paint would discard the decoded image between
 * the async-load redraw and the repaint, spinning a reload loop. Keyed weakly so a
 * detached canvas is GC'd with its renderer.
 */
const rendererByCanvas = new WeakMap<HTMLCanvasElement, DxfRenderer>();

function getRenderer(canvas: HTMLCanvasElement): DxfRenderer {
  let renderer = rendererByCanvas.get(canvas);
  if (!renderer) {
    renderer = new DxfRenderer(canvas);
    rendererByCanvas.set(canvas, renderer);
  }
  return renderer;
}

/**
 * Render the loaded DXF scene read-only through the editor's engine. `bounds` MUST
 * be the same `computeActualBounds` value the overlay pass uses so geometry and
 * unit polygons stay pixel-aligned.
 */
export function renderFloorplanScene(
  canvas: HTMLCanvasElement,
  sceneData: DxfSceneData,
  bounds: SceneBounds,
  zoom: number,
  panOffset: PanOffset,
  drawingMode: DxfDrawingMode,
  monochrome: boolean = false,
): void {
  if (!sceneData.entities?.length) return;

  // Size the backing store to the container (matches the legacy renderer; DPR=1 so
  // the overlay pass and hit-testing share this exact pixel space).
  const container = canvas.parentElement;
  if (container) {
    const rect = container.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
  }

  const dxfScene = getFloorplanDxfScene(sceneData);
  const { transform, viewport } = buildBimViewTransform(
    bounds,
    canvas.width,
    canvas.height,
    zoom,
    panOffset,
  );

  // The engine clears to transparent and draws entities; paint the gallery
  // background BEHIND them (`destination-over`) so a single canvas keeps the
  // dark/light mode without wiping the render.
  getRenderer(canvas).render(dxfScene, transform, viewport, DXF_READONLY_OPTIONS);

  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  // ADR-340 «Μαύρο σχέδιο» — collapse every rendered entity to a single ink while the
  // canvas still holds ONLY the transparent-background entity render, before the gallery
  // background is painted below. Independent of the dark/light theme (`drawingMode`).
  if (monochrome) applyMonochromeInk(ctx, canvas.width, canvas.height);
  ctx.save();
  ctx.globalCompositeOperation = 'destination-over';
  ctx.fillStyle = drawingMode === 'light' ? SCENE_BACKGROUND.light : SCENE_BACKGROUND.dark;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.restore();
}
