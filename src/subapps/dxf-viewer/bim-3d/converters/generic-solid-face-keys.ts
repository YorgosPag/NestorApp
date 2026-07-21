/**
 * generic-solid-face-keys — σταθερή αντιστοίχιση `materialIndex → FaceKey` ανά σχήμα
 * (ADR-684 Φ4-C, πάνω στο per-face appearance subsystem ADR-539/679).
 *
 * Το `generic-solid` είναι το **πρώτο** faced solid που ΔΕΝ είναι πρίσμα εξωθημένου ίχνους, οπότε
 * δεν μπορεί να δανειστεί το `faceKeyByMaterialIndex` του `buildFacedPrism`. Αντ' αυτού, οι faceKeys
 * παράγονται **ντετερμινιστικά ανά σχήμα**, ευθυγραμμισμένοι με τη σειρά των geometry groups που
 * παράγουν οι THREE primitives — ώστε η βαφή μιας έδρας να είναι **επαναληπτική** στο save/load
 * (ίδια αρχή σταθερότητας με τα δομικά στερεά: index/order-based, όχι opaque id).
 *
 * ## Σημασιολογικές έδρες (big-player-faithful)
 * Βάφουμε **σημασιολογικές** έδρες, όχι κάθε τρίγωνο — όπως Revit/Cinema 4D χαρακτηρίζουν
 * «πλευρά / πάνω / κάτω» ενός κυλίνδρου. Αυτό ταιριάζει φυσικά με τα groups των THREE primitives:
 *   - `BoxGeometry` → 6 groups (+X, −X, +Y, −Y, +Z, −Z· +Y = top, −Y = bottom, τα 4 κατακόρυφα = side).
 *   - `CylinderGeometry` (κύλινδρος/κώνος/δίσκος/πρίσμα) → 3 groups (0 = πλευρά, 1 = top cap, 2 = bottom cap).
 *     Ο κώνος (rTop=0) παραλείπει το top cap → χρησιμοποιεί μόνο materialIndex 0 & 2· ο index 1 μένει
 *     αχρησιμοποίητος αλλά παρών (η πρόσθετη εγγραφή στον πίνακα υλικών είναι αβλαβής).
 *   - `SphereGeometry` / `TorusGeometry` → κανένα group → όλη η επιφάνεια = ΜΙΑ έδρα (`material[0]`).
 *   - Η πυραμίδα είναι hand-built· τα groups της προστίθενται στο `generic-solid-shape-geometry.ts`
 *     ευθυγραμμισμένα με τον πίνακα εδώ (base = 0, οι 4 τριγωνικές πλευρές = 1..4).
 *
 * @see ./generic-solid-shape-geometry — ο builder που παράγει (και για την πυραμίδα προσθέτει) τα groups
 * @see ../materials/face-appearance-material — `resolveFaceMaterial` (SSoT ανά-έδρα υλικό)
 * @see docs/centralized-systems/reference/adrs/ADR-539-cinema4d-polygon-mode-per-face-appearance.md
 */

import type { GenericSolidShape } from '../../bim/entities/generic-solid/generic-solid-types';
import type { FaceKey } from '../../bim/types/face-appearance-types';

/** Κουτί: 6 όψεις, ίδια σειρά με τα groups του `BoxGeometry` (+X,−X,+Y,−Y,+Z,−Z). */
const BOX_FACE_KEYS: readonly FaceKey[] = ['side:0', 'side:1', 'top', 'bottom', 'side:2', 'side:3'];

/** Κυλινδρικά (κύλινδρος/κώνος/δίσκος/πρίσμα): πλευρά + πάνω + κάτω — σειρά groups `CylinderGeometry`. */
const CYLINDRICAL_FACE_KEYS: readonly FaceKey[] = ['side:0', 'top', 'bottom'];

/** Σφαίρα/κουλούρι: καμία διακριτή όψη → ΜΙΑ έδρα (geometry χωρίς groups → `material[0]`). */
const SINGLE_FACE_KEYS: readonly FaceKey[] = ['side:0'];

/** Πυραμίδα: βάση + 4 τριγωνικές πλευρές — ίδια σειρά με τα χειροκίνητα `addGroup` του builder. */
const PYRAMID_FACE_KEYS: readonly FaceKey[] = ['bottom', 'side:0', 'side:1', 'side:2', 'side:3'];

/**
 * Οι faceKeys του σχήματος, με τη σειρά του `materialIndex` (index i = υλικό της i-οστής όψης).
 * Σταθεροί ανά σχήμα → η βαφή μιας έδρας επιβιώνει save/load. Καθαρή, ντετερμινιστική συνάρτηση.
 */
export function genericSolidFaceKeys(shape: GenericSolidShape): readonly FaceKey[] {
  switch (shape.kind) {
    case 'box':
      return BOX_FACE_KEYS;
    case 'cylinder':
    case 'cone':
    case 'disc':
    case 'prism':
      return CYLINDRICAL_FACE_KEYS;
    case 'sphere':
    case 'torus':
      return SINGLE_FACE_KEYS;
    case 'pyramid':
      return PYRAMID_FACE_KEYS;
  }
}
