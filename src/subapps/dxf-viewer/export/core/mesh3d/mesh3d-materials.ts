/**
 * ADR-668 — export material table + Wavefront `.mtl` writer.
 *
 * **Τι πραγματικά κάνει ο three (μετρημένο, διορθώνει το PoC handoff):**
 * `OBJExporter.js:47` γράφει `usemtl` **μόνο αν `mesh.material.name`** είναι μη-κενό — και τα
 * υλικά του `MaterialCatalog3D` είναι **ανώνυμα**. Άρα σήμερα δεν γράφεται ούτε `usemtl`, ούτε
 * (ποτέ, σε καμία περίπτωση) `mtllib`. Δηλαδή το OBJ έβγαινε τελείως άχρωμο.
 *
 * **Γιατί clones και όχι `material.name = …` στα υπάρχοντα:** τα υλικά του catalog είναι
 * **singletons κοινά με το ζωντανό viewport**. Το να τους βάζαμε όνομα την ώρα του export θα
 * ήταν mutation κοινόχρηστου state (N.7.2). Η σκηνή του exporter είναι δική μας, οπότε δίνουμε
 * στα δικά μας meshes δικά μας, ονοματισμένα clones — μηδέν παρενέργεια στην εφαρμογή.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-668-mesh3d-export-obj-gltf.md
 */

import * as THREE from 'three';
import { resolveBimMeshIdentity } from './mesh3d-identity';
import { HIDDEN_NAME_PREFIX, sanitizeMeshNamePart } from './mesh3d-naming';

/** Ό,τι χρειάζεται το `.mtl` — κρατημένο σε δικό μας τύπο ώστε ο writer να είναι pure/testable. */
export interface ExportMaterialEntry {
  readonly name: string;
  readonly color: THREE.Color;
  readonly opacity: number;
  readonly transparent: boolean;
}

/**
 * Το diffuse χρώμα ενός υλικού, αν έχει (`MeshStandardMaterial`/`MeshBasicMaterial`/`Lambert`/
 * `Phong`… — όλα εκθέτουν `.color: THREE.Color`), αλλιώς null. Ο οπλισμός (ADR-463) είναι
 * `MeshBasicMaterial` crimson: χωρίς αυτό θα έπεφτε στο γκρι fallback και θα έχανε το χρώμα του.
 */
function materialColor(m: THREE.Material): THREE.Color | null {
  const c = (m as { color?: unknown }).color;
  return c instanceof THREE.Color ? c : null;
}

/** Σταθερό όνομα υλικού: το DNA matId αν υπάρχει, αλλιώς το χρώμα (ποτέ δύο υλικά με ίδιο όνομα). */
function resolveMaterialName(matId: string | null, material: THREE.Material): string {
  if (matId !== null) return sanitizeMeshNamePart(matId);
  const color = materialColor(material);
  return `mat_${color ? color.getHexString() : '808080'}`;
}

/**
 * Περνά τη σκηνή, δίνει σε κάθε mesh ένα **ονοματισμένο clone** του υλικού του και επιστρέφει
 * τον πίνακα υλικών για το `.mtl`. Ένα clone ανά μοναδικό όνομα (τα meshes το μοιράζονται),
 * ώστε το OBJ να γράψει `usemtl X` μία φορά ανά ομάδα και όχι ανά τρίγωνο.
 *
 * Multi-material meshes (array `material`) εξαιρούνται: ο `OBJExporter` γράφει ούτως ή άλλως
 * ένα `usemtl` ανά mesh, οπότε ένα ψεύτικο όνομα θα έλεγε ψέματα για το ποιο υλικό ισχύει.
 *
 * ADR-668 — ό,τι ήταν σβηστό στην οθόνη παίρνει **δικό του** `HIDDEN_…` υλικό με `d 0`
 * (τελείως διαφανές), ώστε να έρθει στο C4D αόρατο αντί να μπλοκάρει τη θέα. Κρατά το
 * **πραγματικό του χρώμα**: ο χρήστης ανεβάζει το `d` και το αντικείμενο επανέρχεται σωστά
 * χρωματισμένο — αν όλα τα κρυμμένα μοιράζονταν ένα υλικό, θα επανέρχονταν μονόχρωμα.
 */
export function assignExportMaterials(
  root: THREE.Object3D,
  hiddenEntityIds: ReadonlySet<string> = new Set(),
): ExportMaterialEntry[] {
  const table = new Map<string, ExportMaterialEntry>();
  const clones = new Map<string, THREE.Material>();

  root.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (mesh.isMesh !== true || Array.isArray(mesh.material)) return;

    const source = mesh.material;
    const { matId, bimId } = resolveBimMeshIdentity(mesh);
    const hidden = bimId !== null && hiddenEntityIds.has(bimId);
    const baseName = resolveMaterialName(matId, source);
    const name = hidden ? `${HIDDEN_NAME_PREFIX}_${baseName}` : baseName;

    let clone = clones.get(name);
    if (clone === undefined) {
      clone = source.clone();
      clone.name = name;
      if (hidden) {
        clone.transparent = true;
        clone.opacity = 0;
      }
      clones.set(name, clone);
      table.set(name, {
        name,
        color: materialColor(clone)?.clone() ?? new THREE.Color(0x808080),
        opacity: clone.opacity,
        transparent: clone.transparent,
      });
    }
    mesh.material = clone;
  });

  return [...table.values()];
}

/**
 * Wavefront `.mtl`. `Kd` = diffuse (το χρώμα που βλέπει ο χρήστης στο C4D), `d` = opacity.
 * Ο three δεν γράφει ΠΟΤΕ `.mtl` — αυτός ο writer είναι ο λόγος που το OBJ αποκτά χρώματα.
 */
export function writeMtl(entries: readonly ExportMaterialEntry[]): string {
  const lines: string[] = [
    '# Nestor — BIM material table (ADR-668)',
    `# ${entries.length} materials`,
    '',
  ];
  for (const e of entries) {
    lines.push(
      `newmtl ${e.name}`,
      `Kd ${e.color.r.toFixed(6)} ${e.color.g.toFixed(6)} ${e.color.b.toFixed(6)}`,
      `Ka 0.000000 0.000000 0.000000`,
      `Ks 0.000000 0.000000 0.000000`,
      `d ${(e.transparent ? e.opacity : 1).toFixed(6)}`,
      'illum 1',
      '',
    );
  }
  return lines.join('\n');
}
