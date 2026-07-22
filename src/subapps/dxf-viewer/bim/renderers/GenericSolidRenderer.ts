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
import { polygonBboxHitTest, fillRingsEvenOdd, strokePolylinePaths, mapBimGrips } from './bim-polygon-render';
import { adaptFillTintForCanvas } from '../../config/adaptive-entity-color';
import type { EntityModel, GripInfo, RenderOptions, Point2D } from '../../rendering/types/Types';
import type { GenericSolidEntity } from '../entities/generic-solid/generic-solid-types';
import { computeGenericSolidPlanOutline } from '../entities/generic-solid/generic-solid-plan-outline';
import { getGenericSolidGrips } from '../entities/generic-solid/generic-solid-grips';
import { gripGlyphShape } from '../grips/grip-glyph-registry';
import { gripKindOf } from '../../hooks/grip-kinds';
import { RENDER_LINE_WIDTHS } from '../../config/text-rendering-config';
import { resolveBimPlanVisibility } from '../visibility/bim-plan-visibility';
import { getLayer } from '../../stores/LayerStore';

/** Παλέτα κάτοψης — indigo ταυτότητα (ίδια οικογένεια με το `BIM_CATEGORY_LINE_COLORS.genericSolid`). */
const GENERIC_SOLID_PALETTE = {
  stroke: '#7b6cff',
  fill: 'rgba(123, 108, 255, 0.14)',
  /** Εσωτερικές χαρακτηριστικές ακμές (πυραμίδα «Χ») — πιο αχνό από το περίγραμμα. */
  edge: 'rgba(123, 108, 255, 0.6)',
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

    // Πλήρες περίγραμμα κάτοψης: εξωτερικό όριο + τυχόν τρύπες (torus) + εσωτερικές ακμές (πυραμίδα «Χ»).
    const outline = computeGenericSolidPlanOutline(
      solid.params.shape,
      solid.params.position,
      solid.params.rotationDeg,
      solid.params.sceneUnits,
    );
    const toScreen = (p: Point2D): Point2D => this.worldToScreen(p);

    // Fill even-odd: η τρύπα του torus διαβάζεται ως πραγματικά άδειο κέντρο (όχι γεμάτος δίσκος).
    this.ctx.fillStyle = adaptFillTintForCanvas(GENERIC_SOLID_PALETTE.fill);
    fillRingsEvenOdd(this.ctx, toScreen, outline.rings);

    // Περίγραμμα κάθε δαχτυλιδιού (εξωτερικό + τρύπες = κλασικό plan σύμβολο δακτυλίου).
    this.ctx.strokeStyle = GENERIC_SOLID_PALETTE.stroke;
    this.ctx.lineWidth = RENDER_LINE_WIDTHS.NORMAL;
    for (const ring of outline.rings) {
      this.drawPolygonPath(ring);
      this.ctx.stroke();
    }

    // Εσωτερικές χαρακτηριστικές ακμές (top-view feature edges): οι 4 ακμές γωνία→κορυφή της πυραμίδας.
    if (outline.interiorEdges.length > 0) {
      this.ctx.strokeStyle = GENERIC_SOLID_PALETTE.edge;
      this.ctx.lineWidth = Math.max(1, RENDER_LINE_WIDTHS.NORMAL - 1);
      strokePolylinePaths(this.ctx, toScreen, outline.interiorEdges);
    }

    this.ctx.restore();
    this.finalizeRender(entity, options);
  }

  /**
   * Οι λαβές ΖΩΓΡΑΦΙΖΟΝΤΑΙ από εδώ (render path — `BaseEntityRenderer.getGrips`), με τον **ΙΔΙΟ**
   * SSoT `getGenericSolidGrips` που τροφοδοτεί το interaction path (`computeDxfEntityGrips` /
   * `GRIP_PRODUCERS['generic-solid']`) → drawn ≡ pickable, μηδέν απόκλιση (mirror `ImportedMeshRenderer`).
   * Πριν επέστρεφε `[]` (Φ2 placeholder) → οι λαβές υπολογίζονταν για interaction αλλά ΔΕΝ φαίνονταν.
   * move/rotation πάντα· 4 γωνίες για box· radial (ακτίνα/major/tube) για τα στρογγυλά (Φ4-A).
   */
  getGrips(entity: EntityModel): GripInfo[] {
    if (!isGenericSolid(entity)) return [];
    return mapBimGrips(
      getGenericSolidGrips(entity as unknown as GenericSolidEntity),
      (g) => gripGlyphShape(gripKindOf(g, 'generic-solid')),
    );
  }

  hitTest(entity: EntityModel, point: Point2D, tolerance: number): boolean {
    if (!isGenericSolid(entity)) return false;
    const solid = entity as unknown as GenericSolidEntity;
    const bb = solid.geometry?.bbox;
    if (!bb) return false;
    return polygonBboxHitTest(bb, solid.geometry.footprint.vertices, point, tolerance);
  }
}
