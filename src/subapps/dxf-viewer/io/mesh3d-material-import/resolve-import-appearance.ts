/**
 * resolve-import-appearance — ADR-678 Φ1. Μετατρέπει το εισαγόμενο υλικό (C4D `usemtl` + `.mtl`)
 * σε `FaceAppearance` του δικού μας συστήματος (ADR-539).
 *
 * **SSoT-first (όπως Revit/ArchiCAD name-based mapping):** αν το όνομα του υλικού ταιριάζει με id
 * του wall-covering catalog (ADR-511) → κρατάμε `{ materialId }` (το χρώμα έρχεται από ΤΟΝ ΚΑΤΑΛΟΓΟ,
 * όχι από το OBJ — robust, ενημερώνεται κεντρικά). Αλλιώς (ο Giorgio έφτιαξε δικό του υλικό στο
 * C4D) → κρατάμε το `Kd` flat χρώμα ως `{ colorHex }`. Textures (`map_Kd`) = Φ2, αγνοούνται εδώ.
 *
 * @see ../../bim/wall-coverings/wall-covering-material-catalog — catalog SSoT
 * @see ../../bim/types/face-appearance-types — FaceAppearance union
 * @see docs/centralized-systems/reference/adrs/ADR-678-c4d-obj-material-roundtrip-import.md
 */

import { listWallCoveringMaterials } from '../../bim/wall-coverings/wall-covering-material-catalog';
import type { FaceAppearance } from '../../bim/types/face-appearance-types';
import type { ImportedMaterial } from './obj-mtl-parse';
import { HIDDEN_NAME_PREFIX } from '../../export/core/mesh3d/mesh3d-naming';

/** Set με τα catalog ids (μία φορά· ο κατάλογος είναι στατικός SSoT). */
const CATALOG_IDS: ReadonlySet<string> = new Set(listWallCoveringMaterials().map((m) => m.id));

/** Αφαιρεί το `HIDDEN_` πρόθεμα του export (το κρυμμένο υλικό κρατά το πραγματικό του όνομα). */
function stripHiddenPrefix(name: string): string {
  const prefix = `${HIDDEN_NAME_PREFIX}_`;
  return name.startsWith(prefix) ? name.slice(prefix.length) : name;
}

/**
 * ΡΙΖΑ 2 (ADR-678 Φ1.1) — «αμετάβλητο ⇒ no-op». Ένα υλικό είναι **αρχικό DNA του Νέστορα** (ο
 * χρήστης ΔΕΝ το άλλαξε στο C4D) όταν το όνομά του είναι ΑΚΡΙΒΩΣ ό,τι θα ξανα-παρήγαγε το export
 * (`mesh3d-materials.ts::resolveMaterialName`): DNA matId (`mat-*` / `elem-*`), ή το fallback
 * χρώματος `mat_<hex6>` (π.χ. `mat_808080`) για meshes χωρίς matId. Τέτοια δεν χρειάζονται
 * override — θα ξανα-έγραφαν το ΙΔΙΟ χρώμα σε δεκάδες στοιχεία (αόρατη αλλαγή + άχρηστο override).
 * Override εφαρμόζεται ΜΟΝΟ σε ΞΕΝΑ (C4D-created) υλικά (π.χ. `road_wood`, `Material.001`).
 *
 * ⚠️ Το `mat_<hex6>` απαιτεί **ακριβώς 6 hex** — ένα custom C4D όνομα όπως `mat_myblue` ΔΕΝ είναι
 * DNA (δεν είναι έγκυρο hex) → σωστά θεωρείται ξένο και βάφεται.
 *
 * @see ../../export/core/mesh3d/mesh3d-materials — resolveMaterialName (η αντίστροφη πλευρά)
 */
export function isUnchangedNestorMaterial(name: string): boolean {
  return /^(mat|elem)-/.test(name) || /^mat_[0-9a-fA-F]{6}$/.test(name);
}

/**
 * Χρώμα κωδικοποιημένο στο ΟΝΟΜΑ του υλικού (`#8B4513` ή `8B4513`) → CSS hex.
 *
 * **Γιατί υπάρχει (ADR-678 Φ1.1):** ο OBJ exporter του **Cinema 4D R15** ΔΕΝ γράφει `.mtl` (μόνο
 * `usemtl <όνομα>`). Άρα το flat χρώμα δεν επιβιώνει μέσω `Kd`. Λύση name-based (όπως Revit/IFC
 * naming conventions): ο χρήστης ονομάζει το C4D υλικό με τον hex κωδικό του χρώματος → επιβιώνει
 * στο `usemtl` και το διαβάζουμε κατευθείαν, χωρίς `.mtl`. `mat_<hex6>` ΔΕΝ φτάνει εδώ (πιάνεται
 * πρώτα ως αμετάβλητο DNA — {@link isUnchangedNestorMaterial}).
 */
function hexColorFromName(name: string): string | null {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(name);
  return m ? `#${m[1].toLowerCase()}` : null;
}

/**
 * `materialName` (από το OBJ `usemtl`) + ο πίνακας `.mtl` → `FaceAppearance` ή `null` (καμία αλλαγή).
 *   0. αρχικό DNA του Νέστορα (αμετάβλητο) → `null` (ΡΙΖΑ 2 — no-op, μηδέν άχρηστο override).
 *   1. catalog id → `{ materialId }` (χρώμα από τον κατάλογο, οδηγεί ΚΑΙ BOQ).
 *   2. `Kd` χρώμα από το `.mtl` → `{ colorHex }`.
 *   3. hex στο όνομα (C4D R15 χωρίς `.mtl`) → `{ colorHex }`.
 *   4. τίποτα από τα παραπάνω → `null`.
 */
export function resolveImportAppearance(
  materialName: string | null,
  mtl: ReadonlyMap<string, ImportedMaterial>,
): FaceAppearance | null {
  if (materialName === null) return null;
  const clean = stripHiddenPrefix(materialName);

  if (isUnchangedNestorMaterial(clean)) return null;

  if (CATALOG_IDS.has(clean)) return { materialId: clean };

  const material = mtl.get(materialName) ?? mtl.get(clean);
  if (material) return { colorHex: material.colorHex };

  const hex = hexColorFromName(clean);
  if (hex) return { colorHex: hex };

  return null;
}
