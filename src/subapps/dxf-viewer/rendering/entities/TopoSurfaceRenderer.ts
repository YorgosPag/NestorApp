/**
 * TopoSurfaceRenderer — ADR-662 Φάση 2β (Δρόμος Γ).
 *
 * 2Δ renderer για το thin/derived `TopoSurfaceEntity`: σχεδιάζει το **footprint**
 * (περίγραμμα της TIN, ένα ή περισσότερα κλειστά rings σε world canonical mm) ως
 * διακριτικό outline στην κάτοψη. Δεν κατέχει γεωμετρία — το footprint δίνει μόνο
 * την clickable/hover περιοχή ώστε η επιφάνεια να γίνεται first-class selectable
 * αντικείμενο (contextual tab + object-bound Properties). Το 3D mesh το κρατά ο
 * imperative `TerrainSceneLayer` (καμία per-type 3D mesh εδώ).
 *
 * Pure leaf (ADR-040): ΜΗΔΕΝ subscriptions σε high-frequency stores — παίρνει
 * transform μέσω `setTransform()` push (BaseEntityRenderer). Το styling (normal /
 * hover glow / selected) το δίνει το `renderWithPhases` — το outline κληρονομεί το
 * phase-resolved strokeStyle, άρα hover/selection τονίζουν ομοιόμορφα το περίγραμμα.
 *
 * Hit-test = **point-in-polygon** σε οποιοδήποτε ring (mirror `ImageRenderer` /
 * `HatchRenderer`): κλικ οπουδήποτε μέσα στην επιφάνεια την επιλέγει. Καμία λαβή
 * (derived entity — δεν μετακινείται/αλλάζει μέγεθος με grips· ξαναχτίζεται από το
 * `getTopoSurface`).
 *
 * @see types/topo-surface.ts — TopoSurfaceEntity contract
 * @see rendering/entities/ImageRenderer.ts — το non-BIM polygon-fill precedent
 * @see docs/centralized-systems/reference/adrs/ADR-662-topography-ribbon-migration.md
 */

import { BaseEntityRenderer } from './BaseEntityRenderer';
import type { EntityModel, Point2D, GripInfo, RenderOptions } from '../types/Types';
import type { Entity } from '../../types/entities';
import type { TopoSurfaceEntity } from '../../types/topo-surface';
import { isTopoSurfaceEntity } from '../../types/topo-surface';
import { isPointInPolygon } from '../../utils/geometry/GeometryUtils';

export class TopoSurfaceRenderer extends BaseEntityRenderer {
  render(entity: EntityModel, options: RenderOptions = {}): void {
    if (!isTopoSurfaceEntity(entity as Entity)) return;
    const e = entity as unknown as TopoSurfaceEntity;
    this.renderWithPhases(entity, options, () => this.drawFootprint(e));
  }

  /** Ζωγραφίζει κάθε κλειστό ring του footprint (phase-resolved strokeStyle). */
  private drawFootprint(e: TopoSurfaceEntity): void {
    for (const ring of e.footprint) {
      if (ring.length < 2) continue;
      this.ctx.beginPath();
      ring.forEach((p, i) => {
        const s = this.worldToScreen(p);
        return i === 0 ? this.ctx.moveTo(s.x, s.y) : this.ctx.lineTo(s.x, s.y);
      });
      this.ctx.closePath();
      this.ctx.stroke();
    }
  }

  /** Derived entity — ξαναχτίζεται από το `getTopoSurface`, καμία grip επεξεργασία. */
  getGrips(_entity: EntityModel): GripInfo[] {
    return [];
  }

  /** Fill hit-test — κλικ μέσα σε οποιοδήποτε ring επιλέγει την επιφάνεια (mirror hatch/image). */
  hitTest(entity: EntityModel, point: Point2D, _tolerance: number): boolean {
    if (!isTopoSurfaceEntity(entity as Entity)) return false;
    const e = entity as unknown as TopoSurfaceEntity;
    return e.footprint.some((ring) => ring.length >= 3 && isPointInPolygon(point, ring));
  }
}
