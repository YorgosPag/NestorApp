/**
 * imported-mesh-wireframe — ADR-689 Φ2: το Visual Style «Συρμάτινο» στα ΕΙΣΑΓΟΜΕΝΑ πλέγματα.
 *
 * ## Γιατί υπάρχει (Giorgio 2026-07-24)
 *
 * Το Wireframe view style του καμβά κρύβει τις επιφάνειες (`faceMode:'none'`, ADR-446) και δείχνει
 * ακμές — αλλά **μόνο** για τα δομικά, που περνούν από `withFaceMode` + `attachEdgesProjection`. Τα
 * εισαγόμενα πλέγματα (glb/obj) έχουν **ξεχωριστό** δρόμο υλικών (embedded PBR, ADR-683) που δεν
 * αγγίζει κανένα από τα δύο → η καρέκλα έμενε **γεμάτη/χρωματιστή** στο Συρμάτινο (ενώ στο AutoCAD
 * φαίνονται όλα τα τριγωνάκια). Ο Giorgio ζήτησε **πλήρη triangulation, όπως AutoCAD**.
 *
 * ## Τι κάνει (μόνο στο Wireframe style — `faceMode:'none'`)
 *
 *   1. **Κρύβει τις επιφάνειες**: αντικαθιστά κάθε mesh material με ΑΠΟΚΛΕΙΣΤΙΚΗ invisible-face
 *      (ADR-665 `buildInvisibleFaceMaterial` — ΟΧΙ το shared singleton, ώστε το teardown να το κάνει
 *      dispose χωρίς να αγγίξει τα δομικά).
 *   2. **Προσθέτει πλήρες wireframe**: ΕΝΑ `LineSegments(WireframeGeometry)` ανά child mesh = κάθε
 *      τριγωνάκι ως γραμμή (ίδιο με το AutoCAD 2D Wireframe), x-ray (`depthTest:false`).
 *
 * Χρώμα γραμμών ανά background (mirror του `bim-three-edges`): σκούρο bg → ανοιχτό γκρι· ανοιχτό bg →
 * σχεδόν μαύρο. Στα υπόλοιπα styles = **no-op** (μηδέν regression στο shaded/realistic/hidden-line).
 *
 * Rebuild-on-change: το `use-bim3d-vg-resync` block (f) ξαναχτίζει τη σκηνή σε αλλαγή `visualStyle`,
 * οπότε αυτό ξανατρέχει· το `clearGroup` κάνει dispose τα overlays (children) αυτόματα.
 *
 * @see ./imported-mesh-to-three — ο caller (μετά το `applyImportedMeshMaterials`)
 * @see ../materials/face-mode-materials — `buildInvisibleFaceMaterial` (ADR-665 exclusive instance)
 * @see ./bim-three-edges — το δομικό αντίστοιχο (feature edges, ΟΧΙ full triangulation)
 */

import * as THREE from 'three';
import { useBimRenderSettingsStore } from '../../state/bim-render-settings-store';
import { buildInvisibleFaceMaterial } from '../materials/face-mode-materials';

/** Χρώμα wireframe σε σκούρο background (ανοιχτό γκρι — διαβάζεται όπως το AutoCAD white-on-dark). */
const WIRE_COLOR_DARK_BG = 0xd0d0d0;
/** Χρώμα wireframe σε ανοιχτό background (σχεδόν μαύρο — mirror του `BIM_3D_EDGE_COLOR`). */
const WIRE_COLOR_LIGHT_BG = 0x1a1a1a;
/** Τα wireframe lines ζωγραφίζονται πάνω από τις (κρυμμένες) επιφάνειες. */
const WIRE_RENDER_ORDER = 2;

/**
 * Εφαρμόζει το Wireframe view style σε ένα εισαγόμενο πλέγμα (full triangulation, όπως AutoCAD).
 * No-op σε κάθε άλλο view style (`faceMode !== 'none'`).
 */
export function attachImportedMeshWireframe(object: THREE.Object3D): void {
  const state = useBimRenderSettingsStore.getState();
  if (state.faceMode !== 'none') return;
  const color = state.backgroundMode === 'dark' ? WIRE_COLOR_DARK_BG : WIRE_COLOR_LIGHT_BG;

  // Μάζεψε ΠΡΩΤΑ τα meshes — το `traverse` δεν πρέπει να «δει» τα LineSegments που προσθέτουμε.
  const meshes: THREE.Mesh[] = [];
  object.traverse((child) => { if (child instanceof THREE.Mesh) meshes.push(child); });

  for (const mesh of meshes) {
    if (!mesh.geometry) continue;
    // (1) Κρύψε τις επιφάνειες (exclusive instance → ασφαλές dispose, ADR-665).
    mesh.material = buildInvisibleFaceMaterial();
    // (2) Κάθε τριγωνάκι ως γραμμή (x-ray — οι επιφάνειες είναι κρυμμένες).
    const wire = new THREE.LineSegments(
      new THREE.WireframeGeometry(mesh.geometry),
      new THREE.LineBasicMaterial({ color, depthTest: false, depthWrite: false, transparent: true }),
    );
    wire.renderOrder = WIRE_RENDER_ORDER;
    wire.userData['importedMeshWireframe'] = true;
    mesh.add(wire);
  }
}
