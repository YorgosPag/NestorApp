/**
 * HatchRenderer — ADR-507 Φ1a.
 *
 * 2D renderer για `HatchEntity` (AutoCAD HATCH/BHATCH). Φ1a υποστηρίζει:
 *   - solid fill (συμπαγές γέμισμα, even-odd με νησίδες)
 *   - user-defined lines (παράλληλες γραμμές μέσω `buildHatchLines` SSoT)
 * + outline των ορίων. Predefined PAT / gradient = επόμενες φάσεις.
 *
 * ADR-040 micro-leaf: pure renderer, ZERO subscriptions σε high-frequency stores·
 * παίρνει transform μέσω `setTransform()` push (BaseEntityRenderer).
 *
 * FULL SSoT: οι γραμμές του user-defined hatch προέρχονται από το ΙΔΙΟ
 * `buildHatchLines()` που τρέφει και το exploded-DXF (lines-mode) — canvas & DXF
 * δείχνουν ακριβώς την ίδια γεωμετρία.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-507-hatch-creation-system.md
 * @see docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 */

import { BaseEntityRenderer } from './BaseEntityRenderer';
import type { EntityModel, GripInfo, RenderOptions, Point2D } from '../types/Types';
import type { Entity, HatchEntity } from '../../types/entities';
import { isHatchEntity } from '../../types/entities';
import { createVertexGrip } from './shared/grip-utils';
import { hatchBounds, hatchBoundsCenter } from '../../bim/hatch/hatch-grips';
import { pointInPolygon } from '../../bim/geometry/shared/polygon-utils';
import { buildHatchEntitySegments, hatchMinWorldSpacing } from '../../bim/geometry/shared/hatch-pattern-geometry';
import { isSolidHatch, resolveHatchLineWidthPx } from '../../bim/hatch/hatch-properties';
import {
  resolveGradientStops, isRadialGradientType, normalizeGradientShift, type HatchGradient,
} from '../../bim/hatch/hatch-gradient';
import { degToRad } from './shared/geometry-angle-utils';
import { aabbIntersectsRaw } from '../hitTesting/bounds-operations';
import { CAD_UI_COLORS, HOVER_HIGHLIGHT } from '../../config/color-config';
/**
 * Density-LOD: κάτω από αυτή την on-screen απόσταση (px) οι γραμμές μοτίβου γίνονται
 * δυσδιάκριτη μάζα → ο renderer τις αντικαθιστά με ένα ελαφρύ solid tint (industry
 * pattern: AutoCAD δείχνει πυκνό hatch ως «γεμάτο» σε μικρό zoom). Αποφεύγει την
 * παραγωγή/σχεδίαση χιλιάδων γραμμών σε zoom-out — η κύρια αιτία βαρύτητας.
 */
const HATCH_MIN_LINE_SPACING_PX = 3;
/** Διαφάνεια του collapsed solid tint (διαβάζεται ως «γεμάτο» χωρίς να βαραίνει). */
const HATCH_COLLAPSE_ALPHA = 0.45;
/** Πάνω από τόσα segments ενεργοποιείται το viewport culling (αλλιώς ασύμφορο). */
const CULL_SEGMENT_THRESHOLD = 200;
/** Όριο εγγραφών στο segment cache (αποφυγή ανεξέλεγκτης μεγέθυνσης). */
const SEG_CACHE_MAX = 256;

/**
 * Φθηνό signature των geometry-relevant πεδίων μιας γραμμοσκίασης. Τα segments είναι
 * σε WORLD coords (transform-independent) → αλλάζουν ΜΟΝΟ όταν αλλάξει η γεωμετρία ή
 * οι ρυθμίσεις μοτίβου, ΟΧΙ σε pan/zoom. Περιλαμβάνει checksum κορυφών (πιάνει grip
 * moves) χωρίς ακριβό JSON.stringify ανά frame.
 */
function hatchSegmentSignature(h: HatchEntity): string {
  let cs = 0;
  let counts = '';
  for (const p of h.boundaryPaths ?? []) {
    counts += `${p.length},`;
    for (const v of p) cs += v.x * 31.1 + v.y * 7.3;
  }
  return [
    h.fillType, h.patternName, h.patternScale, h.patternAngle, h.islandStyle,
    h.lineAngle, h.lineSpacing, h.doubleCrossHatch, counts, cs.toFixed(2),
  ].join('|');
}

export class HatchRenderer extends BaseEntityRenderer {
  /**
   * ADR-507 §4.5 / ADR-040 — cache των (world-coord) pattern segments ανά entity.
   * Χωρίς αυτό, ο `render()` ξαναϋπολόγιζε χιλιάδες clipped segments σε ΚΑΘΕ frame
   * (pan/zoom/hover) → βαρύ. Invalidate μόνο όταν αλλάξει το geometry signature.
   */
  private readonly segCache = new Map<string, { sig: string; segs: ReturnType<typeof buildHatchEntitySegments> }>();

  /** Cached pattern segments (recompute μόνο σε αλλαγή geometry/pattern). */
  private cachedSegments(hatch: HatchEntity): ReturnType<typeof buildHatchEntitySegments> {
    const sig = hatchSegmentSignature(hatch);
    const hit = this.segCache.get(hatch.id);
    if (hit && hit.sig === sig) return hit.segs;
    const segs = buildHatchEntitySegments(hatch);
    if (this.segCache.size >= SEG_CACHE_MAX && !this.segCache.has(hatch.id)) {
      this.segCache.clear(); // απλό bounded reset (σπάνιο σε τυπική σκηνή)
    }
    this.segCache.set(hatch.id, { sig, segs });
    return segs;
  }

  render(entity: EntityModel, options: RenderOptions = {}): void {
    if (!isHatchEntity(entity)) return;
    const hatch = entity as HatchEntity;
    const paths = (hatch.boundaryPaths ?? []).filter((p) => p.length >= 3);
    if (!paths.length) return;

    const phaseState = this.phaseManager.determinePhase(entity as Entity, options);

    // Hover halo (mirror FloorFinishRenderer).
    if (phaseState.phase === 'highlighted') {
      this.ctx.save();
      this.ctx.strokeStyle = HOVER_HIGHLIGHT.ENTITY.glowColor;
      this.ctx.lineWidth = HOVER_HIGHLIGHT.ENTITY.glowExtraWidth + 1.5;
      this.ctx.globalAlpha = HOVER_HIGHLIGHT.ENTITY.glowOpacity;
      this.ctx.setLineDash([]);
      this.drawBoundaryPath(paths);
      this.ctx.stroke();
      this.ctx.restore();
    }

    this.phaseManager.applyPhaseStyle(entity as Entity, phaseState);
    this.ctx.save();

    const color = hatch.fillColor ?? entity.color ?? CAD_UI_COLORS.entity.default;

    if (hatch.fillType === 'gradient' && hatch.gradient) {
      this.fillGradient(paths, hatch.gradient, hatch.patternOrigin);
    } else if (isSolidHatch(hatch)) {
      this.ctx.fillStyle = color;
      this.drawBoundaryPath(paths);
      this.ctx.fill('evenodd');
    } else if (this.isLineDensityTooHigh(hatch)) {
      // Density-LOD: γραμμές sub-pixel → ελαφρύ solid tint (1 op αντί για χιλιάδες
      // γραμμές). Παραλείπει ΚΑΙ την παραγωγή segments (μηδέν cost σε zoom-out).
      this.ctx.save();
      this.ctx.globalAlpha *= HATCH_COLLAPSE_ALPHA;
      this.ctx.fillStyle = color;
      this.drawBoundaryPath(paths);
      this.ctx.fill('evenodd');
      this.ctx.restore();
    } else {
      // SSoT: ίδια segments με τον DXF writer· cached (transform-independent, ADR-040).
      // Πάχος γραμμών = AutoCAD LWT (zoom-independent) από το lineweightMm (ADR-507 Φ2).
      this.drawPatternSegments(
        this.cachedSegments(hatch), color, resolveHatchLineWidthPx(hatch.lineweightMm),
      );
    }

    // Boundary outline.
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = 1;
    this.ctx.setLineDash([]);
    this.drawBoundaryPath(paths);
    this.ctx.stroke();

    this.ctx.restore();
    this.finalizeRender(entity, options);
  }

  getGrips(entity: EntityModel): GripInfo[] {
    if (!isHatchEntity(entity)) return [];
    const hatch = entity as HatchEntity;
    const grips: GripInfo[] = [];
    let gi = 0;
    for (const path of hatch.boundaryPaths ?? []) {
      for (const v of path) {
        grips.push(createVertexGrip(entity.id, { x: v.x, y: v.y }, gi));
        gi += 1;
      }
    }
    // ADR-507 Φ5 A3 — gradient origin/seed grip (ΟΡΑΤΟ· το interaction οδηγείται από
    // το computeDxfEntityGrips με `hatchGripKind`). Index = μετά τις κορυφές, ώστε να
    // αντιστοιχεί 1-προς-1 με την origin λαβή του computeDxfEntityGrips. Μόνο gradient.
    if (hatch.fillType === 'gradient') {
      const originPos = hatch.patternOrigin ?? hatchBoundsCenter(hatch.boundaryPaths ?? []);
      if (originPos) grips.push(createVertexGrip(entity.id, originPos, gi));
    }
    return grips;
  }

  hitTest(entity: EntityModel, point: Point2D, _tolerance: number): boolean {
    if (!isHatchEntity(entity)) return false;
    const hatch = entity as HatchEntity;
    const paths = (hatch.boundaryPaths ?? []).filter((p) => p.length >= 3);
    if (!paths.length) return false;
    // even-odd: μέσα σε μονό πλήθος ορίων (νησίδες = τρύπες).
    let count = 0;
    for (const path of paths) if (pointInPolygon(point, path)) count += 1;
    return count % 2 === 1;
  }

  // ─── Internal helpers ──────────────────────────────────────────────────────

  /** True όταν οι γραμμές μοτίβου είναι sub-pixel πυκνές στο τρέχον zoom (→ LOD tint). */
  private isLineDensityTooHigh(hatch: HatchEntity): boolean {
    const worldSpacing = hatchMinWorldSpacing(hatch);
    if (worldSpacing <= 0) return false;
    return worldSpacing * this.transform.scale < HATCH_MIN_LINE_SPACING_PX;
  }

  /** Ορατά world bounds (με μικρό margin) για segment culling· null αν άγνωστο μέγεθος. */
  private visibleWorldBounds(): { minX: number; minY: number; maxX: number; maxY: number } | null {
    const w = this.ctx.canvas.clientWidth;
    const h = this.ctx.canvas.clientHeight;
    if (w <= 0 || h <= 0) return null;
    const a = this.screenToWorld({ x: 0, y: 0 });
    const b = this.screenToWorld({ x: w, y: h });
    const margin = 4 / Math.max(this.transform.scale, 1e-6);
    return {
      minX: Math.min(a.x, b.x) - margin, maxX: Math.max(a.x, b.x) + margin,
      minY: Math.min(a.y, b.y) - margin, maxY: Math.max(a.y, b.y) + margin,
    };
  }

  /**
   * Γέμισμα gradient (ADR-507 Φ5). Χτίζει CanvasGradient σε screen space: linear κατά
   * τη γωνία (world, μέσω 2 `worldToScreen` endpoints — το uniform transform διατηρεί
   * τη γραμμικότητα)· radial από το κέντρο. Stops μέσω του SSoT `resolveGradientStops`.
   * even-odd → νησίδες μένουν κενές (όπως solid).
   */
  private fillGradient(
    paths: ReadonlyArray<ReadonlyArray<Point2D>>, gradient: HatchGradient,
    origin?: Point2D,
  ): void {
    // SSoT bbox (κοινό με το gradient-origin grip default).
    const b = hatchBounds(paths);
    if (!b || b.maxX <= b.minX || b.maxY <= b.minY) return;
    // origin (seed, ADR-507 Φ5 A3) = το patternOrigin όταν υπάρχει, αλλιώς κέντρο bbox.
    const cx = origin?.x ?? (b.minX + b.maxX) / 2;
    const cy = origin?.y ?? (b.minY + b.maxY) / 2;
    const w = b.maxX - b.minX; const h = b.maxY - b.minY;

    // shift (DXF 461) → μετατοπίζει τη γεωμετρία κατά τον άξονα της γωνίας (όχι τα
    // stops → μηδέν degenerate offset). 0=centered· →1 το 1ο χρώμα κυριαρχεί.
    const shiftN = normalizeGradientShift(gradient.shift);
    const r = degToRad(gradient.angleDeg ?? 0);
    const dx = Math.cos(r); const dy = Math.sin(r);

    let grad: CanvasGradient;
    if (isRadialGradientType(gradient.type)) {
      const rWorld = 0.5 * Math.hypot(w, h);
      // shift → μετακινεί το «κέντρο φωτισμού» εκτός κέντρου κατά τη γωνία.
      const c = this.worldToScreen({ x: cx + dx * shiftN * rWorld, y: cy + dy * shiftN * rWorld });
      const rScreen = Math.max(1, rWorld * this.transform.scale);
      grad = this.ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, rScreen);
    } else {
      const half = 0.5 * (Math.abs(w * dx) + Math.abs(h * dy)) || 0.5 * Math.hypot(w, h);
      // shift → «γλιστράει» τον άξονα κατά shiftN*half· το CanvasGradient κάνει
      // clamp στα άκρα → το 1ο χρώμα γεμίζει περισσότερο το bbox.
      const s = shiftN * half;
      const p0 = this.worldToScreen({ x: cx - dx * half + dx * s, y: cy - dy * half + dy * s });
      const p1 = this.worldToScreen({ x: cx + dx * half + dx * s, y: cy + dy * half + dy * s });
      grad = this.ctx.createLinearGradient(p0.x, p0.y, p1.x, p1.y);
    }
    for (const stop of resolveGradientStops(gradient)) grad.addColorStop(stop.offset, stop.color);

    this.ctx.fillStyle = grad;
    this.drawBoundaryPath(paths);
    this.ctx.fill('evenodd');
  }

  /** Χτίζει ΕΝΑ canvas path με ΟΛΑ τα boundary paths ως subpaths (για even-odd fill). */
  private drawBoundaryPath(paths: ReadonlyArray<ReadonlyArray<Point2D>>): void {
    this.ctx.beginPath();
    for (const path of paths) {
      if (path.length < 2) continue;
      const first = this.worldToScreen({ x: path[0].x, y: path[0].y });
      this.ctx.moveTo(first.x, first.y);
      for (let i = 1; i < path.length; i += 1) {
        const s = this.worldToScreen({ x: path[i].x, y: path[i].y });
        this.ctx.lineTo(s.x, s.y);
      }
      this.ctx.closePath();
    }
  }

  /** Σχεδιάζει τα τμήματα μοτίβου (κοινό για user-defined + predefined). */
  private drawPatternSegments(
    segments: ReadonlyArray<{ start: Point2D; end: Point2D }>, color: string,
    lineWidthPx: number,
  ): void {
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = lineWidthPx;
    this.ctx.setLineDash([]);
    // Viewport culling μόνο όταν αξίζει (πολλά segments) — αλλιώς ο έλεγχος bounds
    // κοστίζει περισσότερο απ' ό,τι κερδίζει. Off-screen segments → ΟΧΙ transform.
    const bounds = segments.length > CULL_SEGMENT_THRESHOLD ? this.visibleWorldBounds() : null;
    this.ctx.beginPath();
    for (const seg of segments) {
      // Reuse AABB SSoT (aabbIntersectsRaw)· skip segments που δεν τέμνουν το viewport.
      if (bounds && !aabbIntersectsRaw(
        Math.min(seg.start.x, seg.end.x), Math.min(seg.start.y, seg.end.y),
        Math.max(seg.start.x, seg.end.x), Math.max(seg.start.y, seg.end.y),
        bounds.minX, bounds.minY, bounds.maxX, bounds.maxY,
      )) continue;
      const a = this.worldToScreen(seg.start);
      const b = this.worldToScreen(seg.end);
      this.ctx.moveTo(a.x, a.y);
      this.ctx.lineTo(b.x, b.y);
    }
    this.ctx.stroke();
  }
}
