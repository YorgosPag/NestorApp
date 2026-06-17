/**
 * Active footing-reinforcement SSoT (ADR-463 · auto-aware tie-beam ADR-477).
 *
 * ΕΝΑ σημείο που δίνει τον «ενεργό» οπλισμό ενός θεμελιακού στοιχείου στους pure
 * renderers/converters (2Δ `footing-rebar-2d`, 3Δ `footing-rebar-3d`, detail-sheet).
 *
 * Συμπεριφορά ανά kind:
 *   - **pad / strip** → pure passthrough του stored design (ο σχεδιασμός/re-size τους
 *     ζει στο ADR-464· δεν έχουν live auto re-derive). absent → `undefined`.
 *   - **tie-beam** (ADR-477) → **auto-aware** (parity κολόνας/δοκού): `auto:true` →
 *     φρέσκο code-suggested design από την ΤΡΕΧΟΥΣΑ γεωμετρία (resize ⇒ real-time
 *     επανυπολογισμός)· absent/manual → stored ως έχει.
 *
 * Store-coupled (mirror `active-reinforcement.ts`): resolve-άρει τον ενεργό κανονισμό
 * από το `structuralSettingsStore` ΜΟΝΟ στο auto branch — pad/strip & manual & absent
 * πέφτουν στο fast-path passthrough χωρίς να αγγίξουν τον store (render unit-tests που
 * δίνουν stored design μένουν καθαρά). `getState()` = synchronous read (ADR-040-safe).
 *
 * @see ./section-context.ts — resolveActiveTieBeamReinforcement (pure SSoT)
 * @see ./active-reinforcement.ts — οι δίδυμοι κολόνας/δοκού (store-coupled)
 */

import type { FoundationParams } from '../types/foundation-types';
import type { FootingReinforcement } from './reinforcement/footing-reinforcement-types';
import { resolveActiveTieBeamReinforcement } from './section-context';
import { resolveStructuralCode } from './codes';
import { useStructuralSettingsStore } from '../../state/structural-settings-store';

/** Ο ενεργός οπλισμός θεμελίωσης για render/detail· `undefined` αν απών. */
export function resolveActiveFootingReinforcementForParams(
  params: FoundationParams,
): FootingReinforcement | undefined {
  // pad/strip → passthrough (σχεδιασμός ADR-464, χωρίς live auto re-derive).
  if (params.kind !== 'tie-beam') return params.reinforcement;
  const r = params.reinforcement; // TieBeamReinforcement | undefined (narrowed)
  // absent/manual → stored ως έχει (fast-path, μηδέν store touch).
  if (!r || !r.auto) return r;
  const provider = resolveStructuralCode(useStructuralSettingsStore.getState().codeId);
  return resolveActiveTieBeamReinforcement(params, provider);
}
