/**
 * ADR-401 Phase G.2 — Stair "effective params" SSoT (attach-to-structural).
 *
 * Revit-grade ΜΙΑ πηγή αλήθειας: όταν μια σκάλα είναι `attached` (κορυφή ή/και
 * βάση κολλά σε δοκάρι/πλάκα/landing), το resolved κατακόρυφο προφίλ
 * (`resolveStairVerticalProfile`) αλλάζει `basePoint.z` + `rise` + `stepCount` +
 * `totalRise` (whole-step snap, Revit «Desired number of risers» — ίσα risers,
 * ακριβής συνάντηση επιπέδου host).
 *
 * ΟΛΟΙ οι consumers — 3D geometry (`BimSceneLayer.syncStairs` → `computeStairGeometry`)
 * ΚΑΙ BOQ ποσότητες (`stair-boq-sync` → `computeStairBoqQuantities`) — καταναλώνουν
 * τα ΙΔΙΑ effective params μέσα από ΑΥΤΗ τη γέφυρα. Όχι nominal-για-BOQ /
 * effective-για-3D (που θα ήταν δύο πηγές αλήθειας, anti-SSoT). Στη Revit οι
 * ποσότητες schedule προκύπτουν από το ίδιο resolved μοντέλο που βλέπεις — εδώ
 * εφαρμόζεται η ίδια αρχή.
 *
 * Μη-attached (ή εκφυλισμένο host εύρος) → **identity** (επιστρέφει το ΙΔΙΟ
 * `params` reference, fast path) → byte-for-byte η ίσια σκάλα, μηδέν regression.
 *
 * @see bim/geometry/stair-vertical-profile.ts — ο pure envelope resolver (math SSoT)
 * @see docs/centralized-systems/reference/adrs/ADR-401-bim-wall-top-base-constraints-attach-to-structural.md §5 (Phase G)
 */

import type { StairParams } from '../../types/stair-types';
import {
  resolveStairVerticalProfile,
  type StairVerticalContext,
  type StairVerticalProfile,
} from '../stair-vertical-profile';

/**
 * Εφαρμόζει το resolved profile πάνω στα domain `StairParams`. Μη-attached profile
 * → identity (ίδιο reference) ώστε οι consumers να μπορούν να κάνουν `===` guard και
 * να αποφεύγουν περιττό recompute. Καμία νέα formula — μόνο spread των ήδη
 * υπολογισμένων τιμών του resolver.
 */
export function applyStairVerticalProfile(
  params: StairParams,
  profile: StairVerticalProfile,
): StairParams {
  if (!profile.topHasAttach && !profile.baseHasAttach) return params;
  return {
    ...params,
    basePoint: { ...params.basePoint, z: profile.baseZmm },
    rise: profile.rise,
    stepCount: profile.stepCount,
    totalRise: profile.totalRise,
  };
}

/**
 * SSoT entry point: resolve το κατακόρυφο προφίλ ΚΑΙ εφάρμοσέ το στα params σε ΕΝΑ
 * βήμα. Επιστρέφει και το `profile` ώστε ο caller να διαβάσει flags (`degenerate`,
 * `missingHostIds`) για warnings. Μη-attached → `params` === input (fast path).
 */
export function resolveEffectiveStairParams(
  params: StairParams,
  ctx: StairVerticalContext,
): { params: StairParams; profile: StairVerticalProfile } {
  const profile = resolveStairVerticalProfile(params, ctx);
  return { params: applyStairVerticalProfile(params, profile), profile };
}
