/**
 * TopoSurfaceRenderer — ADR-662 Φάση 2β (Δρόμος Γ).
 *
 * 2Δ renderer για το thin/derived `TopoSurfaceEntity`: σχεδιάζει το **footprint**
 * (περίγραμμα της TIN, ένα ή περισσότερα κλειστά rings στο **ενεργό display frame** —
 * ο builder έχει ήδη προβάλει, βλ. `types/topo-surface.ts`) ως
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
 * `HatchRenderer`): κλικ οπουδήποτε μέσα στην επιφάνεια την επιλέγει.
 *
 * **Λαβές (ADR-662 §13, από 2026-07-27):** μία ανά κορυφή περιγράμματος που αντιστοιχεί σε
 * survey point. Η επιφάνεια παραμένει derived — η λαβή **δεν** επεξεργάζεται το footprint,
 * γράφει στο survey point και το footprint ξαναπαράγεται από την TIN (μοντέλο Revit «Modify
 * Sub Elements»). Μέχρι τότε ο renderer επέστρεφε ρητά `[]`· άλλαξε το **συμβόλαιο**.
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
import { createVertexGrip } from './shared/grip-utils';
// ADR-662 §13 — το ΙΔΙΟ SSoT που τροφοδοτεί το interaction registry (ορατό ≡ πιάσιμο).
import { topoSurfaceGripsOf } from '../../systems/topography/topo-surface-grips';

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

  /**
   * ADR-662 §13 — μία **ορατή** λαβή ανά κορυφή περιγράμματος που αντιστοιχεί σε survey
   * point, από το **ΙΔΙΟ** `topoSurfaceVertexGrips` SSoT που τροφοδοτεί το interaction
   * registry (`computeDxfEntityGrips`) → ορατό ≡ πιάσιμο, χωρίς δυνατότητα απόκλισης.
   *
   * Η σειρά του array **είναι** ο `gripIndex` και στους δύο καταναλωτές· γι' αυτό και το
   * φιλτράρισμα των μη-επιλύσιμων (breakline) κορυφών ζει μέσα στο SSoT και όχι εδώ — αν
   * φιλτράραμε τοπικά, οι δείκτες θα ξέφευγαν και θα έσερνες άλλη κορυφή από αυτή που
   * έπιασες (η ίδια οικογένεια αστοχίας με το ADR-507 «visible ≠ pickable»).
   *
   * (Μέχρι 2026-07-27 εδώ επέστρεφε `[]` — «derived entity, καμία grip επεξεργασία».
   * Αυτό ήταν **ρητή απόφαση**, όχι bug· άλλαξε το συμβόλαιο, όχι η υλοποίηση.)
   */
  getGrips(entity: EntityModel): GripInfo[] {
    return topoSurfaceGripsOf(entity).map((g, gripIndex) =>
      createVertexGrip(entity.id, { x: g.point.x, y: g.point.y }, gripIndex),
    );
  }

  /** Fill hit-test — κλικ μέσα σε οποιοδήποτε ring επιλέγει την επιφάνεια (mirror hatch/image). */
  hitTest(entity: EntityModel, point: Point2D, _tolerance: number): boolean {
    if (!isTopoSurfaceEntity(entity as Entity)) return false;
    const e = entity as unknown as TopoSurfaceEntity;
    return e.footprint.some((ring) => ring.length >= 3 && isPointInPolygon(point, ring));
  }
}
