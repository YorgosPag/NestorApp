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
