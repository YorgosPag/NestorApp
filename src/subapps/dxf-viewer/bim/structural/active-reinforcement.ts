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
import { SlabSupportConditionStore } from './organism/slab-support-condition-store';
import { BeamTorsionStore } from './organism/beam-torsion-store';
import { BeamSpanStore } from './organism/beam-span-store';
import type { SlabSupportCondition } from './loads/slab-beam-support';
import { resolveBeamRebarLayout, type BeamRebarLayout } from './reinforcement/beam-rebar-layout';
// ADR-491 — DERIVED FEM ροπή φορέα (πρόβολος → wL²/2 στη στήριξη), engaged-gated μέσω
// του ΕΝΟΣ SSoT `resolveEngagedAnalysisResult` (μηδέν διπλό gate με τον auto-reinforce core).
import { resolveColumnFemMomentKnm } from './analytical/column-fem-moment';
// ADR-502 §Slice2 — DERIVED στατική ροπή στηρίζουσας κολώνας από δοκάρι-πρόβολο (always-on).
import { ColumnSupportMomentStore } from './organism/column-support-moment-store';
// ADR-497 — DERIVED FEM αξονικό βάσης κολώνας (πρόβολος → αντίδραση), engaged-gated.
import { resolveColumnFemAxial, type ColumnFemAxial } from './analytical/column-fem-axial';
import { resolveEngagedAnalysisResult } from './analytical/engaged-analysis-result';
import type { Entity } from '../../types/entities';
import { isFoundationEntity, isColumnEntity } from '../../types/entities';
import { resolveSupportingColumn } from './footing-design/footing-support-column';

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
 * ADR-502 §Slice2 — η **ροπή σχεδιασμού** (kNm) μιας κολώνας με ιεραρχία **ΕΝΟΣ οργανισμού**:
 * το engaged-gated FEM (ADR-491, ακριβές πλαισιακό) **υπερισχύει**· αλλιώς πέφτει στη
 * **στατική** ροπή στηρίζουσας-προβόλου (`ColumnSupportMomentStore`, always-on, ντετερμινιστική).
 * `undefined` όταν καμία από τις δύο → η κολώνα επανέρχεται στην ονομαστική e₀ (μηδέν regression).
 *
 * ΕΝΑ SSoT ροπής σχεδιασμού: τη μοιράζονται sizing (`AutoSizeMembersCommand`), reinforce
 * (`resolveActiveColumnReinforcementForEntity`), feasibility + utilization overlay — μηδέν
 * παράλληλη διπλή αλήθεια (γι' αυτό το όραμα μιλά για ΕΝΑΝ οργανισμό, ADR-487 §3).
 */
export function resolveActiveColumnDesignMoment(columnId: string): number | undefined {
  return resolveActiveColumnFemMoment(columnId) ?? ColumnSupportMomentStore.get(columnId);
}

/**
 * ADR-499 (Slice D) / ADR-502 §Slice2 — `Map<columnId → ροπή σχεδιασμού (kNm)>` για ΟΛΕΣ
 * τις κολώνες της σκηνής, με την ιεραρχία `resolveActiveColumnDesignMoment` (engaged FEM ??
 * static πρόβολος). Ο **pure** feasibility runner (`runFeasibilityChecks`) το παίρνει ώστε ο
 * έλεγχος «ανέφικτη διατομή στο μέγιστο» να χρησιμοποιεί την ΙΔΙΑ ροπή με τον auto-sizer
 * (`AutoSizeMembersCommand`· μηδέν διπλή αλήθεια). Mirror του `buildActiveFootingFemAxialMap`:
 * το store coupling ζει εδώ, ΟΧΙ μέσα στον runner. Κενό → nominal e₀ fallback μέσα στον
 * context builder. Pure store read (ADR-040 safe).
 */
export function buildActiveColumnDesignMomentMap(
  entities: readonly Entity[],
): ReadonlyMap<string, number> {
  const map = new Map<string, number>();
  for (const e of entities) {
    if (!isColumnEntity(e)) continue;
    const moment = resolveActiveColumnDesignMoment(e.id);
    if (moment !== undefined) map.set(e.id, moment);
  }
  return map;
}

/**
 * ADR-497 — το DERIVED FEM αξονικό βάσης (SLS/ULS, kN) μιας κολώνας, **engaged-gated**
 * (μηδέν override εκτός engaged → tributary fallback). Mirror του `resolveActiveColumnFemMoment`·
 * κοινό engaged gate (`resolveEngagedAnalysisResult`). Pure store read (ADR-040 safe).
 */
export function resolveActiveColumnFemAxial(columnId: string): ColumnFemAxial | undefined {
  return resolveColumnFemAxial(resolveEngagedAnalysisResult(), columnId);
}

/**
 * ADR-497 — η DERIVED FEM αντίδραση βάσης (SLS/ULS, kN) που η **στηρίζουσα κολώνα**
 * παραδίδει στο πέδιλο, engaged-gated. Βρίσκει την κολώνα μέσω του explicit FK
 * `ColumnParams.footingId` (organism, ίδιο pattern με `resolveSupportingColumnDims`).
 * `undefined` (χωρίς attached κολώνα / εκτός engaged / μηδέν φορτίο) → tributary fallback.
 */
export function resolveActiveFootingFemAxial(
  footingId: string,
  entities: readonly Entity[],
): ColumnFemAxial | undefined {
  const column = resolveSupportingColumn(footingId, entities);
  return column ? resolveActiveColumnFemAxial(column.id) : undefined;
}

/**
 * ADR-497 — `Map<footingId → ColumnFemAxial>` για ΟΛΑ τα pad πέδιλα της σκηνής (engaged-gated).
 * Ο diagnostics runner (`runFootingDesignChecks`) το παίρνει pure ώστε να μένει unit-testable
 * (το store coupling ζει εδώ, ΟΧΙ μέσα στον pure runner). Κενό εκτός engaged → tributary fallback.
 */
export function buildActiveFootingFemAxialMap(
  entities: readonly Entity[],
): ReadonlyMap<string, ColumnFemAxial> {
  const map = new Map<string, ColumnFemAxial>();
  for (const e of entities) {
    if (!isFoundationEntity(e) || e.params.kind !== 'pad') continue;
    const axial = resolveActiveFootingFemAxial(e.id, entities);
    if (axial) map.set(e.id, axial);
  }
  return map;
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
  return resolveActiveColumnReinforcement(column.params, provider, resolveActiveColumnDesignMoment(column.id));
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
  // ADR-499 §6.3-c — + DERIVED στρέψη (πρόβολος-πλάκα) ώστε ο live 2Δ/3Δ οπλισμός να δείχνει
  // τους στρεπτικούς κλειστούς συνδετήρες + γωνιακούς διαμήκεις (μηδέν αλλαγή render path).
  // ADR-504 Φ2 — + DERIVED υπο-άνοιγμα συνεχούς δοκού (ροπή/βέλος από max sub-span).
  return resolveActiveBeamReinforcement(
    beam, provider, resolveActiveBeamSupportType(beam.id), resolveActiveBeamTorsion(beam.id),
    resolveActiveBeamSpanMm(beam.id),
  );
}

/**
 * ADR-486 — ο DERIVED topology-aware τύπος στήριξης ενός δοκαριού από το transient store
 * (γράφεται στο organism pass). `undefined` → fallback stored στον consumer. Pure store read.
 */
export function resolveActiveBeamSupportType(beamId: string): BeamSupportType | undefined {
  return BeamSupportConditionStore.get(beamId);
}

/**
 * ADR-504 Φ2 — το DERIVED **άνοιγμα διαστασιολόγησης** ενός δοκαριού από το transient
 * `BeamSpanStore` (γράφεται στο organism pass από `buildBeamSpanModelMap`): το max καθαρό
 * υπο-άνοιγμα όταν συνεχής (≥1 ενδιάμεση στήριξη). `undefined` → ο consumer πέφτει στο πλήρες
 * `geometry.length` (μηδέν regression). Pure store read (ADR-040 safe). Mirror
 * `resolveActiveBeamSupportType` — ζευγαρώνουν (continuous type ↔ sub-span).
 */
export function resolveActiveBeamSpanMm(beamId: string): number | undefined {
  return BeamSpanStore.get(beamId);
}

/**
 * ADR-499 §6.3 — η DERIVED στρεπτική ροπή σχεδιασμού `T_Ed` (kNm) μιας δοκού από το transient
 * `BeamTorsionStore` (γράφεται στο organism pass από `computeBeamDesignTorsion`). `undefined`
 * → καμία πρόβολος-πλάκα τη στρίβει (μηδέν στρέψη) → ο consumer (sizing/οπλισμός) δεν προσθέτει
 * στρεπτικό όρο (μηδέν regression). Pure store read (ADR-040 safe). Mirror του
 * `resolveActiveBeamSupportType`.
 */
export function resolveActiveBeamTorsion(beamId: string): number | undefined {
  return BeamTorsionStore.get(beamId);
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
 * ADR-498 — η DERIVED topology-aware συνθήκη στήριξης μιας πλάκας (πρόβολος → hogging) από το
 * transient `SlabSupportConditionStore` (synchronous, ADR-040 safe). `undefined` → fallback
 * 'simple' στον consumer. Mirror του `resolveActiveBeamSupportType`.
 */
export function resolveActiveSlabSupportCondition(slabId: string): SlabSupportCondition | undefined {
  return SlabSupportConditionStore.get(slabId);
}

/**
 * ADR-476 — `resolveActiveSlabReinforcement` με τον ενεργό κανονισμό από το settings store.
 * Fast-path: manual/absent → επιστρέφει το stored χωρίς να αγγίξει τον provider.
 *
 * ADR-498 — διαβάζει τη DERIVED συνθήκη στήριξης (`SlabSupportConditionStore`) και την περνά
 * ως override → ο πρόβολος (1 φέρουσα δοκός) οπλίζεται με `q·L²/2` στην **άνω** σχάρα. Store
 * miss (πλάκα εκτός οργανισμού) → fallback 'simple' (μηδέν regression).
 */
export function resolveActiveSlabReinforcementForEntity(
  slab: SlabEntity,
): SlabFoundationReinforcement | undefined {
  if (!slab.params.structuralReinforcement?.auto) return slab.params.structuralReinforcement;
  const provider = resolveStructuralCode(useStructuralSettingsStore.getState().codeId);
  return resolveActiveSlabReinforcement(slab, provider, resolveActiveSlabSupportCondition(slab.id));
}
