/**
 * gltf-addressable-nodes — SSoT: **ποιοι κόμβοι** ενός φορτωμένου glTF δέντρου είναι
 * διευθυνσιοδοτήσιμοι (ADR-683 §mesh-load-nesting).
 *
 * ## Γιατί υπάρχει — οι δύο άξονες του linked-model ΔΕΝ επιτρέπεται να αποκλίνουν
 *
 * Ένα εισαγόμενο `.glb` περνά από **δύο** ανεξάρτητες διαδρομές που πρέπει να «δουν» **ακριβώς τους
 * ίδιους** κόμβους, με **ακριβώς τα ίδια** ονόματα:
 *
 *   1. **Parse (import):** `collectGltfObjects` (`io/mesh3d-roundtrip/gltf-scene-parse`) παράγει ΕΝΑ
 *      record ανά κόμβο· το `objectName` γίνεται το `nodeName` της οντότητας → κλειδί `<uploadId>#<node>`.
 *   2. **Index (cache):** `indexBundleNodes` (`bim-mesh-cache`) σπάει το φορτωμένο αρχείο σε ΕΝΑ template
 *      ανά κόμβο, με το **ίδιο** κλειδί, ώστε ο 3Δ/2Δ renderer να βρει το πλέγμα.
 *
 * Αν οι δύο περνούσαν από **διαφορετικό** traversal (π.χ. ο parser deep `root.traverse`, ο cache
 * shallow `scene.children`), τότε ένας nested κόμβος θα αποκτούσε `nodeName` από τον parser αλλά **δεν**
 * θα ευρετηριαζόταν ποτέ από τον cache → το πλέγμα δεν βρίσκεται → μόνιμο placeholder κουτί, **ακόμη και
 * με σωστό URL**. Αυτό ήταν το §mesh-load-nesting bug: parser deep, index shallow. Η λύση είναι **ΕΝΑΣ**
 * walker, εδώ, που καταναλώνουν **και** οι δύο.
 *
 * ## Πού ζει και γιατί (layering)
 *
 * Ουδέτερο σημείο (`bim-3d/scene`) που μπορούν να importουν **και** ο parser (io/) **και** ο cache
 * (bim-3d/): η υπάρχουσα κατεύθυνση είναι io → bim-3d (ο parser ήδη importει `finiteBox3FromObject`
 * από εδώ). Να ζούσε στο io/, ο cache θα δημιουργούσε **κύκλο** io ↔ bim-3d.
 *
 * Pure (three-only) → deterministic + unit-testable.
 *
 * @see ../../io/mesh3d-roundtrip/gltf-scene-parse — `collectGltfObjects` (record ανά κόμβο)
 * @see ../library/bim-mesh-library/bim-mesh-cache — `indexBundleNodes` (template ανά κόμβο)
 * @see docs/centralized-systems/reference/adrs/ADR-683-bim-collaboration-roundtrip.md §11 (§mesh-load-nesting)
 */

import * as THREE from 'three';

/**
 * ADR-678 Φ3 — η αρίθμηση όψεων (`faceKeyByMaterialIndex`) όπως ταξιδεύει **node-level** στο glTF.
 * Ένα node με έγκυρο πίνακα strings είναι per-face βαμμένο solid: αντιμετωπίζεται ως **ΕΝΑ**
 * διευθυνσιοδοτήσιμο αντικείμενο, και τα per-primitive children του **δεν** μετρώνται ξεχωριστά.
 * `null` όταν το node δεν είναι faced (legacy single-material) ή το πεδίο δεν είναι έγκυρος πίνακας.
 *
 * SSoT για το ίδιο ερώτημα και στις δύο διαδρομές (parse + index) — γι' αυτό ζει εδώ, όχι στον parser.
 */
export function readGltfFaceKeys(node: THREE.Object3D | null | undefined): readonly string[] | null {
  const raw = node?.userData?.['faceKeyByMaterialIndex'];
  if (!Array.isArray(raw) || raw.length === 0) return null;
  return raw.every((k) => typeof k === 'string') ? (raw as string[]) : null;
}

/**
 * Οι διευθυνσιοδοτήσιμοι κόμβοι ενός φορτωμένου glTF δέντρου, σε **σειρά traversal** (σταθερή). Το
 * όνομα κάθε κόμβου είναι το `object.name` — ενδέχεται κενό για ανώνυμα meshes (κρατιούνται· ο parser
 * τα ρίχνει στα «χωρίς αντιστοίχιση», ο cache τα παραλείπει από την ευρετηρίαση).
 *
 * Ο κανόνας ταυτίζεται bit-for-bit με τον παλιό `collectGltfObjects.traverse`:
 *  - node με faceKeys → διευθυνσιοδοτήσιμο (τα children του είναι δικά του primitives, όχι κόμβοι)·
 *  - αλλιώς κάθε `Mesh` του οποίου ο γονέας **δεν** είναι faced → διευθυνσιοδοτήσιμο·
 *  - non-mesh nodes (φώτα/κάμερες/κενά groups) αγνοούνται.
 */
export function collectAddressableGltfNodes(root: THREE.Object3D): THREE.Object3D[] {
  const nodes: THREE.Object3D[] = [];
  root.traverse((node) => {
    if (readGltfFaceKeys(node)) {
      nodes.push(node); // faceKeys node = ΕΝΑ αντικείμενο· τα primitive children του ανήκουν σε αυτό
      return;
    }
    const mesh = node as THREE.Mesh;
    if (mesh.isMesh !== true) return;
    if (readGltfFaceKeys(mesh.parent) !== null) return; // per-face child — ανήκει ήδη στο faced node
    nodes.push(mesh);
  });
  return nodes;
}
