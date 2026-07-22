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
import { drawMeshSilhouette, type MeshSilhouettePalette } from './mesh-silhouette-draw';
import {
  resolveImportedMaterialPreset,
  importedPresetHex,
  importedPresetRgba,
} from '../materials/imported-material-presets';
import { getImportedMeshGrips } from '../entities/imported-mesh/imported-mesh-grips';
import { gripGlyphShape } from '../grips/grip-glyph-registry';
import { gripKindOf } from '../../hooks/grip-kinds';

/**
 * Παλέτα κάτοψης — ουδέτερο γκρι-μπλε, **σκόπιμα διακριτό** από τις παλέτες των εγγενών BIM
 * στοιχείων: ο χρήστης πρέπει να βλέπει με μια ματιά τι είναι δικό του μοντέλο και τι ήρθε από έξω.
 */
const IMPORTED_MESH_PALETTE: MeshSilhouettePalette = {
  stroke: '#5b6b7a',
  fill: 'rgba(91, 107, 122, 0.14)',
  edge: 'rgba(91, 107, 122, 0.5)',
};

/** Ημιδιαφάνειες 2Δ σιλουέτας — καθρέφτης των alpha του ουδέτερου {@link IMPORTED_MESH_PALETTE}. */
const SILHOUETTE_FILL_ALPHA = 0.16;
const SILHOUETTE_EDGE_ALPHA = 0.5;

/**
 * ADR-683 Φ4 — παλέτα 2Δ σιλουέτας από το **όνομα υλικού** του κόμβου (dominant). Αν το όνομα
 * λύνεται σε PBR preset (μέταλλο/ύφασμα/δέρμα…), η κάτοψη παίρνει χρώμα υλικού αντί για ουδέτερο
 * γκρι — σχηματικός πλούτος Revit/ArchiCAD-style, ΙΔΙΟ SSoT με το 3Δ (`imported-material-presets`).
 * Άγνωστο/απόν όνομα → το ουδέτερο γκρι (σκόπιμα διακριτό «ήρθε απ' έξω»).
 */
function resolveImportedMeshPalette(sourceMaterialName?: string): MeshSilhouettePalette {
  const preset = resolveImportedMaterialPreset(sourceMaterialName);
  if (!preset) return IMPORTED_MESH_PALETTE;
  return {
    stroke: importedPresetHex(preset),
    fill: importedPresetRgba(preset, SILHOUETTE_FILL_ALPHA),
    edge: importedPresetRgba(preset, SILHOUETTE_EDGE_ALPHA),
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

    const { uploadId, nodeName, position, rotationDeg, sceneUnits, sourceMaterialName } = mesh.params;
    const assetId = importedMeshAssetId(uploadId, nodeName);
    const palette = resolveImportedMeshPalette(sourceMaterialName);
    const drew = drawMeshSilhouette({
      ctx: this.ctx,
      worldToScreen: (p) => this.worldToScreen(p),
      silhouette: bimMeshCache.getSilhouette(IMPORTED_MESH_CATEGORY, assetId),
      edges: bimMeshCache.getTopEdges(IMPORTED_MESH_CATEGORY, assetId),
      transform: { position, rotationDeg, sceneUnits: sceneUnits ?? 'mm' },
      palette,
      lineWidth: RENDER_LINE_WIDTHS.NORMAL,
    });

    if (!drew) {
      // Το ορθογώνιο του μετρημένου bbox — «εδώ είναι, το σχήμα έρχεται».
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
