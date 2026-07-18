/**
 * ADR-668 — αφαίρεση των screen-space DECORATIONS από το export tree.
 *
 * `LineSegments2 extends Mesh` (και `InstancedMesh extends Mesh`), οπότε ΚΑΘΕ `isMesh` φίλτρο του
 * export pipeline (naming/materials/count) **ΚΑΙ** οι ίδιοι οι three `OBJExporter`/`GLTFExporter`
 * αντιμετωπίζουν ένα BIM edge overlay (ADR-375 `buildEdgeOverlay`, tagged `userData.bimEdgeOverlay`)
 * σαν πραγματικό σώμα. Στο C4D αυτό εμφανίστηκε ως εκφυλισμένο, συμπίπτον δίδυμο ανά τοίχο/κολώνα
 * (`…_2`, Size Z=0) — καθαρό σκουπίδι: ένα edge overlay είναι viewport affordance, ΠΟΤΕ γεωμετρία
 * μοντέλου (Revit/ArchiCAD δεν εξάγουν τις screen-space ακμές τους ως solids).
 *
 * Οι serialisers είναι three-owned (δεν βάζουμε φίλτρο μέσα τους), άρα η ΜΟΝΗ σωστή διόρθωση είναι
 * να αφαιρεθούν τα decoration nodes από το δέντρο πριν τη σειριοποίηση. Disposed κατά την αφαίρεση,
 * ώστε να απελευθερωθεί το resolution-store subscription του overlay (το custom `geometry.dispose`
 * του τρέχει το unsubscribe) — αλλιώς κάθε εξαγωγή θα άφηνε listeners πίσω της.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-668-mesh3d-export-obj-gltf.md §4.7
 */
import type * as THREE from 'three';

/**
 * Screen-space decoration; ΠΟΤΕ εξαγώγιμο solid. Ο ρητός marker (`bimEdgeOverlay`) καλύπτει τα BIM
 * edge overlays· τα line-primitive flags πιάνουν κάθε άλλη γραμμή/ακμή που θα κληρονομούσε `isMesh`.
 */
function isExportDecoration(node: THREE.Object3D): boolean {
  return (
    node.userData['bimEdgeOverlay'] === true ||
    (node as { isLine?: boolean }).isLine === true ||
    (node as { isLineSegments2?: boolean }).isLineSegments2 === true
  );
}

function disposeMaterial(material: THREE.Material | THREE.Material[]): void {
  if (Array.isArray(material)) material.forEach((m) => m.dispose());
  else material.dispose();
}

/**
 * Αφαιρεί (και κάνει dispose) κάθε screen-space decoration κάτω από το `root`.
 * @returns πλήθος decorations που αφαιρέθηκαν
 */
export function stripExportDecorations(root: THREE.Object3D): number {
  // Συλλογή ΠΡΩΤΑ (μη μεταλλάσσεις το δέντρο μέσα σε traverse).
  const doomed: THREE.Object3D[] = [];
  root.traverse((node) => {
    if (isExportDecoration(node)) doomed.push(node);
  });

  for (const node of doomed) {
    node.parent?.remove(node);
    const mesh = node as THREE.Mesh;
    // Το custom `geometry.dispose` του overlay τρέχει το resolution-store unsubscribe (no leak).
    mesh.geometry?.dispose?.();
    if (mesh.material) disposeMaterial(mesh.material);
  }
  return doomed.length;
}
