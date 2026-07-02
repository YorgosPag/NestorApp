/**
 * Enterprise Preview Renderer — Direct canvas rendering for drawing previews.
 * Pattern: Autodesk AutoCAD / Bentley MicroStation — Zero React overhead.
 * ADR-065 SRP split: 958 lines -> 3 files (types, entity-renderers, main)
 */

import type { Point2D, ViewTransform, Viewport } from '../../rendering/types/Types';
import type { ExtendedSceneEntity } from '../../hooks/drawing/useUnifiedDrawing';
import { getDevicePixelRatio, toDevicePixels } from '../../systems/cursor/utils';
// 🏢 ADR-040 / ADR-398 §4 — live transform SSoT (ίδιο read με τον main
// `dxf-canvas-renderer`). render() διαβάζει zero-lag το τρέχον transform → το ghost
// ακολουθεί zoom/pan world-locked χωρίς cached/stale τιμή.
import { getImmediateTransform } from '../../systems/cursor/ImmediateTransformStore';
import { CoordinateTransforms } from '../../rendering/core/CoordinateTransforms';
import { clearCanvasDpr } from '../../rendering/canvas/withCanvasState';
// 🏢 SSoT canvas sizing — same primitive as DxfCanvas/LayerCanvas (buffer από authoritative
// viewport, DPR-aware, χωρίς inline style.width). Ενοποιεί την τετραπλή own-rect διαστασιολόγηση.
import { CanvasUtils } from '../../rendering/canvas/utils/CanvasUtils';

// Re-export types for consumers
export type { PreviewRenderOptions } from './preview-renderer-types';
import type { PreviewRenderOptions } from './preview-renderer-types';
import { DEFAULT_PREVIEW_OPTIONS } from './preview-renderer-types';
import { UnifiedGripRenderer } from '../../rendering/grips/UnifiedGripRenderer';
// 🏢 WYSIWYG placement preview — render synthetic BIM entities (wall/foundation/…)
// through the REAL entity renderers instead of a schematic green outline.
import { BimPreviewRenderer } from './bim-preview-render';
// SRP split (ADR-040) — active-entity paint pass (WYSIWYG BIM ghost + generic dispatch +
// colored grips) lives in a sibling module; render() keeps the frame lifecycle only.
import { paintPreviewEntity } from './preview-entity-paint';
import { resolveGhostStatusColor } from '../../bim/ghosts/ghost-status-color';
import { drawOverlayLabel, CURSOR_LABEL_SLOTS } from './overlay-text-style';
import type { SceneUnits } from '../../utils/scene-units';
// ADR-357 Phase 4: Object Snap Tracking visual feedback (markers + paths).
import {
  detectTrackingTheme,
  getTrackingPalette,
} from './tracking-colors';
// ADR-357 Phase 4 — Object Snap Tracking paint helpers (extracted, SRP).
import {
  paintTrackingMarkers,
  paintAlignmentPaths,
  paintIntersections,
  paintTooltip,
} from './tracking-paint';
import type { AcquiredTrackingPoint } from '../../systems/tracking/TrackingPointStore';
import type { TrackingAlignmentPath } from '../../systems/tracking/tracking-resolver';
// ADR-508 §dim — wall-ghost listening dimensions (along-face distances), painted via the
// ADR-362 dimension SSoT.
import { paintGhostFaceDimensions } from './ghost-face-dim-paint';
import type { GhostFaceDimensionsMeta } from '../../bim/framing/ghost-face-dim-references';
import { paintWallHud, type WallHudMeta } from './wall-hud-paint';
// ADR-564 §footprint-hud — reuse του υπάρχοντος footprint HUD painter (πλάτος/βάθος ανά παρειά + ∠ +
// ύψος) και κατά την ΤΟΠΟΘΕΤΗΣΗ κολόνας/πέδιλου (πριν: μόνο grip-drag).
import { paintColumnHud, paintFootprintHud, type FootprintHudDescriptor } from './column-hud-paint';
import type { ColumnParams } from '../../bim/types/column-types';
import { paintPolarDisk } from './polar-disk-paint';
import type { PolarDiskGrid } from '../../bim/columns/polar-disk-snap';
import { paintRectGrid } from './rect-grid-paint';
import type { RectGrid } from '../../bim/columns/rect-cartesian-snap';
// ADR-357 Phase 1 — polar tracking line overlay (extracted, SRP — same pattern as the other *-paint helpers).
import { paintPolarTrackingLine } from './polar-tracking-line-paint';
// ADR-397 §15 (wall) — κοινό SSoT τόξο φοράς (rotation ⊕ wall drawing): χρωματισμένο
// τόξο + βελάκι + baseline 0° + χρωματιστές μοίρες (🟢 πάνω / 🔴 κάτω από τον x-άξονα).
import { paintDirectionArc } from './direction-arc-paint';
// ADR-398 §3.20 — circumference quadrant-to-end alignment guide (dashed, same overlay SSoT).
import { paintAlignmentGuide } from './alignment-guide-paint';
import type { PlacementAlignmentGuide } from '../../bim/columns/column-tangent-snap';
// ADR-544 — projector seam: οι placement painters δέχονται έτοιμο `OverlayProjector`· εδώ (2D)
// τον χτίζουμε από το live `transform`+`viewport` (ίδιο αποτέλεσμα με τον παλιό inline `worldToScreen`).
import { fromTransform } from './overlay-projector';

export class PreviewRenderer {
  private ctx: CanvasRenderingContext2D | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private _gripRenderer: UnifiedGripRenderer | null = null;
  // 🏢 WYSIWYG placement preview — real-renderer pass for BIM entities (lazy
  // composite bound to the preview ctx; created in `initialize`).
  private bimPreview: BimPreviewRenderer | null = null;
  private currentPreview: ExtendedSceneEntity | null = null;
  private currentViewport: Viewport | null = null;
  private currentOptions: Required<PreviewRenderOptions> = { ...DEFAULT_PREVIEW_OPTIONS };
  private isDirty = false;
  private dpr = 1;
  // ADR-357 Phase 4: persistent acquired markers — survive `drawPreview` cycles
  // so the `+` glyphs stay visible while the rubber-band preview repaints.
  private trackingMarkers: readonly AcquiredTrackingPoint[] = [];
  // ADR-362 R9 — active scene units forwarded from DxfScene so preview dim text
  // uses the same paper-mm→world-unit formula as the committed DimensionRenderer.
  private sceneUnits: SceneUnits = 'mm';

  // Debug FPS counter (disabled in production)
  private debugFpsCounter = 0;
  private debugFpsLastTime = 0;
  private debugFpsEnabled = false;

  // ===== SCENE UNITS =====

  setSceneUnits(units: SceneUnits): void {
    this.sceneUnits = units;
  }

  // ===== INITIALIZATION =====

  initialize(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: true, desynchronized: true });
    this.dpr = getDevicePixelRatio();
    this._gripRenderer = this.ctx ? new UnifiedGripRenderer(this.ctx, (p) => p) : null;
    this.bimPreview = this.ctx ? new BimPreviewRenderer(this.ctx) : null;
  }

  updateSize(width: number, height: number): void {
    if (!this.canvas || !this.ctx) return;

    const dpr = getDevicePixelRatio();
    const newWidth = toDevicePixels(width, dpr);
    const newHeight = toDevicePixels(height, dpr);

    // Skip if size unchanged (prevents canvas buffer clear)
    if (this.canvas.width === newWidth && this.canvas.height === newHeight && this.dpr === dpr) {
      return;
    }

    this.dpr = dpr;
    // 🏢 SSoT sizing — same primitive as DxfCanvas/LayerCanvas. NO inline style.width/height:
    // the CSS size stays `w-full h-full` (=container). The old inline px override was the
    // preview-layer half of the size desync (the stale «1944px» that clipped the column ghost).
    CanvasUtils.sizeCanvasToViewport(this.canvas, { width, height });
    this.isDirty = true;
  }

  // ===== PUBLIC API =====

  /**
   * Draw preview entity — called directly from mouse handler (NO React state).
   * Immediate synchronous render for zero-latency feedback.
   *
   * The entity is stored in WORLD coords; the transform is NOT passed in — it is
   * read live from `getImmediateTransform()` at paint time (see `render`), so the
   * ghost stays world-locked on wheel-zoom/pan that fire no `mousemove`.
   */
  drawPreview(
    entity: ExtendedSceneEntity | null,
    viewport: Viewport,
    options?: PreviewRenderOptions
  ): void {
    if (this.debugFpsEnabled) {
      const now = performance.now();
      this.debugFpsCounter++;
      if (now - this.debugFpsLastTime >= 1000) {
        console.error(`[PREVIEW FPS] ${this.debugFpsCounter} calls/sec | entity: ${entity?.type || 'null'}`);
        this.debugFpsCounter = 0;
        this.debugFpsLastTime = now;
      }
    }

    this.currentPreview = entity;
    this.currentViewport = viewport;
    this.currentOptions = { ...DEFAULT_PREVIEW_OPTIONS, ...options };

    // Immediate render (no RAF wait)
    this.render();
  }

  /**
   * Set the acquired Object Snap Tracking markers (ADR-357 Phase 4).
   * Markers persist across `drawPreview` cycles — the renderer paints them
   * after every preview so the `+` glyphs stay anchored to acquired points.
   */
  setTrackingMarkers(markers: readonly AcquiredTrackingPoint[]): void {
    this.trackingMarkers = markers;
    this.isDirty = true;
    // Immediate paint so the marker shows up even when no drawPreview follows.
    this.render();
  }

  /**
   * Draw an Object Snap Tracking alignment overlay (ADR-357 Phase 4).
   *
   * Called AFTER `drawPreview` so the dashed alignment paths, intersection
   * halo, and snapped-distance tooltip overlay the rubber-band entity. The
   * next `drawPreview`/`clear` call wipes the overlay automatically — markers
   * are repainted from `trackingMarkers` so they survive the cycle.
   */
  drawTrackingAlignment(
    paths: readonly TrackingAlignmentPath[],
    intersections: readonly Point2D[],
    snappedPoint: Point2D,
    label: string | null,
    transform: ViewTransform,
    viewport: Viewport,
  ): void {
    if (!this.ctx) return;
    const palette = getTrackingPalette(detectTrackingTheme());
    const project = fromTransform(transform, viewport);
    paintAlignmentPaths(this.ctx, paths, project, palette);
    paintIntersections(this.ctx, intersections, project, palette);
    paintTooltip(this.ctx, snappedPoint, label, project, palette);
  }

  /**
   * Draw the wall-ghost listening dimensions (ADR-508 §dim). Called AFTER `drawPreview`
   * so the along-face distance dims overlay the ghost; wiped on the next
   * `drawPreview`/`clear`. Delegates to the ADR-362 `renderPreviewDimension` SSoT.
   */
  drawGhostFaceDimensions(
    meta: GhostFaceDimensionsMeta,
    transform: ViewTransform,
    viewport: Viewport,
  ): void {
    if (!this.ctx) return;
    paintGhostFaceDimensions(this.ctx, meta, transform, viewport);
  }

  /**
   * ADR-508 §wall-hud — «ζωντανή ταυτότητα» τοίχου κατά τη σχεδίαση: aligned διάσταση μήκους +
   * γωνία + ετικέτα πάχος·ύψος. Called AFTER `drawPreview`· wiped στο επόμενο `drawPreview`/`clear`.
   * `specLabel` = ΗΔΗ μεταφρασμένο (i18n στον handler). Delegate στο `wall-hud-paint` SSoT.
   */
  drawWallHud(
    meta: WallHudMeta,
    specLabel: string,
    transform: ViewTransform,
    viewport: Viewport,
  ): void {
    if (!this.ctx) return;
    paintWallHud(this.ctx, meta, specLabel, transform, viewport);
  }

  /**
   * ADR-564 §footprint-hud — «ζωντανή ταυτότητα» κολόνας/πέδιλου (footprint μέλος) κατά την
   * τοποθέτηση: aligned διάσταση σε ΚΑΘΕ παρειά (πλάτος & βάθος / Ø) + ∠ γωνία + ύψος. Ίδιος pure
   * painter με το grip-drag (`column-hud-paint`). `heightSpecLabel` = ΗΔΗ μεταφρασμένο (i18n handler).
   * Called AFTER `drawPreview`· wiped στο επόμενο `drawPreview`/`clear`.
   */
  drawColumnHud(
    footprint: readonly Point2D[],
    params: ColumnParams,
    heightSpecLabel: string,
    transform: ViewTransform,
    viewport: Viewport,
  ): void {
    if (!this.ctx) return;
    paintColumnHud(this.ctx, footprint, params, heightSpecLabel, this.sceneUnits, transform, viewport);
  }

  /**
   * ADR-564 §foundation-hud — entity-agnostic footprint HUD (πέδιλο-pad): ΙΔΙΟΣ pure painter με την
   * κολόνα (`paintFootprintHud`) αλλά με ελάχιστο `FootprintHudDescriptor` αντί για `ColumnParams`,
   * ώστε το πέδιλο (`FoundationParams`) να τον ξαναχρησιμοποιεί χωρίς type-lie cast. `heightSpecLabel`
   * = ΗΔΗ μεταφρασμένο (i18n handler). Called AFTER `drawPreview`· wiped στο επόμενο `drawPreview`/`clear`.
   */
  drawFootprintHud(
    footprint: readonly Point2D[],
    descriptor: FootprintHudDescriptor,
    heightSpecLabel: string,
    transform: ViewTransform,
    viewport: Viewport,
  ): void {
    if (!this.ctx) return;
    paintFootprintHud(this.ctx, footprint, descriptor, heightSpecLabel, this.sceneUnits, transform, viewport);
  }

  /**
   * ADR-397 §15 (wall) — τόξο ΦΟΡΑΣ γωνίας τοίχου-φαντάσματος: μετά το 1ο κλικ, από τον
   * `pivotW` (αρχή τοίχου) με άξονα αναφοράς το `anchorW` (world-X) προς τον `cursorW`, χρωματισμένο
   * ανά πρόσημο `sweepDeg` (🟢 πάνω / 🔴 κάτω από τον x-άξονα) + βελάκι + baseline 0° + χρωματιστές
   * μοίρες. Κοινός SSoT painter με την περιστροφή (ADR-397 §15). Called AFTER `drawPreview`· wiped στο
   * επόμενο `drawPreview`/`clear`.
   */
  drawDirectionArc(
    pivotW: Point2D,
    anchorW: Point2D,
    cursorW: Point2D,
    sweepDeg: number,
    transform: ViewTransform,
    viewport: Viewport,
  ): void {
    if (!this.ctx) return;
    paintDirectionArc(this.ctx, pivotW, anchorW, cursorW, sweepDeg, transform, viewport);
  }

  /**
   * ADR-508 §opening-conflict — 🔴 tooltip που εξηγεί ΓΙΑΤΙ ο κάθετος τοίχος μπλοκάρει: κόβει
   * άνοιγμα host σε δεδομένο εύρος ύψους (3D έλεγχος αόρατος στην κάτοψη). Called AFTER `drawPreview`·
   * wiped στο επόμενο `drawPreview`/`clear`. Reuse `drawOverlayLabel` SSoT· χρώμα = overlap red.
   */
  drawGhostConflictTooltip(
    label: string,
    anchorWorld: Point2D,
    transform: ViewTransform,
    viewport: Viewport,
  ): void {
    if (!this.ctx || !label) return;
    const screen = CoordinateTransforms.worldToScreen(anchorWorld, transform, viewport);
    // ΚΑΤΩ-ΚΑΤΩ slot (CURSOR_LABEL_SLOTS.belowFar) ώστε το 🔴 conflict tooltip να στοιβάζεται κάτω
    // από polar (above) + tracking (below) αντί να πέφτει πάνω τους — ίδιο SSoT συμβόλαιο θέσεων.
    drawOverlayLabel(this.ctx, label, screen.x + CURSOR_LABEL_SLOTS.belowFar.dx, screen.y + CURSOR_LABEL_SLOTS.belowFar.dy, {
      textColor: resolveGhostStatusColor('overlap')?.stroke ?? '#d23b3b',
      align: 'left',
    });
  }

  /**
   * ADR-398 §3.13 — ζωγράφισε το πολικό πλέγμα (κέντρο/δακτύλιοι/ακτίνες) του Polar Magnet. Called
   * AFTER `drawPreview` ώστε να overlay-άρει το ghost· wiped στο επόμενο `drawPreview`/`clear`.
   */
  drawPolarDisk(grid: PolarDiskGrid, transform: ViewTransform, viewport: Viewport): void {
    if (!this.ctx) return;
    paintPolarDisk(this.ctx, grid, fromTransform(transform, viewport));
  }

  /**
   * ADR-398 §3.15 — ζωγράφισε το καρτεσιανό πλέγμα (γραμμές u/v + κέντρο) του Cartesian Magnet. Called
   * AFTER `drawPreview`· wiped στο επόμενο `drawPreview`/`clear`.
   */
  drawRectGrid(grid: RectGrid, transform: ViewTransform, viewport: Viewport): void {
    if (!this.ctx) return;
    paintRectGrid(this.ctx, grid, fromTransform(transform, viewport));
  }

  /**
   * Draw polar tracking alignment path + tooltip (ADR-357 Phase 1).
   * Called AFTER drawPreview so it overlays on top without clearing.
   * The next drawPreview call will clear this automatically.
   */
  drawPolarTrackingLine(
    ref: Point2D,
    snappedAngle: number,
    label: string,
    cursorWorld: Point2D,
    transform: ViewTransform,
    viewport: Viewport,
  ): void {
    if (!this.ctx) return;
    paintPolarTrackingLine(this.ctx, ref, snappedAngle, label, cursorWorld, transform, viewport);
  }

  /**
   * ADR-398 §3.20/§3.20d — ζωγράφισε τη γραμμή(ές)-οδηγό ευθυγράμμισης (τεταρτημόριο κυκλικής ↔ άκρο/
   * μέσον παρειάς ή πλευρά ορθογωνίου — **έως 2** στη γωνία). Called AFTER `drawPreview`· wiped στο επόμενο
   * `drawPreview`/`clear`. Normalize σε array (ΕΝΑ painter SSoT ανά τμήμα).
   */
  drawAlignmentGuide(
    guide: PlacementAlignmentGuide | readonly PlacementAlignmentGuide[],
    transform: ViewTransform,
    viewport: Viewport,
  ): void {
    if (!this.ctx) return;
    const guides: readonly PlacementAlignmentGuide[] = Array.isArray(guide) ? guide : [guide];
    const project = fromTransform(transform, viewport);
    for (const g of guides) paintAlignmentGuide(this.ctx, g, project);
  }

  /** Clear preview immediately */
  clear(): void {
    this.currentPreview = null;
    this.isDirty = false;

    // 🏢 SSoT DPR-clear (ADR-084 withCanvasState) — ίδιο idiom με τα ghost hooks.
    if (this.ctx && this.canvas) clearCanvasDpr(this.canvas, this.ctx);
  }

  /** Check if dirty (for UnifiedFrameScheduler) */
  checkDirty(): boolean {
    return this.isDirty;
  }

  /** Render frame */
  render(): void {
    if (!this.ctx || !this.canvas) return;

    const ctx = this.ctx;
    const dpr = this.dpr;

    // ADR-357 Phase 4: tracking markers can paint without an active preview
    // entity (acquired `+` glyphs persist between drawPreview cycles). Treat
    // viewport availability as the gating condition instead of preview entity.
    //
    // ADR-040 / ADR-398 §4: read the LIVE transform from the SSoT (same as the
    // main `dxf-canvas-renderer`), NOT a cached value — so a scheduler repaint
    // triggered by a wheel-zoom/pan (no mousemove) draws the cached world-coord
    // ghost at the new scale, world-locked. Zero-lag, zero re-snap.
    const transform = getImmediateTransform();
    const viewport = this.currentViewport;
    if (!viewport || viewport.width <= 0 || viewport.height <= 0) {
      this.isDirty = false;
      return;
    }

    // Always clear: handles the marker-cleared and preview-cleared cases
    // uniformly so stale glyphs never linger after `setTrackingMarkers([])`.
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.isDirty = false;

    // Paint tracking markers FIRST so the rubber-band preview (drawn below)
    // renders on top and the markers anchor the visual feedback.
    if (this.trackingMarkers.length > 0) {
      const palette = getTrackingPalette(detectTrackingTheme());
      paintTrackingMarkers(ctx, this.trackingMarkers, fromTransform(transform, viewport), palette);
    }

    if (!this.currentPreview) {
      return;
    }

    // Paint the active preview entity (WYSIWYG BIM ghost + generic dispatch + colored
    // grips). Extracted to `preview-entity-paint` (SRP) — render() owns only the frame
    // lifecycle (clear + dirty + tracking markers). Grip painter is injected so the
    // renderer keeps ownership of its `UnifiedGripRenderer`.
    paintPreviewEntity(
      ctx,
      this.currentPreview,
      transform,
      viewport,
      this.currentOptions,
      this.sceneUnits,
      this.bimPreview,
      (c, pos, o, cc) => this.renderGrip(c, pos, o, cc),
    );
  }

  // ===== PRIVATE HELPERS =====

  private renderGrip(
    _ctx: CanvasRenderingContext2D, screenPos: Point2D, opts: Required<PreviewRenderOptions>,
    customColor?: string,
  ): void {
    if (!this._gripRenderer) return;
    this._gripRenderer.renderGrip(
      {
        position: screenPos,
        type: 'vertex',
        shape: 'square',
        temperature: 'cold',
        customColor: customColor ?? opts.gripColor,
      },
      { gripSize: opts.gripSize, dpiScale: 1.0 }
    );
  }

  // ===== CLEANUP =====

  dispose(): void {
    this.clear();
    this.ctx = null;
    this.canvas = null;
    this._gripRenderer = null;
    this.bimPreview = null;
  }
}
