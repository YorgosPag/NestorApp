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
 * Ονοματίζει ΕΝΑ υλικό (single-material mesh Ή στοιχείο array): dedup ονόματος, ονοματισμένο clone,
 * καταχώρηση στο `table`. Επιστρέφει το κοινό clone (τα meshes/όψεις με ίδιο όνομα το μοιράζονται
 * ⇒ ένα `usemtl`/primitive ανά μοναδικό υλικό, όχι ανά τρίγωνο).
 *
 * ADR-668 — κρυμμένο υλικό → `HIDDEN_…` clone με `d 0` (τελείως διαφανές) που κρατά το **πραγματικό**
 * του χρώμα, ώστε να επανέρχεται σωστά χρωματισμένο όταν ο χρήστης ανεβάσει το `d` στο C4D.
 */
function registerNamedMaterial(
  source: THREE.Material,
  matId: string | null,
  hidden: boolean,
  clones: Map<string, THREE.Material>,
  table: Map<string, ExportMaterialEntry>,
): THREE.Material {
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
  return clone;
}

/**
 * Περνά τη σκηνή, δίνει σε κάθε mesh **ονοματισμένα clones** των υλικών του και επιστρέφει τον
 * πίνακα υλικών για το `.mtl` + το manifest baseline. Ένα clone ανά μοναδικό όνομα.
 *
 * **Multi-material (per-face, ADR-539/678 Φ3):** ΚΑΘΕ όψη ονοματίζεται χωριστά — **colour-based**
 * (`mat_<hex6>`), γιατί το `matId` είναι ανά-στοιχείο και δεν ξεχωρίζει όψεις. Ομοιόμορφη βαφή →
 * όλες οι όψεις ίδιο όνομα → dedup σε ΕΝΑ υλικό· per-face-varied → ξεχωριστά ονόματα. Το glTF τα
 * εξάγει ως named per-primitive υλικά → ο συνεργάτης βάφει ανά όψη και το round-trip επιστρέφει ανά
 * όψη (η αρίθμηση όψεων ταξιδεύει αυτούσια στο `mesh.userData.faceKeyByMaterialIndex`, node-level).
 * Ο stock `OBJExporter` ΔΕΝ είναι group-aware, οπότε τα per-face ονόματα φτάνουν μόνο στο
 * `.mtl`/baseline — ποτέ σε ψεύτικο per-face `usemtl` (ADR-668: OBJ = per-object dominant).
 */
export function assignExportMaterials(
  root: THREE.Object3D,
  hiddenEntityIds: ReadonlySet<string> = new Set(),
): ExportMaterialEntry[] {
  const table = new Map<string, ExportMaterialEntry>();
  const clones = new Map<string, THREE.Material>();

  root.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (mesh.isMesh !== true) return;

    const { matId, bimId } = resolveBimMeshIdentity(mesh);
    const hidden = bimId !== null && hiddenEntityIds.has(bimId);

    mesh.material = Array.isArray(mesh.material)
      ? mesh.material.map((face) => registerNamedMaterial(face, null, hidden, clones, table))
      : registerNamedMaterial(mesh.material, matId, hidden, clones, table);
  });

  return [...table.values()];
}

/**
 * ADR-683 §7 — το **baseline χρώμα ανά υλικό** για το manifest: `καθαρό όνομα → sRGB "#rrggbb"`.
 * Ο import συγκρίνει το πραγματικό χρώμα του επιστρεφόμενου υλικού με αυτό ώστε να ξεχωρίσει
 * «ο συνεργάτης ξαναέβαψε» από «αμετάβλητο» — χωρίς lossy reverse-parse ονόματος (βλ.
 * `resolve-import-appearance::detectRepaint`).
 *
 * **Γιατί strip `HIDDEN_`:** το κρυμμένο υλικό εξάγεται ως `HIDDEN_<name>` (OBJ) αλλά κρατά το
 * **πραγματικό** του χρώμα· ο import συγκρίνει με το καθαρό όνομα (`stripHiddenPrefix`). Έτσι το
 * OBJ `{mat-x, HIDDEN_mat-x}` και το glTF `{mat-x}` καταρρέουν στην **ίδια** εγγραφή → baseline
 * ταυτόσημο ανά format. `getHexString()` = **sRGB** (ίδιος χώρος με το `collectGltfMaterials`).
 */
export function buildMaterialBaseline(
  entries: readonly ExportMaterialEntry[],
): Map<string, string> {
  const prefix = `${HIDDEN_NAME_PREFIX}_`;
  const map = new Map<string, string>();
  for (const e of entries) {
    const clean = e.name.startsWith(prefix) ? e.name.slice(prefix.length) : e.name;
    if (!map.has(clean)) map.set(clean, `#${e.color.getHexString()}`);
  }
  return map;
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
