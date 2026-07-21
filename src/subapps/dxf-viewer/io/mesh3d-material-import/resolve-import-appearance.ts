/**
 * resolve-import-appearance — ADR-678 Φ1. Μετατρέπει το εισαγόμενο υλικό (C4D `usemtl` + `.mtl`)
 * σε `FaceAppearance` του δικού μας συστήματος (ADR-539).
 *
 * **SSoT-first (όπως Revit/ArchiCAD name-based mapping):** αν το όνομα του υλικού ταιριάζει με
 * γνωστό Νέστωρ υλικό (ADR-679 Φ2a: wall-covering + δάπεδα + library `bmat_*` — by id ή ανθρώπινο
 * όνομα) → κρατάμε `{ materialId }` (το χρώμα λύνεται ΚΕΝΤΡΙΚΑ downstream από τον
 * `material-color-registry` — robust, ενημερώνεται κεντρικά). Αλλιώς (ο Giorgio έφτιαξε δικό του
 * υλικό στο C4D) → κρατάμε το `Kd` flat χρώμα ως `{ colorHex }`. Textures (`map_Kd`) = Φ2b.
 *
 * Η αναγνώριση «γνωστό υλικό;» είναι **injected** (`KnownMaterialResolver`) — ο caller
 * προ-φορτώνει τα library υλικά (async, scoped) και περνά τον resolver· έτσι αυτό το core μένει
 * pure/sync/testable, χωρίς να ξέρει από Firestore/scope.
 *
 * @see ./known-import-materials — ο resolver «όνομα → material id» (SSoT αναγνώρισης)
 * @see ../../bim/materials/material-color-registry — το χρώμα των ids (downstream)
 * @see ../../bim/types/face-appearance-types — FaceAppearance union
 * @see docs/centralized-systems/reference/adrs/ADR-678-c4d-obj-material-roundtrip-import.md
 */

import type { FaceAppearance } from '../../bim/types/face-appearance-types';
import type { ImportedMaterial } from './obj-mtl-parse';
import type { KnownMaterialResolver } from './known-import-materials';
import { stripHiddenPrefix } from '../../export/core/mesh3d/mesh3d-naming';

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
 * ADR-683 §7 — «αμετάβλητο DNA» ΑΛΛΑ ο συνεργάτης το ξαναέβαψε κρατώντας το όνομα (Blender/glTF).
 * Το manifest baseline (`καθαρό όνομα → sRGB hex`) δίνει το εξαχθέν χρώμα· αν το πραγματικό χρώμα
 * του επιστρεφόμενου υλικού διαφέρει → **βάφτηκε** → flat `{ colorHex }`. Ίσο ή απόν baseline →
 * `null` (η προ-baseline ΡΙΖΑ 2: αμετάβλητο = no-op — μηδέν regression για OBJ/χωρίς sidecar).
 *
 * ⚠️ Χρησιμοποιείται **μόνο** στο glTF μονοπάτι: εκεί το πραγματικό χρώμα (`collectGltfMaterials`)
 * και το baseline είναι **sRGB** (`getHexString`), άρα συγκρίσιμα. Το OBJ `.mtl` `Kd` είναι linear
 * → δεν περνά baseline (θα έδινε false-positive).
 */
function detectRepaint(
  clean: string,
  materialName: string,
  mtl: ReadonlyMap<string, ImportedMaterial>,
  exportedBaseline: ReadonlyMap<string, string> | undefined,
): FaceAppearance | null {
  const baseHex = exportedBaseline?.get(clean);
  const actual = mtl.get(materialName) ?? mtl.get(clean);
  if (baseHex && actual && actual.colorHex.toLowerCase() !== baseHex.toLowerCase()) {
    return { colorHex: actual.colorHex };
  }
  return null;
}

/**
 * Το «άλλαξε» μονοπάτι (μετά τον αποκλεισμό «αμετάβλητο»): γνωστό catalog/library id → `Kd` χρώμα
 * του `.mtl` → hex κωδικοποιημένο στο όνομα (C4D R15 χωρίς `.mtl`) → `null`. Κοινό για την
 * name-based ΡΙΖΑ (global) και για το per-entity baseline «CHANGED» branch (ADR-678 Βήμα 2), ώστε
 * η σειρά προτεραιότητας να μένει ΜΙΑ (κανένα sibling clone — N.18).
 */
function resolveChangedAppearance(
  clean: string,
  materialName: string,
  mtl: ReadonlyMap<string, ImportedMaterial>,
  resolveKnownId: KnownMaterialResolver,
): FaceAppearance | null {
  const knownId = resolveKnownId(clean);
  if (knownId) return { materialId: knownId };

  const material = mtl.get(materialName) ?? mtl.get(clean);
  if (material) return { colorHex: material.colorHex };

  const hex = hexColorFromName(clean);
  if (hex) return { colorHex: hex };

  return null;
}

/**
 * `materialName` (από το OBJ `usemtl`) + ο πίνακας `.mtl` + ο `resolveKnownId` → `FaceAppearance`
 * ή `null` (καμία αλλαγή).
 *
 * **ADR-678 Βήμα 2 — per-entity/per-face baseline (`exportedName`):** το manifest κρατά ΑΝΑ ΟΨΗ το
 * όνομα υλικού που ΕΞΗΧΘΗ. Όταν το ξέρουμε γι' αυτή την όψη (`typeof exportedName === 'string'`), η
 * σύγκριση γίνεται **στοχευμένα**, όχι με τον global name-based `isUnchangedNestorMaterial`:
 *   - `clean === exportedName` → αμετάβλητο **γι' αυτή την όψη** → `null` (ή repaint αν το χρωματικό
 *     baseline δείχνει αλλαγή, `detectRepaint`).
 *   - `clean !== exportedName` → **swap** (π.χ. `mat-concrete-c25` → `mat-brick-masonry`) — που ο
 *     global regex θα άφηνε αόρατο· λύνεται με το «CHANGED» μονοπάτι (`resolveChangedAppearance`),
 *     ΧΩΡΙΣ να συμβουλευτεί τον global `isUnchangedNestorMaterial`.
 *
 * **Χωρίς `exportedName`** (παλιό manifest / OBJ χωρίς per-entity baseline) → η προ-Βήμα-2
 * συμπεριφορά ακέραιη (global `isUnchangedNestorMaterial` fallback — μηδέν regression):
 *   0. αρχικό DNA του Νέστορα (αμετάβλητο) → `null` — ΕΚΤΟΣ αν το manifest baseline δείχνει repaint
 *      (ADR-683 §7, `detectRepaint`) → `{ colorHex }`.
 *   1. γνωστό υλικό (catalog/library, by id ή όνομα) → `{ materialId }` (χρώμα κεντρικά, οδηγεί BOQ).
 *   2. `Kd` χρώμα από το `.mtl` → `{ colorHex }`.
 *   3. hex στο όνομα (C4D R15 χωρίς `.mtl`) → `{ colorHex }`.
 *   4. τίποτα από τα παραπάνω → `null`.
 */
export function resolveImportAppearance(
  materialName: string | null,
  mtl: ReadonlyMap<string, ImportedMaterial>,
  resolveKnownId: KnownMaterialResolver,
  exportedBaseline?: ReadonlyMap<string, string>,
  exportedName?: string | null,
): FaceAppearance | null {
  if (materialName === null) return null;
  const clean = stripHiddenPrefix(materialName);

  if (typeof exportedName === 'string') {
    return clean === exportedName
      ? detectRepaint(clean, materialName, mtl, exportedBaseline)
      : resolveChangedAppearance(clean, materialName, mtl, resolveKnownId);
  }

  if (isUnchangedNestorMaterial(clean)) return detectRepaint(clean, materialName, mtl, exportedBaseline);

  return resolveChangedAppearance(clean, materialName, mtl, resolveKnownId);
}
