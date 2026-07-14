/**
 * ADR-654 M6/M7 — Τα pack ids + thin URL resolvers των entourage οικογενειών (People, Vehicles,
 * Plants, Furniture).
 *
 * Και οι δύο δείχνουν στον ΚΟΙΝΟ `resolveEntourageUrl` (μία μηχανή, ο packId μόνο διαφέρει). Ένα
 * αρχείο για τα δύο packs ⇒ μηδέν near-identical thin clone (N.18). Οι `*_PACK_ID` σταθερές είναι
 * ο SSoT που καταναλώνει και το asset-pack registry.
 *
 * @see ./entourage-source.ts — ο κοινός resolver
 */

import { resolveEntourageUrl, type EntourageAssetVariant } from './entourage-source';

/** Το pack των ανθρώπων κάτοψης. */
export const PEOPLE_PLAN_PACK_ID = 'people-plan-2d' as const;
/** Το pack των οχημάτων κάτοψης. */
export const VEHICLES_PLAN_PACK_ID = 'vehicles-plan-2d' as const;
/** Το pack των φυτών κάτοψης. */
export const PLANTS_PLAN_PACK_ID = 'plants-plan-2d' as const;
/** Το pack των επίπλων κάτοψης. */
export const FURNITURE_PLAN_PACK_ID = 'furniture-plan-2d' as const;

/** id → URL ενός sprite ανθρώπου (σύγχρονο, asset-pack proxy). */
export function resolvePeoplePlanUrl(id: string, variant: EntourageAssetVariant = 'full'): string {
  return resolveEntourageUrl(PEOPLE_PLAN_PACK_ID, id, variant);
}

/** id → URL ενός sprite οχήματος (σύγχρονο, asset-pack proxy). */
export function resolveVehiclesPlanUrl(id: string, variant: EntourageAssetVariant = 'full'): string {
  return resolveEntourageUrl(VEHICLES_PLAN_PACK_ID, id, variant);
}

/** id → URL ενός sprite φυτού (σύγχρονο, asset-pack proxy). */
export function resolvePlantsPlanUrl(id: string, variant: EntourageAssetVariant = 'full'): string {
  return resolveEntourageUrl(PLANTS_PLAN_PACK_ID, id, variant);
}

/** id → URL ενός sprite επίπλου (σύγχρονο, asset-pack proxy). */
export function resolveFurniturePlanUrl(id: string, variant: EntourageAssetVariant = 'full'): string {
  return resolveEntourageUrl(FURNITURE_PLAN_PACK_ID, id, variant);
}
