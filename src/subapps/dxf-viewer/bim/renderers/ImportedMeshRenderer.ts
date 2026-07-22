/**
 * ImportedMeshRenderer — ADR-683 Φ3 (2Δ κάτοψη εισαγόμενου πλέγματος).
 *
 * Ο Giorgio ζήτησε ρητά τα εισαγόμενα να **σχεδιάζονται στην κάτοψη** (§10.1) — να είναι πλήρεις
 * πολίτες, όχι 3Δ-only διακοσμητικά. Αυτός ο renderer το κάνει, επαναχρησιμοποιώντας **ακέραιο** τον
 * μηχανισμό περιγράμματος του ADR-411: το `bimMeshCache` παράγει top-view silhouette + εσωτερικές
 * ακμές από το **πραγματικό** πλέγμα, και ο κοινός `drawMeshSilhouette` τα ζωγραφίζει.
 *
 * **Δύο καταστάσεις, και οι δύο χρήσιμες:**
 *  1. Πριν φορτώσει το `.glb` (ή αν αποτύχει) → ορθογώνιο του **μετρημένου** bbox. Ο χρήστης βλέπει
 *     αμέσως πού βρίσκεται το αντικείμενο, χωρίς να περιμένει δίκτυο.
 *  2. Μόλις φορτώσει → το ακριβές περίγραμμα. Το `bumpMeshAssetVersion()` + `markAllCanvasDirty()`
 *     του cache προκαλεί το repaint μόνο του — καμία συνδρομή εδώ.
 *
 * ⚠️ **Καμία διαγώνιος** στο fallback, σε αντίθεση με το `FurnitureRenderer`: εκείνο το γλυφό
 * σημαίνει «έπιπλο» σε μια κάτοψη. Εδώ το ορθογώνιο σημαίνει «δεν ξέρω ακόμη το σχήμα» — ένα
 * διακοσμητικό γλυφό θα ισχυριζόταν σημασιολογία που δεν έχουμε (§3).
 *
 * ADR-040 συμμόρφωση micro-leaf: καθαρή κλάση renderer με **ΜΗΔΕΝ** συνδρομές.
 *
 * @see ./mesh-silhouette-draw — ο κοινός ζωγράφος περιγράμματος (ADR-411)
 * @see ./FurnitureRenderer — ο αδελφός με catalog-driven mesh
 * @see docs/centralized-systems/reference/adrs/ADR-683-bim-collaboration-roundtrip.md §10.1
 */

import { BimFootprintRenderer } from './bim-footprint-renderer';
import { polygonBboxHitTest, mapBimGrips } from './bim-polygon-render';
import { adaptFillTintForCanvas } from '../../config/adaptive-entity-color';
import type { EntityModel, GripInfo, RenderOptions, Point2D } from '../../rendering/types/Types';
import type { ImportedMeshEntity } from '../entities/imported-mesh/imported-mesh-types';
import {
  IMPORTED_MESH_CATEGORY,
  importedMeshAssetId,
} from '../entities/imported-mesh/imported-mesh-types';
import { RENDER_LINE_WIDTHS } from '../../config/text-rendering-config';
import { resolveBimPlanVisibility } from '../visibility/bim-plan-visibility';
import { getLayer } from '../../stores/LayerStore';
import { bimMeshCache } from '../../bim-3d/library/bim-mesh-library/bim-mesh-cache';
import {
  drawMeshSilhouette,
  drawMeshContourFill,
  drawMeshSlotSilhouettes,
  type MeshSilhouettePalette,
} from './mesh-silhouette-draw';
// ADR-686 — user override (χρώμα/υλικό) πάνω από το ουδέτερο γκρι, ΙΔΙΟ SSoT με το 2D plan fill + το 3D.
import { faceAppearanceColorHex } from '../utils/face-appearance-color';
import { slotFaceKey, BASE_FACE_KEY, type FaceAppearanceMap } from '../types/face-appearance-types';
import { hexToRgba } from '../../config/color-math';
import { getImportedMeshGrips } from '../entities/imported-mesh/imported-mesh-grips';
import { gripGlyphShape } from '../grips/grip-glyph-registry';
import { gripKindOf } from '../../hooks/grip-kinds';

/**
 * Παλέτα κάτοψης — ουδέτερο γκρι-μπλε, **σκόπιμα διακριτό** από τις παλέτες των εγγενών BIM
 * στοιχείων: ο χρήστης πρέπει να βλέπει με μια ματιά τι είναι δικό του μοντέλο και τι ήρθε από έξω.
 */
const IMPORTED_MESH_PALETTE: MeshSilhouettePalette = {
  stroke: '#5b6b7a',
  fill: 'rgba(91, 107, 122, 0.28)',
  edge: 'rgba(91, 107, 122, 0.5)',
};

/** Ημιδιαφάνειες 2Δ — καθρέφτης των alpha του ουδέτερου {@link IMPORTED_MESH_PALETTE} (ADR-686 override). */
const SILHOUETTE_FILL_ALPHA = 0.28;
const SILHOUETTE_EDGE_ALPHA = 0.5;

/**
 * ADR-683 §10.9.3 (Giorgio 2026-07-22, «Β»): η 2Δ κάτοψη των εισαγόμενων βάφεται **ομοιόμορφα** με το
 * ουδέτερο γκρι {@link IMPORTED_MESH_PALETTE} — ΟΧΙ πλέον χρώμα-ανά-υλικό (Revit-style poché). Απόφαση
 * μόνο για το 2Δ· το 3Δ κρατά τα πραγματικά υλικά (`imported-material-presets`, αμετάβλητο).
 *
 * ADR-686 — ο **user override** εξαιρείται: αν ο χρήστης έβαψε ρητά αυτό το slot (`slot:${name}`) ή base
 * (`'*'`), αυτό το χρώμα νικά (deliberate action, όχι auto poché). Αλλιώς → ουδέτερο γκρι.
 */
function slotPaletteWithOverride(
  materialName: string | undefined,
  faceAppearance: FaceAppearanceMap | undefined,
): MeshSilhouettePalette {
  const override = faceAppearance
    ? faceAppearance[slotFaceKey(materialName ?? '')] ?? faceAppearance[BASE_FACE_KEY]
    : undefined;
  const hex = override ? faceAppearanceColorHex(override) : null;
  if (!hex) return IMPORTED_MESH_PALETTE;
  return {
    stroke: hex,
    fill: hexToRgba(hex, SILHOUETTE_FILL_ALPHA),
    edge: hexToRgba(hex, SILHOUETTE_EDGE_ALPHA),
  };
}

/** Type guard — το `EntityModel` είναι δομικό, οπότε ελέγχουμε τον διακριτή τύπου. */
function isImportedMeshEntity(entity: EntityModel): boolean {
  return entity.type === 'imported-mesh';
}

export class ImportedMeshRenderer extends BimFootprintRenderer {
  render(entity: EntityModel, options: RenderOptions = {}): void {
    if (!isImportedMeshEntity(entity)) return;
    const mesh = entity as unknown as ImportedMeshEntity;

    // ADR-382/405 — ενιαίος έλεγχος ορατότητας (V/G + Layer + Floor + Building + Discipline).
    const layer = mesh.layerId ? getLayer(mesh.layerId) : null;
    if (
      !resolveBimPlanVisibility(
        { category: IMPORTED_MESH_CATEGORY, layerId: mesh.layerId, discipline: mesh.discipline },
        layer,
      )
    ) {
      return;
    }

    if (!mesh.geometry || !mesh.params) return;
    const verts = mesh.geometry.footprint.vertices;
    if (verts.length < 3) return;

    this.beginPhasedBodyRender(entity, verts, options);

    const { uploadId, nodeName } = mesh.params;
    const assetId = importedMeshAssetId(uploadId, nodeName);

    if (!this.drawImportedSilhouette(mesh, assetId)) {
      // Το ορθογώνιο του μετρημένου bbox — «εδώ είναι, το σχήμα έρχεται».
      const palette = slotPaletteWithOverride(mesh.params.sourceMaterialName, mesh.faceAppearance);
      this.ctx.fillStyle = adaptFillTintForCanvas(palette.fill);
      this.drawPolygonPath(verts);
      this.ctx.fill();
      this.ctx.strokeStyle = palette.stroke;
      this.ctx.lineWidth = RENDER_LINE_WIDTHS.NORMAL;
      this.drawPolygonPath(verts);
      this.ctx.stroke();
    }

    this.ctx.restore();
    this.finalizeRender(entity, options);
  }

  /**
   * Τριπλό fallback (πρώτο που πετυχαίνει κερδίζει):
   *  1. **ADR-683 Φ5 per-slot poché** — multi-material κόμβος (βάση=μέταλλο, κάθισμα=πλέγμα): κάθε slot
   *     δικό του χρώμα. (Για single-material imports = null → επόμενο.)
   *  2. **ADR-683 §10.9 contour fill** — cached, simplified, multi-component + hole-aware περίγραμμα
   *     (raster placeholder → exact worker union, §10.9.2), φθηνό fill σε κάθε zoom. **Το κύριο μονοπάτι**.
   *  3. **raster silhouette** — robust fallback αν λείπουν τα fill contours.
   *  4. `false` → ο caller βάφει το ορθογώνιο του bbox.
   * Όλα τα μονοπάτια βάφουν fill + **ίδιο** outline stroke + feature edges → ομοιόμορφη εμφάνιση. Το χρώμα
   * βγαίνει από τον ΙΔΙΟ SSoT (`slotPaletteWithOverride`) με το 3Δ (override → preset → ουδέτερο).
   */
  private drawImportedSilhouette(mesh: ImportedMeshEntity, assetId: string): boolean {
    const { position, rotationDeg, sceneUnits, sourceMaterialName } = mesh.params;
    const transform = { position, rotationDeg, sceneUnits: sceneUnits ?? 'mm' } as const;
    const worldToScreen = (p: Point2D): Point2D => this.worldToScreen(p);
    const appearance = mesh.faceAppearance; // ADR-686 — user override per slot / base.
    const edges = bimMeshCache.getTopEdges(IMPORTED_MESH_CATEGORY, assetId);
    const palette = slotPaletteWithOverride(sourceMaterialName, appearance);

    const slots = bimMeshCache.getSlotSilhouettes(IMPORTED_MESH_CATEGORY, assetId);
    if (
      slots &&
      drawMeshSlotSilhouettes({
        ctx: this.ctx,
        worldToScreen,
        slots: slots.map((s) => ({
          contours: s.contours,
          palette: slotPaletteWithOverride(s.materialName ?? undefined, appearance),
        })),
        transform,
        lineWidth: RENDER_LINE_WIDTHS.NORMAL,
      })
    ) {
      return true;
    }

    if (
      drawMeshContourFill({
        ctx: this.ctx,
        worldToScreen,
        contours: bimMeshCache.getFillContours(IMPORTED_MESH_CATEGORY, assetId),
        edges,
        transform,
        palette,
        lineWidth: RENDER_LINE_WIDTHS.NORMAL,
      })
    ) {
      return true;
    }

    return drawMeshSilhouette({
      ctx: this.ctx,
      worldToScreen,
      silhouette: bimMeshCache.getSilhouette(IMPORTED_MESH_CATEGORY, assetId),
      edges,
      transform,
      palette,
      lineWidth: RENDER_LINE_WIDTHS.NORMAL,
    });
  }

  /**
   * **Δύο** λαβές: MOVE + ROTATION. Καμία λαβή σχήματος — το όριο του §3 δηλώνεται στον χρήστη
   * μέσω της απουσίας τους (§10.1: «τα εισαγόμενα δείχνουν λαβές θέσης/στροφής, ποτέ σχήματος»).
   */
  getGrips(entity: EntityModel): GripInfo[] {
    if (!isImportedMeshEntity(entity)) return [];
    return mapBimGrips(
      getImportedMeshGrips(entity as unknown as ImportedMeshEntity),
      (g) => gripGlyphShape(gripKindOf(g, 'imported-mesh')),
    );
  }

  hitTest(entity: EntityModel, point: Point2D, tolerance: number): boolean {
    if (!isImportedMeshEntity(entity)) return false;
    const mesh = entity as unknown as ImportedMeshEntity;
    const bb = mesh.geometry?.bbox;
    if (!bb) return false;
    return polygonBboxHitTest(bb, mesh.geometry.footprint.vertices, point, tolerance);
  }
}
