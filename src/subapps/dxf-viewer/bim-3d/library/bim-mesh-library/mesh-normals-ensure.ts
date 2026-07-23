/**
 * mesh-normals-ensure — ADR-686: εγγυάται vertex normals σε φορτωμένο imported/library mesh.
 *
 * ## Γιατί υπάρχει (μετρημένο, 2026-07-22)
 *
 * Ο `GLTFLoader` κρατά ΑΚΕΡΑΙΑ ό,τι έχει το αρχείο — αν το partner export (C4D → glTF)
 * ΔΕΝ κουβαλά `NORMAL` attribute, η γεωμετρία φτάνει ΧΩΡΙΣ normals. Ένα unlit ή emissive
 * embedded υλικό φαίνεται κανονικά (δεν χρειάζεται normals), ΑΛΛΑ μόλις εφαρμοστεί ένα
 * lit `MeshStandardMaterial` (ADR-686 user override χρώμα/υλικό, ή το ADR-683 preset
 * safety-net) η επιφάνεια δεν δέχεται φωτισμό → αποδίδεται **ΜΑΥΡΗ**. Το ίδιο υλικό βάφει
 * σωστά τις δομικές όψεις (που έχουν normals) — άρα η μόνη μεταβλητή είναι η γεωμετρία.
 *
 * Αυτός ο helper γεφυρώνει το κενό όπως κάθε big-player importer (Revit/C4D «recompute
 * normals on import»): υπολογίζει flat/smooth normals από τις θέσεις κορυφών **μόνο όταν
 * λείπουν**, ώστε γεωμετρία που ΗΔΗ κουβαλά authored normals (curated CC0 έπιπλα) να μένει
 * **ανέγγιχτη** (μηδέν παλινδρόμηση shading).
 *
 * Pure (three-only) → deterministic + unit-testable, μηδέν Storage / store deps. Καλείται
 * ΜΙΑ φορά στο asset-prep (`bim-mesh-cache.indexTemplate`), οπότε τα per-instance clones
 * (που ΜΟΙΡΑΖΟΝΤΑΙ τη geometry του template) κληρονομούν τα normals δωρεάν.
 *
 * @see ./bim-mesh-cache — ο caller (indexTemplate, μετά το recentre)
 * @see ../../converters/imported-mesh-material-enhance — ο lit override που απαιτεί normals
 * @see docs/centralized-systems/reference/adrs/ADR-686-imported-mesh-appearance-override.md
 */

import * as THREE from 'three';

/**
 * Διατρέχει τα mesh του `object` και υπολογίζει vertex normals **μόνο** σε όσα δεν έχουν
 * `normal` attribute. Idempotent (2η διέλευση = no-op) + no-op σε γεωμετρία με authored
 * normals. Μεταλλάσσει επί τόπου τη γεωμετρία του template (κοινή με τα clones → μία φορά).
 */
export function ensureMeshVertexNormals(object: THREE.Object3D): void {
  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    const geometry = child.geometry;
    if (!(geometry instanceof THREE.BufferGeometry)) return;
    // Έχει authored normals (glTF NORMAL / curated CC0) → σεβαστά, μηδέν recompute.
    if (geometry.getAttribute('normal')) return;
    // Χωρίς θέσεις κορυφών δεν υπάρχει τι να φωτιστεί (points/empty) → skip ήσυχα.
    if (!geometry.getAttribute('position')) return;
    geometry.computeVertexNormals();
  });
}
