/**
 * =============================================================================
 * SSoT: BuildingCategory Canonical Definitions
 * =============================================================================
 *
 * **Single Source of Truth** για την κατηγορία χρήσης ενός κτιρίου (`Building.category`).
 * Πριν: inline union στο `types/building/contracts.ts`, `z.enum([...])` στο `POST /api/buildings`,
 * τοπικό `BUILDING_CATEGORIES` στο `BasicInfoCard` — τρεις λίστες για το ίδιο λεξιλόγιο.
 *
 * ⚠️ **ΔΕΝ είναι το `BuildingType`** (`constants/building-types.ts`, 6 τιμές, άλλο πεδίο) — μοιάζουν, δεν ταυτίζονται.
 *
 * **Layering**: Leaf module — καμία εξάρτηση. Ασφαλές για server, client, tests.
 *
 * @module constants/building-categories
 * @see ADR-898 §18.2
 */

export const BUILDING_CATEGORIES = ['residential', 'commercial', 'mixed', 'industrial'] as const;

export type BuildingCategory = (typeof BUILDING_CATEGORIES)[number];

export function isBuildingCategory(value: unknown): value is BuildingCategory {
  return BUILDING_CATEGORIES.some((category) => category === value);
}
