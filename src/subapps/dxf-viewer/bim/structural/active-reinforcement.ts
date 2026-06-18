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

import type { ColumnEntity, ColumnParams } from '../types/column-types';
import type { BeamEntity } from '../types/beam-types';
import type { SlabEntity } from '../types/slab-types';
import type { ColumnReinforcement } from './reinforcement/column-reinforcement-types';
import type { BeamReinforcement } from './reinforcement/beam-reinforcement-types';
import type { SlabFoundationReinforcement } from './reinforcement/slab-foundation-reinforcement-types';
import {
  resolveActiveColumnReinforcement,
  resolveActiveBeamReinforcement,
  resolveActiveSlabReinforcement,
  buildBeamSectionContext,
} from './section-context';
import { resolveStructuralCode } from './codes';
import { useStructuralSettingsStore } from '../../state/structural-settings-store';
// ADR-486 — DERIVED topology-aware τύπος στήριξης δοκαριού (πρόβολος όταν 1 στήριξη).
import type { BeamSupportType } from '../types/beam-types';
import { BeamSupportConditionStore } from './organism/beam-support-condition-store';
import { resolveBeamRebarLayout, type BeamRebarLayout } from './reinforcement/beam-rebar-layout';
// ADR-491 — DERIVED FEM ροπή φορέα (πρόβολος → wL²/2 στη στήριξη), engaged-gated μέσω
// του ΕΝΟΣ SSoT `resolveEngagedAnalysisResult` (μηδέν διπλό gate με τον auto-reinforce core).
import { resolveColumnFemMomentKnm } from './analytical/column-fem-moment';
import { resolveEngagedAnalysisResult } from './analytical/engaged-analysis-result';

/**
 * `resolveActiveColumnReinforcement` με τον ενεργό κανονισμό από το settings store.
 * Fast-path: manual/absent → επιστρέφει το stored χωρίς να αγγίξει τον provider.
 *
 * **Graphless fallback (μηδέν FEM):** δεν διαθέτει `id` → δεν διαβάζει τη FEM ροπή· σχεδιάζει
 * με την ονομαστική e₀ μόνο. Χρησιμοποιείται μόνο όπου ΔΕΝ υπάρχει entity id (π.χ. ghost drag).
 * Οι κανονικοί renderers/overlay χρησιμοποιούν το `…ForEntity` (FEM-aware, ADR-491).
 */
export function resolveActiveColumnReinforcementForParams(
  params: ColumnParams,
): ColumnReinforcement | undefined {
  if (!params.reinforcement?.auto) return params.reinforcement;
  const provider = resolveStructuralCode(useStructuralSettingsStore.getState().codeId);
  return resolveActiveColumnReinforcement(params, provider);
}

/**
 * ADR-491 — η DERIVED FEM ροπή σχεδιασμού (kNm) μιας κολόνας από το `AnalysisResultsStore`,
 * **engaged-gated** (Revit «analytical results enabled»): επιστρέφει τη ροπή ΜΟΝΟ όταν ο
 * μηχανικός «παρατηρεί στατικά» (`isAnalysisEngaged`, ADR-488). Εκτός engaged → `undefined`
 * → η κολώνα επανέρχεται στην ονομαστική e₀ (αποφυγή stale FEM influence όταν κλείσουν τα
 * overlays). Mirror του `resolveActiveBeamSupportType`. Το engaged gate ζει στο ΕΝΑ SSoT
 * `resolveEngagedAnalysisResult` (κοινό με τον persisted path). Pure store read (ADR-040 safe).
 */
export function resolveActiveColumnFemMoment(columnId: string): number | undefined {
  return resolveColumnFemMomentKnm(resolveEngagedAnalysisResult(), columnId);
}

/**
 * ADR-491 — `resolveActiveColumnReinforcement` με τον ενεργό κανονισμό + τη **FEM ροπή του
 * φορέα** (πρόβολος → `wL²/2` στη στήριξη) από το engaged-gated `resolveActiveColumnFemMoment`.
 * Χρειάζεται `id` για το store lookup (οι renderers/overlays περνούν full `ColumnEntity`).
 * Fast-path: manual/absent → stored χωρίς provider. Mirror του `resolveActiveBeamReinforcementForEntity`.
 */
export function resolveActiveColumnReinforcementForEntity(
  column: Pick<ColumnEntity, 'id' | 'params'>,
): ColumnReinforcement | undefined {
  if (!column.params.reinforcement?.auto) return column.params.reinforcement;
  const provider = resolveStructuralCode(useStructuralSettingsStore.getState().codeId);
  return resolveActiveColumnReinforcement(column.params, provider, resolveActiveColumnFemMoment(column.id));
}

/**
 * ADR-471 — `resolveActiveBeamReinforcement` με τον ενεργό κανονισμό από το settings store.
 * Fast-path: manual/absent → επιστρέφει το stored χωρίς να αγγίξει τον provider. Δέχεται
 * `BeamEntity` (όχι params) γιατί το άνοιγμα = derived `geometry.length` (geometry-is-SSoT).
 *
 * ADR-486 — διαβάζει τον DERIVED topology-aware τύπο στήριξης από το `BeamSupportConditionStore`
 * (synchronous, ADR-040 safe) και τον περνά ως override → ο πρόβολος (1 στήριξη) οπλίζεται με
 * `wL²/2`. Store miss (δοκάρι εκτός οργανισμού / πριν το πρώτο pass) → fallback stored.
 * Χρειάζεται `id` για το store lookup (οι renderers/overlays περνούν full `BeamEntity`).
 */
export function resolveActiveBeamReinforcementForEntity(
  beam: Pick<BeamEntity, 'id' | 'params' | 'geometry'>,
): BeamReinforcement | undefined {
  if (!beam.params.reinforcement?.auto) return beam.params.reinforcement;
  const provider = resolveStructuralCode(useStructuralSettingsStore.getState().codeId);
  return resolveActiveBeamReinforcement(beam, provider, resolveActiveBeamSupportType(beam.id));
}

/**
 * ADR-486 — ο DERIVED topology-aware τύπος στήριξης ενός δοκαριού από το transient store
 * (γράφεται στο organism pass). `undefined` → fallback stored στον consumer. Pure store read.
 */
export function resolveActiveBeamSupportType(beamId: string): BeamSupportType | undefined {
  return BeamSupportConditionStore.get(beamId);
}

/** Ο ενεργός οπλισμός + το layout ράβδων ενός δοκαριού (topology-aware). */
export interface ActiveBeamRebar {
  readonly reinforcement: BeamReinforcement;
  readonly layout: BeamRebarLayout;
}

/**
 * ADR-486 — **ΕΝΑΣ SSoT** για το ζευγάρι «ενεργός οπλισμός + layout ράβδων» ενός δοκαριού,
 * topology-aware. Ενοποιεί το επαναλαμβανόμενο τρίπτυχο (resolve reinforcement → resolve
 * supportType → `buildBeamSectionContext` → `resolveBeamRebarLayout`) που ζούσε copy-paste
 * στους live renderers (2Δ `beam-rebar-2d` + 3Δ `beam-rebar-3d`) → μηδέν διπλότυπο pattern,
 * εγγυημένη parity 2Δ===3Δ. `null` αν δεν υπάρχει ενεργός οπλισμός ή εκφυλισμένη γεωμετρία.
 *
 * Store-coupled (διαβάζει settings + support-condition store)· γι' αυτό ζει εδώ και ΟΧΙ στους
 * pure detail-sheet builders (που παίρνουν `supportType` ως param ώστε να μένουν unit-testable).
 */
export function resolveActiveBeamRebarLayout(
  beam: Pick<BeamEntity, 'id' | 'params' | 'geometry'>,
): ActiveBeamRebar | null {
  const reinforcement = resolveActiveBeamReinforcementForEntity(beam);
  if (!reinforcement) return null;
  const ctx = buildBeamSectionContext(beam, resolveActiveBeamSupportType(beam.id));
  const layout = resolveBeamRebarLayout(ctx, reinforcement);
  return layout ? { reinforcement, layout } : null;
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
