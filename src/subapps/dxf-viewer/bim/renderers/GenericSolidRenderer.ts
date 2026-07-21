/**
 * GenericSolidRenderer — ADR-684 Φ2 (2Δ κάτοψη παραμετρικού στερεού).
 *
 * Το στερεό είναι πλήρης πολίτης: σχεδιάζεται στην κάτοψη ως **footprint outline** (το ορθογώνιο του
 * bbox, όπως το fallback του `ImportedMeshRenderer`). Δεν υπάρχει mesh silhouette να διαβαστεί —
 * η γεωμετρία είναι procedural, όχι φορτωμένο glTF· το footprint δίνεται έτοιμο από το
 * `computeGenericSolidGeometry`.
 *
 * ADR-040 συμμόρφωση micro-leaf: καθαρή κλάση renderer με **ΜΗΔΕΝ** συνδρομές.
 *
 * @see ./ImportedMeshRenderer — ο αδελφός (mesh-based, με silhouette)
 * @see docs/centralized-systems/reference/adrs/ADR-684-generic-solid-primitive-entity.md
 */

import { BimFootprintRenderer } from './bim-footprint-renderer';
import { polygonBboxHitTest } from './bim-polygon-render';
import { adaptFillTintForCanvas } from '../../config/adaptive-entity-color';
import type { EntityModel, GripInfo, RenderOptions, Point2D } from '../../rendering/types/Types';
import type { GenericSolidEntity } from '../entities/generic-solid/generic-solid-types';
import { computeGenericSolidPlanOutline } from '../entities/generic-solid/generic-solid-plan-outline';
import { RENDER_LINE_WIDTHS } from '../../config/text-rendering-config';
import { resolveBimPlanVisibility } from '../visibility/bim-plan-visibility';
import { getLayer } from '../../stores/LayerStore';

/** Παλέτα κάτοψης — indigo ταυτότητα (ίδια οικογένεια με το `BIM_CATEGORY_LINE_COLORS.genericSolid`). */
const GENERIC_SOLID_PALETTE = {
  stroke: '#7b6cff',
  fill: 'rgba(123, 108, 255, 0.14)',
} as const;

/** Type guard — το `EntityModel` είναι δομικό, οπότε ελέγχουμε τον διακριτή τύπου. */
function isGenericSolid(entity: EntityModel): boolean {
  return entity.type === 'generic-solid';
}

export class GenericSolidRenderer extends BimFootprintRenderer {
  render(entity: EntityModel, options: RenderOptions = {}): void {
    if (!isGenericSolid(entity)) return;
    const solid = entity as unknown as GenericSolidEntity;

    // ADR-382/405 — ενιαίος έλεγχος ορατότητας (V/G + Layer + Floor + Building + Discipline).
    const layer = solid.layerId ? getLayer(solid.layerId) : null;
    if (
      !resolveBimPlanVisibility(
        { category: 'generic-solid', layerId: solid.layerId, discipline: solid.discipline },
        layer,
      )
    ) {
      return;
    }

    if (!solid.geometry || !solid.params) return;
    const verts = solid.geometry.footprint.vertices;
    if (verts.length < 3) return;

    this.beginPhasedBodyRender(entity, verts, options);

    this.ctx.fillStyle = adaptFillTintForCanvas(GENERIC_SOLID_PALETTE.fill);
    this.drawPolygonPath(verts);
    this.ctx.fill();
    this.ctx.strokeStyle = GENERIC_SOLID_PALETTE.stroke;
    this.ctx.lineWidth = RENDER_LINE_WIDTHS.NORMAL;
    this.drawPolygonPath(verts);
    this.ctx.stroke();

    // Εσωτερικά δαχτυλίδια (τρύπα του torus): δύο ομόκεντροι κύκλοι = κλασικό plan σύμβολο.
    // Το `footprint` (outer) καλύπτει τα υπόλοιπα σχήματα· μόνο ο torus έχει inner ring.
    if (solid.params.shape.kind === 'torus') {
      const rings = computeGenericSolidPlanOutline(
        solid.params.shape,
        solid.params.position,
        solid.params.rotationDeg,
        solid.params.sceneUnits,
      ).rings;
      for (let i = 1; i < rings.length; i++) {
        this.drawPolygonPath(rings[i]);
        this.ctx.stroke();
      }
    }

    this.ctx.restore();
    this.finalizeRender(entity, options);
  }

  /** Φ2 — καμία λαβή ακόμη (move/rotate/reshape έρχονται στη Φ3 μαζί με το grip wiring). */
  getGrips(_entity: EntityModel): GripInfo[] {
    return [];
  }

  hitTest(entity: EntityModel, point: Point2D, tolerance: number): boolean {
    if (!isGenericSolid(entity)) return false;
    const solid = entity as unknown as GenericSolidEntity;
    const bb = solid.geometry?.bbox;
    if (!bb) return false;
    return polygonBboxHitTest(bb, solid.geometry.footprint.vertices, point, tolerance);
  }
}
