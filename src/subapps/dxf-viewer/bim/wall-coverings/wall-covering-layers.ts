/**
 * Wall Covering — Compound assembly layer helpers (ADR-511, SSoT).
 *
 * ΜΙΑ πηγή για: (α) κατασκευή στρώσης από material (catalog defaults), (β) εύρεση της
 * surface/body στρώσης, (γ) επιλογή της **ορατής** στρώσης (χρώμα 2D). Πριν από αυτό η ίδια
 * λογική ήταν copy-pasted σε `WallCoveringRenderer` (resolveVisibleLayer), `useRibbonWallCoveringBridge`
 * (findSurfaceLayer/findBodyLayer/layerFromMaterial) και `wall-covering-room-defaults` (layer) —
 * τώρα όλοι delegate εδώ (μηδέν διπλότυπο, N.0.2 / N.12).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-511-wall-finish-per-room.md
 */

import type { WallCoveringLayer, WallCoveringMaterialId } from '../types/wall-covering-types';
import {
  getWallCoveringDefaultFunction,
  getWallCoveringDefaultThicknessMm,
} from './wall-covering-material-catalog';

/** Νέα στρώση από material, με πάχος + ρόλο από το catalog SSoT. Pure. */
export function makeWallCoveringLayer(materialId: WallCoveringMaterialId): WallCoveringLayer {
  return {
    materialId,
    thicknessMm: getWallCoveringDefaultThicknessMm(materialId),
    function: getWallCoveringDefaultFunction(materialId),
  };
}

/** Η surface στρώση (coat/μπογιά) του assembly, ή `undefined`. */
export function findSurfaceLayer(layers: readonly WallCoveringLayer[]): WallCoveringLayer | undefined {
  return layers.find((l) => l.function === 'surface');
}

/** Η «βαρύτερη» body στρώση (μεγαλύτερο πάχος) του assembly, ή `undefined`. */
export function findBodyLayer(layers: readonly WallCoveringLayer[]): WallCoveringLayer | undefined {
  let heaviest: WallCoveringLayer | undefined;
  for (const l of layers) {
    if (l.function === 'surface') continue;
    if (!heaviest || l.thicknessMm > heaviest.thicknessMm) heaviest = l;
  }
  return heaviest;
}

/**
 * Η στρώση που ορίζει το ορατό 2D χρώμα: η surface (coat) αν υπάρχει, αλλιώς η βαρύτερη body,
 * αλλιώς η πρώτη. Καταναλώνεται από τον renderer (fill/outline color). Pure.
 */
export function resolveVisibleWallCoveringLayer(layers: readonly WallCoveringLayer[]): WallCoveringLayer {
  return findSurfaceLayer(layers) ?? findBodyLayer(layers) ?? layers[0];
}
