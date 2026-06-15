/**
 * Active-reinforcement convenience (ADR-456/460 — Giorgio 2026-06-16).
 *
 * Store-coupled wrapper γύρω από το pure `resolveActiveColumnReinforcement`: resolve-άρει
 * τον **ενεργό κανονισμό** από το `structuralSettingsStore` (SSoT του active code) ώστε οι
 * pure renderers/converters (2Δ `column-rebar-2d`, 3Δ `column-rebar-3d`) να παίρνουν τον
 * real-time auto-derived οπλισμό με ΜΙΑ κλήση — χωρίς να κρατούν provider.
 *
 * Ζει ΞΕΧΩΡΙΣΤΑ από το `section-context.ts` ώστε εκείνο να μένει **pure** (zero store/
 * Firestore import) — το `section-context` το καταναλώνουν unit tests + commands που δεν
 * πρέπει να σέρνουν την αλυσίδα του store. `getState()` = synchronous read (ΟΧΙ
 * subscription· ADR-040-safe).
 *
 * @see ./section-context.ts — resolveActiveColumnReinforcement (pure SSoT)
 */

import type { ColumnParams } from '../types/column-types';
import type { ColumnReinforcement } from './reinforcement/column-reinforcement-types';
import { resolveActiveColumnReinforcement } from './section-context';
import { resolveStructuralCode } from './codes';
import { useStructuralSettingsStore } from '../../state/structural-settings-store';

/**
 * `resolveActiveColumnReinforcement` με τον ενεργό κανονισμό από το settings store.
 * Fast-path: manual/absent → επιστρέφει το stored χωρίς να αγγίξει τον provider.
 */
export function resolveActiveColumnReinforcementForParams(
  params: ColumnParams,
): ColumnReinforcement | undefined {
  if (!params.reinforcement?.auto) return params.reinforcement;
  const provider = resolveStructuralCode(useStructuralSettingsStore.getState().codeId);
  return resolveActiveColumnReinforcement(params, provider);
}
