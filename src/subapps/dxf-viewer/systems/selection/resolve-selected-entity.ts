/**
 * resolve-selected-entity — ΕΝΑΣ SSoT resolver του primary-selected entity
 * (ADR-484 — cross-level foundation properties).
 *
 * Revit-canonical αρχή: ΜΙΑ αλήθεια επιλογής → ΕΝΑ entity resolution, ανεξάρτητο
 * από το ενεργό view/level. Ιστορικά κάθε Properties tab + ο contextual ribbon
 * resolver έψαχναν ΜΟΝΟ στο `currentScene.entities` του ενεργού ορόφου. Τα πέδιλα
 * όμως ζουν cross-level (collection `floorplan_foundations`, στον foundation level
 * του κτιρίου) και αφαιρούνται ρητά από τα entities ενός μη-foundation ορόφου
 * (`useFoundationLevelSync.stripFootings`). Άρα ένα cross-level πέδιλο δεν βρισκόταν
 * → άδειο panel + κανένα contextual tab.
 *
 * Αυτός ο pure resolver ψάχνει: (1) active `currentScene.entities`, (2) fallback
 * στα cross-level footings (foundation-level store — η ΙΔΙΑ πηγή που τροφοδοτεί το
 * 3D/organism, μηδέν νέο Firestore subscription). Πρώτα το active scene ώστε ένα
 * foundation που ζει στον ενεργό όροφο (χειροκίνητο placement) να μη σκιάζεται από
 * τυχόν cross-level echo.
 *
 * Pure module — zero React/DOM/Firestore deps.
 *
 * @see ../../hooks/selection/useResolvedSelectedEntity.ts — ο reactive hook wrapper
 * @see ../../state/foundation-level-store.ts — η πηγή των cross-level footings
 * @see docs/centralized-systems/reference/adrs/ADR-484-cross-level-foundation-properties.md
 */

import type { Entity } from '../../types/entities';

/**
 * Επιστρέφει το entity με `id === primarySelectedId` ψάχνοντας πρώτα στα active
 * scene entities και μετά (fallback) στα cross-level entities· `null` αν δεν
 * υπάρχει επιλογή ή δεν βρεθεί πουθενά.
 */
export function resolveSelectedEntityFrom(
  primarySelectedId: string | null,
  sceneEntities: readonly Entity[] | null | undefined,
  crossLevelEntities: readonly Entity[],
): Entity | null {
  if (!primarySelectedId) return null;
  const inScene = sceneEntities?.find((e) => e.id === primarySelectedId);
  if (inScene) return inScene;
  return crossLevelEntities.find((e) => e.id === primarySelectedId) ?? null;
}

/**
 * «Δώσε μου την οντότητα με αυτό το id **μέσα σε αυτή τη σκηνή**, αν περνά αυτόν
 * τον φύλακα τύπου» — αλλιώς `null`.
 *
 * ⚠️ Το ίδιο ερώτημα ήταν γραμμένο **τέσσερις** φορές (μετρημένο 2026-07-28 από
 * `jscpd:diff`, δύο ζεύγη κλώνων): στις δύο παλέτες ιδιοτήτων και στους δύο
 * γεφυρωτές του ribbon. Και στα τέσσερα, το μόνο που άλλαζε ήταν ο **τελικός
 * φύλακας** (`'line'` / `isDimensionEntity` / `isStyleEditablePrimitiveType`) —
 * δηλαδή ζητούσε παράμετρο, όχι αντίγραφο.
 *
 * Ο φύλακας είναι παράμετρος **και** στενεύει τον τύπο επιστροφής: γι' αυτό οι
 * καλούντες δεν χρειάζονται πια `as DxfLine` μετά τον έλεγχο. Ένα cast μετά από
 * χειροκίνητο `if (type !== 'line')` είναι διπλή δουλειά όπου η δεύτερη φορά
 * είναι ανέλεγκτη — αν αλλάξει ο έλεγχος, το cast δεν το μαθαίνει ποτέ.
 *
 * Καθαρή συνάρτηση: καμία εξάρτηση από React/store. Ο δρόμος «ποια είναι η
 * ενεργή σκηνή» ανήκει στον καλούντα, επειδή ακριβώς εκεί διαφέρουν οι τέσσερις
 * (prop `dxfScene` vs `levelManager.getLevelScene(currentLevelId)`).
 */
export function findGuardedEntity<TEntity extends { id: string }, TNarrow extends TEntity>(
  scene: { readonly entities: readonly TEntity[] } | null | undefined,
  entityId: string | null | undefined,
  guard: (entity: TEntity) => entity is TNarrow,
): TNarrow | null {
  if (!entityId || !scene) return null;
  const found = scene.entities.find((entity) => entity.id === entityId);
  return found && guard(found) ? found : null;
}
