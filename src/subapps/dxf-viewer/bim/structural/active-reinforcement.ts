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
import type { BeamEntity } from '../types/beam-types';
import type { SlabEntity } from '../types/slab-types';
import type { ColumnReinforcement } from './reinforcement/column-reinforcement-types';
import type { BeamReinforcement } from './reinforcement/beam-reinforcement-types';
import type { SlabFoundationReinforcement } from './reinforcement/slab-foundation-reinforcement-types';
import { resolveActiveColumnReinforcement, resolveActiveBeamReinforcement, resolveActiveSlabReinforcement } from './section-context';
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

/**
 * ADR-471 — `resolveActiveBeamReinforcement` με τον ενεργό κανονισμό από το settings store.
 * Fast-path: manual/absent → επιστρέφει το stored χωρίς να αγγίξει τον provider. Δέχεται
 * `BeamEntity` (όχι params) γιατί το άνοιγμα = derived `geometry.length` (geometry-is-SSoT).
 */
export function resolveActiveBeamReinforcementForEntity(
  beam: Pick<BeamEntity, 'params' | 'geometry'>,
): BeamReinforcement | undefined {
  if (!beam.params.reinforcement?.auto) return beam.params.reinforcement;
  const provider = resolveStructuralCode(useStructuralSettingsStore.getState().codeId);
  return resolveActiveBeamReinforcement(beam, provider);
}

/**
 * ADR-476 — `resolveActiveSlabReinforcement` με τον ενεργό κανονισμό από το settings store.
 * Fast-path: manual/absent → επιστρέφει το stored χωρίς να αγγίξει τον provider. Δέχεται
 * `SlabEntity` (το context εξαρτάται από params + geometry.maxFreeSpanM — geometry-is-SSoT).
 */
export function resolveActiveSlabReinforcementForEntity(
  slab: SlabEntity,
): SlabFoundationReinforcement | undefined {
  if (!slab.params.structuralReinforcement?.auto) return slab.params.structuralReinforcement;
  const provider = resolveStructuralCode(useStructuralSettingsStore.getState().codeId);
  return resolveActiveSlabReinforcement(slab, provider);
}
