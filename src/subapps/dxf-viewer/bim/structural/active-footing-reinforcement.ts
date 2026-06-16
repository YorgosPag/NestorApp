/**
 * Active footing-reinforcement SSoT (ADR-463).
 *
 * ΕΝΑ σημείο που δίνει τον «ενεργό» οπλισμό ενός θεμελιακού στοιχείου στους pure
 * renderers/converters (2Δ `footing-rebar-2d`, 3Δ `footing-rebar-3d`, detail-sheet).
 * Mirror του `resolveActiveColumnReinforcementForParams` — αλλά το foundation model
 * **δεν έχει `auto` flag** (ADR-459/460 types αμετάβλητα, βλ. ADR-463 §3.2), άρα
 * εδώ είναι pure passthrough του stored design:
 *   - absent → `undefined` (δεν έχει οριστεί οπλισμός· κανείς δεν ζωγραφίζει, ίδια
 *     συμπεριφορά με κολώνα πριν το «Αυτόματος Οπλισμός»).
 *   - present → το stored `reinforcement` ως έχει.
 *
 * Pure (zero store/Firestore import) επίτηδες — οι render unit-tests να μη σέρνουν
 * την αλυσίδα του settings store. Σημείο επέκτασης αν προστεθεί real-time auto
 * re-derive στο μέλλον (ξεχωριστό slice — βλ. ADR-463 §4 DEFER).
 *
 * @see ./active-reinforcement.ts — ο δίδυμος της κολώνας (store-coupled, auto-aware)
 */

import type { FoundationParams } from '../types/foundation-types';
import type { FootingReinforcement } from './reinforcement/footing-reinforcement-types';

/** Ο ενεργός (stored) οπλισμός θεμελίωσης για render/detail· `undefined` αν απών. */
export function resolveActiveFootingReinforcementForParams(
  params: FoundationParams,
): FootingReinforcement | undefined {
  return params.reinforcement;
}
