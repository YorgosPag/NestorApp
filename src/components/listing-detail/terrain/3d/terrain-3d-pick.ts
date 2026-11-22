/**
 * @fileoverview **ΠΟΙΟ ΣΗΜΕΙΟ ΤΟΥ ΕΔΑΦΟΥΣ ΕΙΝΑΙ ΚΑΤΩ ΑΠΟ ΤΟΝ ΔΕΙΚΤΗ;** — raycast στην επιφάνεια, απάντηση σε κάτοψη
 *   (ADR-920 §14.10 Ε2).
 * @related `terrain-3d-engine.ts` (ο ιδιοκτήτης) · `@/lib/terrain/publication/terrain-3d-geometry` (`snapshotPlanOfScene`)
 * @module components/listing-detail/terrain/3d/terrain-3d-pick
 *
 * 🔑 **Μόνο η ΘΕΣΗ σε κάτοψη βγαίνει από εδώ**, ποτέ το υψόμετρο: το `y` της σκηνής είναι υπερβολή (1× / 2× / 3×). Το
 *   υψόμετρο το διαβάζει ο πυρήνας (`readTerrainAt`) στο ίδιο (x, y) — ίδιος αριθμός με την κάτοψη, σε κάθε υπερβολή
 *   (Mapbox `queryTerrainElevation({ exaggerated: false })`).
 * 🔑 **Μόνο η επιφάνεια**: ούτε το χώμα (τομή, όχι έδαφος), ούτε οι γραμμές. Το πρώτο χτύπημα είναι το ορατό.
 * ⚡ Ένα raycast ανά καρέ το πολύ (ο καλών κάνει throttle σε `requestAnimationFrame`). Σε ~60.000 τρίγωνα (το ανώτατο του
 *   στιγμιοτύπου) ένα raycast χωρίς BVH κοστίζει λίγα ms· αν μετρηθεί ακριβό, το επόμενο σκαλί είναι BVH, όχι αλλαγή εδώ.
 */

import * as THREE from 'three';

import { snapshotPlanOfScene } from '@/lib/terrain/publication/terrain-3d-geometry';

export type Terrain3dPick = (clientX: number, clientY: number) => { readonly x: number; readonly y: number } | null;

export function createTerrain3dPicker(canvas: HTMLCanvasElement, camera: THREE.Camera, surface: THREE.Object3D): Terrain3dPick {
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  return (clientX, clientY) => {
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const [hit] = raycaster.intersectObject(surface, false);
    return hit ? snapshotPlanOfScene(hit.point.x, hit.point.z) : null;
  };
}
