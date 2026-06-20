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
import { pointInPolygon } from '../../bim/geometry/shared/polygon-utils';
import { buildHatchLines } from '../../bim/geometry/shared/hatch-pattern-geometry';
import { isSolidHatch, type HatchIslandStyle } from '../../bim/hatch/hatch-properties';
import { CAD_UI_COLORS, HOVER_HIGHLIGHT } from '../../config/color-config';

/** Προεπιλεγμένη απόσταση γραμμών (mm) αν δεν δοθεί lineSpacing/patternScale. */
const DEFAULT_LINE_SPACING_MM = 100;
const HATCH_LINE_WIDTH = 0.5;

export class HatchRenderer extends BaseEntityRenderer {
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

    if (isSolidHatch(hatch)) {
      this.ctx.fillStyle = color;
      this.drawBoundaryPath(paths);
      this.ctx.fill('evenodd');
    } else {
      this.drawUserDefinedLines(hatch, paths, color);
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

  private islandStyle(hatch: HatchEntity): HatchIslandStyle {
    return hatch.islandStyle ?? 'normal';
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

  private drawUserDefinedLines(
    hatch: HatchEntity, paths: ReadonlyArray<ReadonlyArray<Point2D>>, color: string,
  ): void {
    const spacing = hatch.lineSpacing ?? hatch.patternScale ?? DEFAULT_LINE_SPACING_MM;
    const segments = buildHatchLines(paths, {
      spacingMm: spacing,
      angleDeg: hatch.lineAngle ?? hatch.patternAngle ?? 0,
      origin: hatch.patternOrigin,
      double: hatch.doubleCrossHatch ?? false,
      islandStyle: this.islandStyle(hatch),
    });
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = HATCH_LINE_WIDTH;
    this.ctx.setLineDash([]);
    this.ctx.beginPath();
    for (const seg of segments) {
      const a = this.worldToScreen(seg.start);
      const b = this.worldToScreen(seg.end);
      this.ctx.moveTo(a.x, a.y);
      this.ctx.lineTo(b.x, b.y);
    }
    this.ctx.stroke();
  }
}
