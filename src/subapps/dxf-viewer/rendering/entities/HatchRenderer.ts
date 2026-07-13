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
import type { Entity, HatchEntity, HatchImageFill } from '../../types/entities';
import { isHatchEntity } from '../../types/entities';
import { createVertexGrip, createEdgeGrip } from './shared/grip-utils';
import { hatchBoundsCenter, hatchGradientAngleGripPos, getHatchBoundaryGrips, getHatchEdgeMidpointGrips } from '../../bim/hatch/hatch-grips';
// ADR-627 — whole-hatch MOVE cross + rotation handle (area/polyline parity). The SAME
// `getHatchMoveRotateGrips` SSoT the interaction path emits → drawn ≡ pickable.
import { getHatchMoveRotateGrips } from '../../bim/hatch/hatch-move-rotate-grips';
import { toMoveRotateGlyphGrips } from '../../bim/grips/move-rotate-glyph-grips';
import { pointInPolygon } from '../../bim/geometry/shared/polygon-utils';
import { buildHatchEntitySegments, hatchMinWorldSpacing } from '../../bim/geometry/shared/hatch-pattern-geometry';
import { isSolidHatch, resolveHatchLineWidthPx } from '../../bim/hatch/hatch-properties';
import type { HatchGradient } from '../../bim/hatch/hatch-gradient';
// ADR-507 Φ5 / A3 — pure gradient paint SSoT (κοινό με το live grip-drag ghost,
// `draw-ghost-entity` case 'hatch'· preview === commit, μηδέν δεύτερη gradient math).
import { fillHatchGradient, traceHatchBoundary } from './shared/hatch-gradient-paint';
// ADR-643 Φ1 — image fill: pure tiling/paint SSoT + live decoded-image cache. Ο
// `fillHatchPattern` είναι ΓΕΝΙΚΟΣ → τον μοιράζεται και το screen-raster μονοπάτι.
import {
  resolveImageFillOrigin, computeImageTileMatrix, fillHatchPattern, drawImageGrout, averageImageColor,
} from './shared/hatch-image-paint';
import { HatchImageCache } from './shared/hatch-image-cache';
// ADR-653 Φ8 — variant key SSoT: «τι ζωγραφίζεται» (υλικό + tint), όχι σκέτο assetId.
import { imageFillVariantKey } from './shared/hatch-image-variant-key';
// ADR-040 — async asset load «σπρώχνει» ένα dirty-frame (ο renderer δεν subscribe-άρει).
import { markAllCanvasDirty } from '../core/frame-scheduler-api';
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
 * ADR-531 Φ5b.6 — screen-space raster μοτίβο (`patternSpace:'screen'`, Τέκτων raster hatch).
 * Οι γραμμές έχουν σταθερή απόσταση σε **pixels ΟΘΟΝΗΣ**, zoom-independent (ground truth Giorgio:
 * ~1-2px, σταθερό όσο κι αν αλλάζει το ζουμ) — ζωγραφίζεται ως `CanvasPattern` tile αντί για
 * world-space segments. `TILE_W` >1 για φθηνό repeat· `SPACING_PX` = κάθετη απόσταση γραμμών.
 */
const SCREEN_HATCH_SPACING_PX = 3;
const SCREEN_HATCH_LINE_PX = 1;
const SCREEN_HATCH_TILE_W = 8;
const SCREEN_HATCH_DEFAULT_ANGLE_DEG = 45;

/**
 * ADR-643 Φ1 — density-LOD κατώφλι για image fill: κάτω από αυτό το on-screen μέγεθος
 * tile (px) η εικόνα είναι δυσδιάκριτη μάζα → ο renderer πέφτει σε μέσο-χρώμα solid tint
 * (μηδέν drawImage cost σε zoom-out· ίδιο σκεπτικό με το {@link HATCH_MIN_LINE_SPACING_PX}).
 */
const HATCH_IMAGE_MIN_TILE_PX = 4;

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
  /** ADR-531 Φ5b.6 — cache του screen-space raster `CanvasPattern` ανά χρώμα (tile = σταθερό px). */
  private readonly screenPatternCache = new Map<string, CanvasPattern | null>();
  /** ADR-643 Φ1 — live cache decoded εικόνων υλικού· async load → dirty-frame (ADR-040). */
  private readonly imageCache = new HatchImageCache(markAllCanvasDirty);
  /** ADR-643 Φ1 / ADR-653 Φ8 — `CanvasPattern` (repeat) ανά variant key· size/angle/scale στο DOMMatrix. */
  private readonly imagePatternCache = new Map<string, CanvasPattern | null>();
  /** ADR-643 Φ1 / ADR-653 Φ8 — μέσο χρώμα εικόνας ανά variant key (LOD tint fallback)· `null`=taint. */
  private readonly averageColorCache = new Map<string, string | null>();

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

  /**
   * ADR-531 Φ5b.6 — `CanvasPattern` (tile) οριζόντιων γραμμών σε σταθερό px, ανά χρώμα (cached).
   * Το tile μένει σε συντεταγμένες ΟΘΟΝΗΣ → σταθερή πυκνότητα ανεξάρτητα ζουμ. Rotation/anchor
   * γίνονται στο {@link fillScreenSpacePattern} μέσω `setTransform`. `null` αν αποτύχει το 2D ctx.
   */
  private screenSpacePattern(color: string): CanvasPattern | null {
    const hit = this.screenPatternCache.get(color);
    if (hit !== undefined) return hit;
    const tile = document.createElement('canvas');
    tile.width = SCREEN_HATCH_TILE_W;
    tile.height = SCREEN_HATCH_SPACING_PX;
    const tctx = tile.getContext('2d');
    let pat: CanvasPattern | null = null;
    if (tctx) {
      tctx.strokeStyle = color;
      tctx.lineWidth = SCREEN_HATCH_LINE_PX;
      // Μία οριζόντια γραμμή ανά tile → επανάληψη = παράλληλες γραμμές κάθε SPACING_PX. Το 0.5
      // κεντράρει τη 1px γραμμή σε ακέραιο pixel (crisp, χωρίς AA blur).
      tctx.beginPath();
      tctx.moveTo(0, SCREEN_HATCH_SPACING_PX - 0.5);
      tctx.lineTo(SCREEN_HATCH_TILE_W, SCREEN_HATCH_SPACING_PX - 0.5);
      tctx.stroke();
      pat = this.ctx.createPattern(tile, 'repeat');
    }
    this.screenPatternCache.set(color, pat);
    return pat;
  }

  /**
   * ADR-531 Φ5b.6 — γεμίζει το όριο με raster μοτίβο σταθερής πυκνότητας px (Τέκτων raster hatch).
   * Στρέφει τις (οριζόντιες στο tile) γραμμές στη γωνία `angleDeg` και αγκυρώνει τη φάση στο screen
   * position του world origin → το μοτίβο «κουνιέται» με το pan (δεν σέρνεται) ΚΑΙ κρατά σταθερό px
   * ανεξάρτητα ζουμ. Επιστρέφει `false` αν δεν φτιάχτηκε pattern → ο caller πέφτει σε world-space.
   */
  private fillScreenSpacePattern(
    paths: ReadonlyArray<ReadonlyArray<Point2D>>, color: string, angleDeg: number,
  ): boolean {
    const pat = this.screenSpacePattern(color);
    if (!pat) return false;
    let matrix: DOMMatrix | null = null;
    if (typeof pat.setTransform === 'function' && typeof DOMMatrix === 'function') {
      const o = this.worldToScreen({ x: 0, y: 0 });
      matrix = new DOMMatrix().translate(o.x, o.y).rotate(angleDeg);
    }
    // Κοινό «γέμισε boundary με transformed pattern» SSoT (ADR-643) — ίδιο μονοπάτι με image fill.
    fillHatchPattern(this.ctx, paths, pat, matrix, (p) => this.worldToScreen(p));
    return true;
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

    // ADR-507 — per-object διαφάνεια (ribbon «Διαφάνεια», `options.alpha` από
    // `transparencyToAlpha(entity.transparency)`). Ο HatchRenderer έχει custom render() που
    // ΔΕΝ περνά από το `BaseEntityRenderer.setupStyle` (όπου κανονικά μπαίνει το alpha), οπότε
    // το εφαρμόζουμε ρητά εδώ μέσα στο outer save → όλα τα γεμίσματα/όρια το κληρονομούν.
    // Χωρίς αυτό η επεξεργασία διαφάνειας αγνοούνταν σιωπηλά ΜΟΝΟ για τη γραμμοσκίαση.
    if (options.alpha !== undefined && options.alpha < 1) {
      this.ctx.globalAlpha *= options.alpha;
    }

    const color = hatch.fillColor ?? entity.color ?? CAD_UI_COLORS.entity.default;

    // ADR-507 / ADR-531 Φ5b.6 — «Background color» (AutoCAD DXF 63): γεμίζει την περιοχή ΠΙΣΩ από
    // τις γραμμές μοτίβου (π.χ. ο Τέκτων δίνει λευκό raster_bgcolor → λευκό φόντο + πράσινες γραμμές).
    // Μόνο για pattern/user-defined· solid/gradient γεμίζουν ήδη πλήρως. even-odd → νησίδες = τρύπες.
    if (hatch.backgroundColor && !isSolidHatch(hatch)
      && hatch.fillType !== 'gradient' && hatch.fillType !== 'image') {
      this.fillBoundary(paths, hatch.backgroundColor);
    }

    if (hatch.fillType === 'image' && hatch.imageFill) {
      // ADR-643 Φ1 — εικόνα υλικού tiled στην περιοχή (μοντέλο ArchiCAD «Image Fill»).
      this.fillImage(paths, hatch.imageFill, color);
    } else if (hatch.fillType === 'gradient' && hatch.gradient) {
      this.fillGradient(paths, hatch.gradient, hatch.patternOrigin);
    } else if (isSolidHatch(hatch)) {
      this.fillBoundary(paths, color);
    } else if (
      hatch.patternSpace === 'screen'
      && this.fillScreenSpacePattern(paths, color, hatch.lineAngle ?? SCREEN_HATCH_DEFAULT_ANGLE_DEG)
    ) {
      // ADR-531 Φ5b.6 — raster μοτίβο: σταθερή πυκνότητα px (zoom-independent, Τέκτων). Ο έλεγχος
      // ΚΑΙ ζωγραφίζει· `false` (αδύνατο createPattern) → πέφτει στους world-space κλάδους παρακάτω.
    } else if (this.isLineDensityTooHigh(hatch)) {
      // Density-LOD: γραμμές sub-pixel → ελαφρύ solid tint (1 op αντί για χιλιάδες
      // γραμμές). Παραλείπει ΚΑΙ την παραγωγή segments (μηδέν cost σε zoom-out).
      this.fillBoundary(paths, color, HATCH_COLLAPSE_ALPHA);
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
    // ADR-507 §grip-SSoT — the SAME boundary-vertex source the interaction path
    // (`computeDxfEntityGrips`) uses, so drawn grips ≡ pickable grips (no divergence). Array
    // order = the running `gi` index, kept 1-to-1 with the interaction gripIndex.
    for (const g of getHatchBoundaryGrips(hatch.boundaryPaths ?? [])) {
      grips.push(createVertexGrip(entity.id, { x: g.point.x, y: g.point.y }, gi));
      gi += 1;
    }
    // ADR-507 (Giorgio 2026-07-07) — edge-midpoint grips (one per boundary edge), right after
    // the vertex grips, from the SAME SSoT (`getHatchEdgeMidpointGrips`) the interaction path
    // (`computeDxfEntityGrips`) uses → drawn ≡ pickable. Clicking/dragging one inserts a vertex.
    for (const e of getHatchEdgeMidpointGrips(hatch.boundaryPaths ?? [])) {
      grips.push(createEdgeGrip(entity.id, { x: e.point.x, y: e.point.y }, gi));
      gi += 1;
    }
    // ADR-507 Φ5 A3 — gradient origin/seed grip (ΟΡΑΤΟ· το interaction οδηγείται από
    // το computeDxfEntityGrips με `hatchGripKind`). Index = μετά τις κορυφές, ώστε να
    // αντιστοιχεί 1-προς-1 με την origin λαβή του computeDxfEntityGrips. Μόνο gradient.
    // ADR-507 Φ5 A3b/A4 — origin (gi) + angle (gi+1) λαβές. Όταν ΑΥΤΗ που σέρνεται είναι
    // active, ΜΗΝ την εκπέμπεις: το main canvas δεν ξαναζωγραφίζεται κατά το drag (ADR-040)
    // → θα έμενε «παγωμένη». Το live marker την ακολουθεί στο preview (`useGripGhostPreview`).
    if (hatch.fillType === 'gradient') {
      const active = this.gripInteraction.active;
      const originPos = hatch.patternOrigin ?? hatchBoundsCenter(hatch.boundaryPaths ?? []);
      if (originPos) {
        const originIdx = gi;
        const originActive = active?.entityId === entity.id && active.gripIndex === originIdx;
        if (!originActive) grips.push(createVertexGrip(entity.id, originPos, originIdx));
        gi += 1; // advance even when suppressed → ADR-627 handles keep interaction indices
        const anglePos = hatchGradientAngleGripPos(originPos, hatch.gradient?.angleDeg ?? 0, hatch.boundaryPaths ?? []);
        if (anglePos) {
          const angleIdx = gi;
          const angleActive = active?.entityId === entity.id && active.gripIndex === angleIdx;
          if (!angleActive) grips.push(createVertexGrip(entity.id, anglePos, angleIdx));
          gi += 1;
        }
      }
    }
    // ADR-627 — whole-hatch MOVE cross + rotation handle, appended LAST via the SAME
    // `getHatchMoveRotateGrips` SSoT the interaction path uses (drawn ≡ pickable). Move →
    // 4-arrow MOVE glyph, rotation → curved ROTATION glyph via the `gripGlyphShape` registry.
    grips.push(
      ...toMoveRotateGlyphGrips(
        getHatchMoveRotateGrips(entity.id, hatch.boundaryPaths?.[0] ?? [], gi),
        'hatch',
      ),
    );
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
   * Γέμισμα gradient (ADR-507 Φ5). Delegate στο pure SSoT `fillHatchGradient`
   * (κοινό με το live grip-drag ghost) — μηδέν τοπική gradient math. Περνά τον ίδιο
   * `worldToScreen` + `transform.scale` που χρησιμοποιεί ο renderer.
   */
  private fillGradient(
    paths: ReadonlyArray<ReadonlyArray<Point2D>>, gradient: HatchGradient,
    origin?: Point2D,
  ): void {
    fillHatchGradient(this.ctx, paths, gradient, {
      origin,
      toScreen: (p) => this.worldToScreen(p),
      scale: this.transform.scale,
    });
  }

  /** Χτίζει ΕΝΑ canvas path με ΟΛΑ τα boundary paths ως subpaths (delegate στο SSoT). */
  private drawBoundaryPath(paths: ReadonlyArray<ReadonlyArray<Point2D>>): void {
    traceHatchBoundary(this.ctx, paths, (p) => this.worldToScreen(p));
  }

  /**
   * SSoT: γεμίζει το boundary (even-odd → νησίδες = τρύπες) με συμπαγές χρώμα· προαιρετικό
   * `alpha` multiply (LOD tint). Κοινό για solid / background / density-LOD / image tint
   * fallback — μηδέν επανάληψη του save→fillStyle→trace→fill('evenodd')→restore idiom.
   */
  private fillBoundary(
    paths: ReadonlyArray<ReadonlyArray<Point2D>>, color: string, alpha = 1,
  ): void {
    this.ctx.save();
    if (alpha < 1) this.ctx.globalAlpha *= alpha;
    this.ctx.fillStyle = color;
    this.drawBoundaryPath(paths);
    this.ctx.fill('evenodd');
    this.ctx.restore();
  }

  /**
   * ADR-643 Φ1 — γέμισμα με εικόνα υλικού: tiled `CanvasPattern` κομμένο στο boundary,
   * με κλίμακα δεμένη στην πραγματική διάσταση tile (mm). LOD/async fallback: εικόνα
   * μη-φορτωμένη ή sub-threshold tile → μέσο χρώμα (ή hatch color) ως ελαφρύ solid tint
   * (μηδέν drawImage cost σε zoom-out· fire-and-forget load → dirty-frame μέσω cache).
   */
  private fillImage(
    paths: ReadonlyArray<ReadonlyArray<Point2D>>, imageFill: HatchImageFill, fallbackColor: string,
  ): void {
    // ADR-653 Φ8 — ΕΝΑ variant key τρέφει ΚΑΙ τα τρία caches (decoded image / pattern /
    // μέσο χρώμα), ώστε καφέ vs άσπρη/μαύρη εκδοχή του ίδιου υλικού να μη συγκρούονται.
    const key = imageFillVariantKey(imageFill);
    const img = this.imageCache.resolve({
      key,
      assetId: imageFill.assetId,
      tint: imageFill.tint,
      procedural: imageFill.procedural,
      tileWidthMm: imageFill.tileWidth,
      tileHeightMm: imageFill.tileHeight,
    });
    if (!img || this.isImageTileTooSmall(imageFill)) {
      const tint = img
        ? this.cachedAverageColor(key, img) ?? fallbackColor
        : fallbackColor;
      this.fillBoundary(paths, tint, HATCH_COLLAPSE_ALPHA);
      return;
    }
    const pattern = this.imagePattern(key, img);
    if (!pattern) { this.fillBoundary(paths, fallbackColor, HATCH_COLLAPSE_ALPHA); return; }
    const origin = resolveImageFillOrigin(paths, imageFill);
    if (!origin) return;
    const matrix = computeImageTileMatrix(
      img, imageFill, this.worldToScreen(origin), this.transform.scale,
    );
    fillHatchPattern(this.ctx, paths, pattern, matrix, (p) => this.worldToScreen(p));
    // ADR-643 Φ5 — αρμοί στα όρια των tiles (ίδια matrix → ακριβής ευθυγράμμιση).
    if (imageFill.grout && matrix) {
      drawImageGrout(
        this.ctx, paths, img, matrix, imageFill.grout, this.transform.scale, (p) => this.worldToScreen(p),
      );
    }
  }

  /** True όταν το tile προβάλλεται sub-threshold px στο τρέχον zoom (→ LOD tint). */
  private isImageTileTooSmall(f: HatchImageFill): boolean {
    const minTilePx = Math.min(f.tileWidth, f.tileHeight || f.tileWidth) * this.transform.scale;
    return minTilePx > 0 && minTilePx < HATCH_IMAGE_MIN_TILE_PX;
  }

  /** `CanvasPattern` (repeat) ανά variant key — size/angle/scale μπαίνουν στο DOMMatrix (cached). */
  private imagePattern(key: string, img: CanvasImageSource): CanvasPattern | null {
    const hit = this.imagePatternCache.get(key);
    if (hit !== undefined) return hit;
    const pat = this.ctx.createPattern(img, 'repeat');
    this.imagePatternCache.set(key, pat);
    return pat;
  }

  /** Μέσο χρώμα εικόνας ανά variant key (delegate στο pure SSoT· cached). */
  private cachedAverageColor(key: string, img: CanvasImageSource): string | null {
    const hit = this.averageColorCache.get(key);
    if (hit !== undefined) return hit;
    const c = averageImageColor(img);
    this.averageColorCache.set(key, c);
    return c;
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
