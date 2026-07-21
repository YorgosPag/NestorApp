/**
 * known-import-materials — ADR-679 Φ2a. Χτίζει τον lookup «όνομα C4D → Νέστωρ material id»
 * για το round-trip import (ADR-678). Name-based (όπως Revit/IFC material mapping):
 *   - στατικοί κατάλογοι όψης: wall-covering (ADR-511) + δάπεδα (ADR-419) — **by id**·
 *   - DNA `mat-*` preset ids τοίχων (ADR-363, `mat-concrete-c25`/`mat-brick-masonry` κ.λπ.) — **by
 *     id** (ADR-678 Βήμα 2: αναγνώριση catalog→catalog swap)·
 *   - library υλικά του χρήστη (`bmat_*`, Firestore) — **by id ΚΑΙ by ανθρώπινο όνομα**
 *     (`nameEl`/`nameEn`), γιατί αυτά τα ονομάζει ο χρήστης χειρόγραφα στο C4D.
 *
 * **Προτεραιότητα σε σύγκρουση (Giorgio 2026-07-19): το id υπερισχύει** του ανθρώπινου
 * ονόματος — ποτέ διπλή/ασαφής αναγνώριση (ο resolver ρωτά πρώτα τα ids). Ο lookup
 * χτίζεται ΜΙΑ φορά ανά import· ο button τον τροφοδοτεί με το live `useMaterialLibrary`
 * snapshot (system + company + project scope).
 *
 * **Γιατί μόνο id για τους στατικούς καταλόγους:** ο χρήστης δεν μετονομάζει built-in
 * υλικά — τα διαλέγει από λίστα, οπότε το export γράφει το id τους. Τα δικά του υλικά
 * όμως τα φτιάχνει & τα βαφτίζει ο ίδιος → name-match. Το ΧΡΩΜΑ κάθε id λύνεται
 * downstream από τον ενοποιημένο `material-color-registry` — εδώ μόνο η αναγνώριση.
 *
 * @see ./resolve-import-appearance — ο καταναλωτής (name → FaceAppearance)
 * @see ../../bim/materials/material-color-registry — το χρώμα των ids (downstream)
 * @see docs/centralized-systems/reference/adrs/ADR-679-pbr-material-full-parity.md §5
 */

import type { BimMaterial } from '../../bim/types/bim-material-types';
import { listWallCoveringMaterials } from '../../bim/wall-coverings/wall-covering-material-catalog';
import { listFloorFinishMaterials } from '../../bim/floor-finishes/floor-finish-material-catalog';
import { WALL_MATERIAL_PRESET_IDS } from '../../bim/walls/wall-material-catalog';

/** Λύνει ένα καθαρό όνομα υλικού (από OBJ `usemtl`) σε Νέστωρ material id, ή `null`. */
export type KnownMaterialResolver = (name: string) => string | null;

/** Κανονικοποίηση για case/whitespace-insensitive match (mirror Revit material naming). */
function norm(s: string): string {
  return s.trim().toLowerCase();
}

/**
 * Χτίζει τον resolver από τους στατικούς καταλόγους + τα library υλικά του χρήστη.
 * **id-first:** ο resolver ρωτά πρώτα τον χάρτη ids και μόνο μετά τα ανθρώπινα ονόματα,
 * ώστε ένα ανθρώπινο όνομα να ΜΗΝ σκιάζει ποτέ ένα id (id wins σε σύγκρουση).
 */
export function buildKnownMaterialResolver(
  userMaterials: readonly BimMaterial[] = [],
): KnownMaterialResolver {
  const byId = new Map<string, string>(); // normalized id → πραγματικό id
  const byName = new Map<string, string>(); // normalized ανθρώπινο όνομα → πραγματικό id

  const addId = (id: string): void => {
    byId.set(norm(id), id);
  };
  const addName = (name: string, id: string): void => {
    const key = norm(name);
    // Πρώτο κερδίζει σε διπλό όνομα → ντετερμινιστικό, ποτέ silent overwrite.
    if (key && !byName.has(key)) byName.set(key, id);
  };

  for (const m of listWallCoveringMaterials()) addId(m.id);
  for (const m of listFloorFinishMaterials()) addId(m.id);
  // ADR-678 Βήμα 2 — τα DNA `mat-*` preset ids των τοίχων (`mat-concrete-c25`, `mat-brick-masonry`
  // κ.λπ. — ADR-363). Χωρίς αυτά, ένα catalog→catalog swap που πιάνει το per-entity baseline θα
  // έπεφτε στο «CHANGED» μονοπάτι αλλά ο resolver θα επέστρεφε `null` (άγνωστο id) → αόρατο no-op.
  for (const id of WALL_MATERIAL_PRESET_IDS) addId(id);
  for (const m of userMaterials) {
    addId(m.id);
    addName(m.nameEl, m.id);
    addName(m.nameEn, m.id);
  }

  return (name: string): string | null => {
    const key = norm(name);
    return byId.get(key) ?? byName.get(key) ?? null;
  };
}
