/**
 * resolve-entity-current-material — ADR-687 Φ8 (γενική βιβλιοθήκη υλικών, «τρέχον υλικό»).
 *
 * SSoT για την ερώτηση «ποιο materialId έχει ΤΩΡΑ αυτή η entity/όψη;» — καθαρή ανάγνωση του
 * `faceAppearance` (ADR-539 SSoT, `bim/types/face-appearance-types.ts`), ΧΩΡΙΣ React, ΧΩΡΙΣ
 * εξάρτηση σε entity-type (walls/structural solids/imported mesh — όλα περνούν από το ΙΔΙΟ
 * `faceAppearance` base field, βλ. `bim/types/bim-base.ts`).
 *
 * Τρεις ερωτήσεις:
 *   - `resolveEntityCurrentMaterialId` — «βάψιμο ΟΛΟΥ του στοιχείου» (base `'*'`). Χρησιμοποιείται
 *     όταν η επιλογή είναι το ΣΤΟΙΧΕΙΟ (όχι μία όψη) — π.χ. swatch highlight στη γενική βιβλιοθήκη.
 *   - `resolveFaceCurrentMaterialId` — per-face override με fallback στο base (ο ίδιος cascade με
 *     `bim-3d/materials/face-appearance-material.ts::resolveFaceMaterial`, αλλά επιστρέφει
 *     `materialId` string αντί για κατασκευασμένο `Material` — δεν χρειάζεται THREE εδώ).
 *   - `resolveEntityAppearanceRefs` (ADR-688 follow-up) — το ΣΥΝΟΛΟ των distinct refs (materialIds
 *     ΚΑΙ ad-hoc colorHexes) που ο 3D renderer ΟΝΤΩΣ εφαρμόζει σε αυτό το στοιχείο, σε όλα τα
 *     faceAppearance keys (base `'*'` ΚΑΙ κάθε per-face/per-slot override) — όχι μόνο το base.
 *     Αναγκαίο γιατί ο renderer (`imported-mesh-material-enhance.ts::resolveSlotMaterial`) εφαρμόζει
 *     `appearance[slot:name] ?? appearance['*'] ?? embedded` ΑΝΑ slot — ένα πολυ-slot imported mesh
 *     με βαμμένο ΕΝΑ slot έχει faceAppearance `{ '*': …, 'slot:seat': … }`, και το «τρέχον υλικό»
 *     πρέπει να δείχνει ΚΑΙ τα δύο, όχι μόνο το base (αλλιώς panel/highlight διαφωνούν με τον καμβά).
 *     Οι colorHexes χρειάζονται γιατί το drag-drop/imported βάψιμο μπορεί να είναι ωμό `colorHex`
 *     (χωρίς catalog materialId), και το κάτω panel «Υλικά όψης» πρέπει να φωτίζει ΚΑΙ αυτό το
 *     swatch (ad-hoc), ίδιο μοντέλο με το `scene-material-usage.ts::SceneAppearanceRefs`.
 *   - `resolveEntityMaterialIdSet` — thin προβολή του παραπάνω σε μόνο τα materialIds (back-compat).
 *   - `resolveEntityRenderedMaterialIds` (ADR-694 Δ1) — «ποιο υλικό βλέπει ΟΝΤΩΣ ο χρήστης σε αυτό
 *     το στοιχείο;»: ρητό override (`faceAppearance`) → **αλλιώς** embedded (τα ψημένα υλικά του
 *     `.glb`, ADR-691 `params.embeddedMaterialIds`). Οι τέσσερις παραπάνω απαντούν «τι override
 *     υπάρχει», που για εισαγόμενο πλέγμα είναι ΚΕΝΟ by design (ADR-691 §3.α: η γεωμετρία ΔΕΝ
 *     βάφεται — τα υλικά είναι ήδη μέσα στο αρχείο) — γι' αυτό το αριστερό panel έδειχνε ουδέτερο
 *     γκρι swatch ενώ η κάτω μπάρα «Υλικά όψης» έδειχνε το ίδιο υλικό κόκκινο (ADR-694 πρόβλημα Α).
 *
 * @see bim/types/face-appearance-types.ts — BASE_FACE_KEY, FaceAppearanceMap, FaceKey, slotFaceKey()
 * @see bim-3d/materials/face-appearance-material.ts — ίδιο cascade, resolve σε THREE Material
 * @see app/ImportedMeshMaterialMapHost.tsx — τοπικό `currentMaterialId()` (ADR-686, μόνο base,
 *     imported-mesh-scoped) — υποψήφιο Boy-Scout dedup προς αυτό εδώ, ΟΧΙ τώρα (βλ. σημείωση PR).
 * @see docs/centralized-systems/reference/adrs/ADR-687-material-editor.md
 */

import { BASE_FACE_KEY, type FaceAppearanceMap } from '../../bim/types/face-appearance-types';

/** Οτιδήποτε μπορεί να φέρει `faceAppearance` (κάθε BIM entity, βλ. `bim/types/bim-base.ts`). */
interface EntityWithFaceAppearance {
  readonly faceAppearance?: FaceAppearanceMap;
}

/**
 * Το τρέχον override υλικού **ΟΛΟΥ** του στοιχείου (base `'*'` slot) — `null` αν δεν υπάρχει
 * override (auto/embedded/default look). Γενικό: δουλεύει για ΚΑΘΕ entity type, όχι μόνο
 * imported mesh.
 */
export function resolveEntityCurrentMaterialId(entity: EntityWithFaceAppearance): string | null {
  return entity.faceAppearance?.[BASE_FACE_KEY]?.materialId ?? null;
}

/**
 * Το τρέχον override υλικού μιας **συγκεκριμένης όψης** (`faceKey`): per-face override αν
 * υπάρχει, αλλιώς fallback στο base `'*'`, αλλιώς `null`. Ίδιος cascade με
 * `resolveFaceMaterial` (Revit «Paint» + type material / Cinema 4D material tags).
 */
export function resolveFaceCurrentMaterialId(
  entity: EntityWithFaceAppearance,
  faceKey: string,
): string | null {
  const appearance = entity.faceAppearance;
  if (!appearance) return null;
  return appearance[faceKey]?.materialId ?? appearance[BASE_FACE_KEY]?.materialId ?? null;
}

/** Τα distinct appearance refs ενός στοιχείου — mirror του `SceneAppearanceRefs` (per-entity). */
export interface EntityAppearanceRefs {
  /** Distinct catalog/user/paint materialIds (base `'*'` + κάθε per-face/slot override). */
  readonly materialIds: string[];
  /** Distinct ad-hoc colorHexes (ωμό βάψιμο drag-drop/imported χωρίς catalog materialId). */
  readonly colorHexes: string[];
}

/**
 * Το ΣΥΝΟΛΟ των distinct refs πραγματικά εφαρμοσμένων σε αυτό το στοιχείο — ένα ανά `faceAppearance`
 * κλειδί (base `'*'` + κάθε per-face/per-slot override), deduplicated, order-stable (σειρά πρώτης
 * εμφάνισης στο map), χωριστά σε `materialIds` + `colorHexes`. Και τα δύο άδεια = κανένα override
 * (καθαρό embedded/auto look). Καθρεφτίζει ΑΚΡΙΒΩΣ ό,τι ο renderer εφαρμόζει ανά slot
 * (`imported-mesh-material-enhance.ts::resolveSlotMaterial`'s `appearance[slot] ?? appearance['*']`
 * cascade) ΚΑΙ ό,τι ο συλλέκτης σκηνής `collectSceneAppearanceRefs` απαριθμεί — γι' αυτό panel/
 * highlight πρέπει να διαβάζουν ΑΠΟ ΕΔΩ όταν θέλουν «όλα τα εφαρμοσμένα», όχι μόνο το base.
 * Καμία εξάρτηση σε entity-type — δουλεύει για ΚΑΘΕ solid/imported mesh.
 */
export function resolveEntityAppearanceRefs(entity: EntityWithFaceAppearance): EntityAppearanceRefs {
  const appearance = entity.faceAppearance;
  if (!appearance) return { materialIds: [], colorHexes: [] };
  const seenMat = new Set<string>();
  const seenColor = new Set<string>();
  const materialIds: string[] = [];
  const colorHexes: string[] = [];
  for (const key of Object.keys(appearance)) {
    const ref = appearance[key];
    const materialId = ref?.materialId;
    if (materialId && !seenMat.has(materialId)) {
      seenMat.add(materialId);
      materialIds.push(materialId);
    }
    const colorHex = ref?.colorHex;
    if (colorHex && !seenColor.has(colorHex)) {
      seenColor.add(colorHex);
      colorHexes.push(colorHex);
    }
  }
  return { materialIds, colorHexes };
}

/**
 * Thin προβολή του `resolveEntityAppearanceRefs` σε μόνο τα materialIds (back-compat για callers που
 * δεν χειρίζονται ad-hoc χρώματα). ΕΝΑΣ loop (SSoT) — καμία διπλή απαρίθμηση.
 */
export function resolveEntityMaterialIdSet(entity: EntityWithFaceAppearance): string[] {
  return resolveEntityAppearanceRefs(entity).materialIds;
}

/** Dedup order-stable, αγνοώντας κενά ids (defensive — legacy/partial imports). */
function dedupeIds(ids: readonly string[] | undefined): string[] {
  if (!ids || ids.length === 0) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

/**
 * ADR-694 Δ1 — **τα υλικά που ΟΝΤΩΣ βλέπει ο χρήστης** σε αυτό το στοιχείο, με cascade:
 *
 *   ρητό override (`faceAppearance`)  →  αλλιώς  embedded (τα ψημένα `bmat_*` του `.glb`)
 *
 * Το override **πάντα** υπερισχύει: αν το στοιχείο έχει έστω ΕΝΑ ρητό appearance ref (materialId
 * **ή** ωμό `colorHex`), ο χρήστης το έβαψε ρητά και αυτό βλέπει — δεν πέφτουμε ποτέ στα embedded.
 * (Ρητό βάψιμο μόνο με `colorHex` → `[]`: υπάρχει override αλλά δεν αντιστοιχεί σε υλικό
 * βιβλιοθήκης, οπότε ο caller δείχνει το ad-hoc χρώμα/όνομα πηγής, όχι το embedded υλικό.)
 *
 * Επιστρέφει 0/1/N ids (dedup, order-stable) ώστε ο caller να μπορεί να δει «multiple» ακριβώς
 * όπως σήμερα.
 *
 * ⚠️ ΔΕΝ γράφει τίποτα: το ADR-691 §3.α (η γεωμετρία εισαγόμενου πλέγματος ΔΕΝ βάφεται) μένει
 * ακέραιο — αλλάζει μόνο τι *διαβάζει* το UI.
 *
 * ### Γιατί τα embedded ids έρχονται ως **παράμετρος** και όχι από το entity
 * Το module είναι σκόπιμα **entity-type-agnostic** (δέχεται `EntityWithFaceAppearance`, ένα
 * structural interface — δουλεύει για τοίχους, δομικά solids, εισαγόμενα πλέγματα, τα πάντα).
 * Το `params.embeddedMaterialIds` υπάρχει ΜΟΝΟ στο `ImportedMeshEntity`. Import του τύπου εδώ θα:
 *   (α) έδενε ένα γενικό materials module σε ΕΝΑΝ συγκεκριμένο BIM entity τύπο,
 *   (β) υποχρέωνε type-narrowing (`isImportedMeshEntity`) → import του entity barrel → κύκλος
 *       με τα `types/entities`,
 *   (γ) θα άνοιγε την πόρτα σε «άλλο ένα if ανά entity type» μέσα σε ένα module που σήμερα δεν
 *       ξέρει κανέναν τύπο.
 * Η δεύτερη προαιρετική παράμετρος κρατά το module καθαρό και τη γνώση «πού ζουν τα embedded ids»
 * στον caller που ΗΔΗ κρατά τυποποιημένη οντότητα (mirror του `scene-material-usage.ts`, που
 * επίσης εξάγει τα ids στο δικό του type-aware επίπεδο).
 *
 * @see bim-3d/ui/scene-material-usage.ts — ο συλλέκτης ΣΚΗΝΗΣ διαβάζει την ΙΔΙΑ πηγή
 *   (`params.embeddedMaterialIds`) αλλά απαντά σε ΑΛΛΗ ερώτηση («τι περιέχει η σκηνή» → ένωση
 *   override **ΚΑΙ** embedded), γι' αυτό δεν συγχωνεύεται με αυτό εδώ («τι βλέπει ο χρήστης σε
 *   ΑΥΤΟ το στοιχείο» → override **Ή** embedded).
 */
export function resolveEntityRenderedMaterialIds(
  entity: EntityWithFaceAppearance,
  embeddedMaterialIds?: readonly string[],
): string[] {
  const refs = resolveEntityAppearanceRefs(entity);
  const hasExplicitOverride = refs.materialIds.length > 0 || refs.colorHexes.length > 0;
  return hasExplicitOverride ? refs.materialIds : dedupeIds(embeddedMaterialIds);
}
