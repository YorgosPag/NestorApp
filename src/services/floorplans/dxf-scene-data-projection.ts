/**
 * 🏢 SSoT — προβολή `SceneModel` (DXF Viewer) → `DxfSceneData` (συμβόλαιο `files`).
 *
 * ## Γιατί υπάρχει
 *
 * Το ίδιο δεκάγραμμο μπλοκ ζούσε αυτούσιο σε **τρία** σημεία — client hook, client service
 * και **server route** — και τα τρία έκαναν ακριβώς την ίδια μετάφραση: id-keyed layers →
 * name-keyed, `layerId` → `layer` όνομα, bounds ως έχουν. Το token-based `jscpd` (CHECK 3.28,
 * ADR-584) τα βλέπει ως clones ανεξαρτήτως ονομάτων μεταβλητών· το name-based `ssot:discover`
 * ήταν τυφλό, γιατί οι τρεις τοπικές μεταβλητές λέγονταν αλλιώς.
 *
 * Ο κίνδυνος δεν είναι αισθητικός: αν κάποτε αλλάξει ο κανόνας ονοματοδοσίας layer (π.χ. το
 * fallback `'0'`), οι τρεις αντιγραφές θα αποκλίνουν **σιωπηλά** και ο viewer θα δείχνει άλλα
 * layers από τον server. Μία συνάρτηση ⇒ μία απάντηση.
 *
 * Καθαρή συνάρτηση, μηδέν SDK, μηδέν React — τρέχει και στον browser και στο Node route.
 *
 * @module services/floorplans/dxf-scene-data-projection
 */

import type { SceneModel } from '@/subapps/dxf-viewer/types/scene';
import type {
  DxfSceneData,
  DxfSceneEntity,
  DxfSceneLayer,
} from '@/types/file-record';

/**
 * Το layer name ενός entity, με το ιστορικό fallback στο DXF default layer `'0'`.
 * Ζει χωριστά ώστε ο κανόνας fallback να είναι **ένας** και ονομασμένος.
 */
function layerNameOf(scene: SceneModel, layerId: string): string {
  return scene.layersById[layerId]?.name ?? '0';
}

/**
 * Μεταφράζει μια σκηνή του DXF Viewer στο σχήμα που αποθηκεύεται/σερβίρεται ως
 * `FileRecord.processedData.scene`.
 *
 * ⚠️ Οι μονάδες ΔΕΝ μεταφράζονται εδώ: μετά το ADR-462 η γεωμετρία είναι ήδη canonical mm
 * από το parse (ADR-716 Φ5 — η ρητή ετυμηγορία του μηχανικού εφαρμόζεται εκεί, μία φορά).
 */
export function toDxfSceneData(scene: SceneModel): DxfSceneData {
  return {
    entities: scene.entities.map((entity) => ({
      ...entity,
      layer: layerNameOf(scene, entity.layerId),
    } as unknown as DxfSceneEntity)),
    layers: Object.fromEntries(
      Object.values(scene.layersById).map((l) => [l.name, l]),
    ) as Record<string, DxfSceneLayer>,
    bounds: scene.bounds,
  };
}
