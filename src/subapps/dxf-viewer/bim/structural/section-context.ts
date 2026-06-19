/**
 * Entity → structural section-context SSoT (ADR-459 Phase 4d).
 *
 * ΕΝΑ μέρος που χτίζει το `…SectionContext` (mm/mm²) που χρειάζονται οι code
 * providers (limits + suggest) ΑΠΟ μια δομική οντότητα (κολόνα / δοκάρι / πέδιλο).
 * Πριν το Φ4d ο column builder ζούσε inline στο ribbon bridge (`column-structural-
 * bridge.ts`)· εδώ εξάγεται (boy-scout, N.0.2) ώστε να τον μοιράζονται ΚΑΙ ο
 * bridge, ΚΑΙ τα reinforcement διαγνωστικά (`organism/reinforcement-checks.ts`),
 * ΚΑΙ το `AutoReinforceOrganismCommand` — μηδέν duplicate.
 *
 * geometry-is-SSoT: όλα τα μεγέθη παράγονται από `params` (+ `geometry` cache).
 * Pure — zero React/DOM/Firestore. Όλες οι μετρήσεις σε mm (Nestor convention).
 *
 * @see ./codes/structural-code-types.ts — τα SectionContext schemas
 * @see ./codes/suggest-reinforcement.ts — οι suggesters που τα καταναλώνουν
 * @see docs/centralized-systems/reference/adrs/ADR-459-structural-organism-connectivity.md §Phase 4d
 */

import type { Entity } from '../../types/entities';
import { isColumnEntity, isBeamEntity, isFoundationEntity, isSlabEntity } from '../../types/entities';
import type { ColumnEntity, ColumnParams } from '../types/column-types';
import type { BeamEntity, BeamParams, BeamSupportType } from '../types/beam-types';
import type { FoundationEntity, FoundationParams, PadFootingParams, TieBeamParams } from '../types/foundation-types';
import type { SlabEntity } from '../types/slab-types';
import { combineSls, combineUls, EN1990_ULS_FACTORS } from './loads/load-combinations';
import { isZeroMemberLoad, resolveAppliedMemberLoad } from './loads/structural-loads-types';
import { DEFAULT_CONCRETE_GRADE } from './concrete-grades';
import { nominalColumnMomentKnm } from './codes/suggest-reinforcement';
import { resolveColumnReinforcementSection } from './reinforcement/column-section-outline';
import type { ColumnReinforcement } from './reinforcement/column-reinforcement-types';
import type { BeamReinforcement } from './reinforcement/beam-reinforcement-types';
import type { SlabFoundationReinforcement } from './reinforcement/slab-foundation-reinforcement-types';
import type { TieBeamReinforcement } from './reinforcement/footing-reinforcement-types';
import type {
  BeamSectionContext,
  ColumnSectionContext,
  FootingSectionContext,
  StructuralCodeProvider,
} from './codes/structural-code-types';
// ADR-459 Φ4e/E3 + ADR-476 — slab section-context (N.7.1 file-size split, αυτόνομο module).
// Εισάγεται για τοπική χρήση (member-agnostic facade) ΚΑΙ ξανα-εξάγεται παρακάτω.
import {
  isFoundationSlabEntity,
  isSuspendedSlabEntity,
  resolveSlabReinforcementKind,
  resolveActiveSlabReinforcement,
  buildSlabFoundationSectionContext,
} from './section-context-slab';

const M_TO_MM = 1000;

/** Μήκος άξονα (mm) από δύο σημεία mm-world (πεδιλοδοκός/συνδετήρια). */
function axisLengthMm(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/**
 * ADR-464 — λόγος εκκεντρότητας SLS e/dim (max κατά X/Y) ενός πεδίλου από το
 * εφαρμοζόμενο φορτίο. e = M/N (χαρακτηριστικός συνδυασμός). 0 όταν δεν υπάρχει
 * καθαρό θλιπτικό φορτίο. Καθορίζει αν ο suggester προτείνει άνω σχάρα (kern).
 */
function padEccentricityRatio(params: PadFootingParams): number {
  const load = combineSls(resolveAppliedMemberLoad(params.appliedLoad));
  if (load.axialKn <= 0) return 0;
  const rx = params.width > 0 ? (Math.abs(load.momentXKnm) / load.axialKn) * M_TO_MM / params.width : 0;
  const ry = params.length > 0 ? (Math.abs(load.momentYKnm) / load.axialKn) * M_TO_MM / params.length : 0;
  return Math.max(rx, ry);
}

/**
 * Κολόνα → `ColumnSectionContext`. shape-aware (ADR-460): bbox dims + ελάχιστο
 * πάχος/μέγιστη διάσταση/περίμετρος/mode από το ΕΝΑ `resolveColumnReinforcementSection`
 * → δουλεύει ορθά σε ορθογ./κυκλική/τοίχωμα. (SSoT — πρώην inline στο
 * `column-structural-bridge`· εξήχθη εδώ, N.0.2.)
 */
export function buildColumnSectionContext(
  column: ColumnEntity,
  designMomentOverrideKnm?: number,
): ColumnSectionContext {
  return buildColumnSectionContextFromParams(column.params, designMomentOverrideKnm);
}

/**
 * Params-based variant (το context εξαρτάται ΜΟΝΟ από params — geometry-is-SSoT).
 *
 * ADR-491 — `designMomentOverrideKnm` (προαιρετικό): η **πραγματική ροπή του φορέα** (FEM
 * end-moment, π.χ. `wL²/2` προβόλου στη στήριξη) που υπερισχύει της ονομαστικής e₀ όταν
 * είναι μεγαλύτερη. Mirror του beam `supportTypeOverride`: ο caller με πρόσβαση στο FEM store
 * (proactive reinforce / render path) παράγει & περνά τον override· οι graphless callers
 * (isolated tests/BOQ) πέφτουν στην e₀ — μηδέν regression. Η συνάρτηση μένει **pure**.
 */
export function buildColumnSectionContextFromParams(
  params: ColumnParams,
  designMomentOverrideKnm?: number,
): ColumnSectionContext {
  const section = resolveColumnReinforcementSection(params);
  return {
    widthMm: section.bboxWidthMm,
    depthMm: section.bboxDepthMm,
    heightMm: params.height,
    grossAreaMm2: section.grossAreaMm2,
    minThicknessMm: section.minThicknessMm,
    maxDimensionMm: section.maxDimensionMm,
    perimeterMm: section.perimeterMm,
    mode: section.mode,
    ...resolveColumnDesignLoad(params, section.minThicknessMm, designMomentOverrideKnm),
  };
}

/**
 * ADR-472 — load-aware συνιστώσες του ColumnSectionContext από το `appliedLoad`
 * (μηδενικό/απών ⇒ κενό ⇒ ο suggester μένει min-detailing, μηδέν regression). ULS
 * αξονικό N_Ed μέσω του SSoT `EN1990_ULS_FACTORS` (params-is-SSoT — ο builder είναι
 * provider-agnostic, οι συντελεστές είναι ΕΝΑ standard για όλους τους κώδικες).
 *
 * ADR-472 S4 — επιπλέον **αυτόματη** ονομαστική ροπή `M_Ed = N_Ed·e₀` (EC2 §6.1(4),
 * SSoT `nominalColumnMomentKnm`)· `e₀` από το βάθος διατομής (ασθενής άξονας =
 * `minThicknessMm`, conservative). Μηδέν input μηχανικού (Revit-grade auto-sizing).
 *
 * ADR-491 — `designMomentOverrideKnm` (FEM end-moment του φορέα): `M_Ed = max(N_Ed·e₀, M_FEM)`
 * — superposition, ΟΧΙ διπλομέτρηση (η e₀ = κατώφλι, η FEM = πραγματική ροπή). Το αξονικό N
 * παραμένει από tributary (ο FEM v1 δεν δίνει gravity column axial αξιόπιστα, ADR-481). Όταν
 * το tributary είναι μηδενικό αλλά υπάρχει FEM ροπή (πρόβολος σε αφόρτιστη-tributary κολώνα),
 * σχεδιάζουμε ΚΑΘΑΡΑ για τη ροπή ώστε η κολώνα να μη μένει ανεπαρκής (ΟΡΑΜΑ §4 «σε κάθε κίνηση»).
 */
function resolveColumnDesignLoad(
  params: ColumnParams,
  sectionDepthMm: number,
  designMomentOverrideKnm?: number,
): Pick<ColumnSectionContext, 'designAxialKn' | 'concreteGrade' | 'designMomentKnm'> {
  const load = resolveAppliedMemberLoad(params.appliedLoad);
  const femMomentKnm = designMomentOverrideKnm && designMomentOverrideKnm > 0 ? designMomentOverrideKnm : 0;
  if (isZeroMemberLoad(load)) {
    return femMomentKnm > 0
      ? { concreteGrade: params.concreteGrade ?? DEFAULT_CONCRETE_GRADE, designMomentKnm: femMomentKnm }
      : {};
  }
  const designAxialKn = combineUls(load, EN1990_ULS_FACTORS).axialKn;
  return {
    designAxialKn,
    concreteGrade: params.concreteGrade ?? DEFAULT_CONCRETE_GRADE,
    designMomentKnm: Math.max(nominalColumnMomentKnm(designAxialKn, sectionDepthMm), femMomentKnm),
  };
}

/**
 * ADR-456/460 (Giorgio 2026-06-16) — **ο «ενεργός» οπλισμός μιας κολόνας** = το design
 * που πρέπει να σχεδιαστεί/μετρηθεί/ελεγχθεί ΤΩΡΑ:
 *   - absent           → `undefined` (δεν έχει οριστεί οπλισμός· κανείς δεν ζωγραφίζει).
 *   - manual (`!auto`) → το stored design ως έχει (κλειδωμένο, ο χρήστης το όρισε).
 *   - auto (`auto`)    → **φρέσκο code-suggested design από την ΤΡΕΧΟΥΣΑ γεωμετρία** →
 *                        αλλαγή διαστάσεων ⇒ real-time επανυπολογισμός (Revit «by code»).
 *
 * Διατηρεί τις καθαρά-detailing προτιμήσεις (τύπος συνδετήρα + μοτίβο cross-tie) που δεν
 * αλλάζουν διαμήκη/ρ — ώστε η περιστροφή/resize να μην τις «σβήνει». Pure (provider arg)
 * ⇒ unit-testable.
 *
 * ADR-491 — `designMomentOverrideKnm` (FEM end-moment): ο πρόβολος μεταφέρει `wL²/2` στη
 * στήριξη → η κολώνα οπλίζεται γι' αυτή τη ροπή (max με e₀). Οι renderers/overlay
 * χρησιμοποιούν το store+engaged-coupled `resolveActiveColumnReinforcementForEntity`
 * (active-reinforcement.ts) που διαβάζει τη ροπή από το FEM store· το `…ForParams` μένει
 * graphless fallback (μηδέν FEM).
 */
export function resolveActiveColumnReinforcement(
  params: ColumnParams,
  provider: StructuralCodeProvider,
  designMomentOverrideKnm?: number,
): ColumnReinforcement | undefined {
  const r = params.reinforcement;
  if (!r || !r.auto) return r;
  const fresh = provider.suggestColumnReinforcement(
    buildColumnSectionContextFromParams(params, designMomentOverrideKnm),
  );
  return {
    ...fresh,
    auto: true,
    stirrups: { ...fresh.stirrups, type: r.stirrups.type },
    ...(r.crossTiePattern ? { crossTiePattern: r.crossTiePattern } : {}),
  };
}

/**
 * Δοκάρι → `BeamSectionContext`. Το άνοιγμα = γεωμετρικό μήκος άξονα (m→mm,
 * curve-aware). `supportType` default 'simple' (απών = αμφιέρειστη).
 *
 * ADR-471 — δέχεται `Pick<…,'params'|'geometry'>` (geometry-is-SSoT: εξαρτάται ΜΟΝΟ
 * από params + geometry.length) ώστε να καλείται και με το DXF beam wrapper των 2Δ/3Δ
 * renderers (που δεν φέρει IFC mixin) χωρίς cast. Full `BeamEntity` ικανοποιεί το Pick.
 *
 * ADR-486 — `supportTypeOverride` (προαιρετικό): ο **topology-aware** τύπος στήριξης
 * (DERIVED από τη ζωντανή συνδεσιμότητα, π.χ. πρόβολος όταν 1 στήριξη) που υπερισχύει
 * του stored. Απών → η προηγούμενη συμπεριφορά (stored ?? 'simple'). Η συνάρτηση μένει
 * **pure**: ο caller που έχει τον graph (organism/checks/auto-reinforce) παράγει & περνά
 * τον override· οι graphless callers (isolated tests/BOQ) πέφτουν στο stored — μηδέν regression.
 *
 * ADR-499 §6.3 — `designTorsionKnm` (προαιρετικό): η DERIVED στρεπτική ροπή `T_Ed` (kNm)
 * από μονόπλευρη πρόβολο-πλάκα. Absent/≤0 → καμία στρέψη (μηδέν regression). Ίδιο pattern
 * με το `supportTypeOverride`: ο caller με τον graph (organism) την παράγει & περνά.
 *
 * ADR-504 Φ2 — `sizingSpanOverrideMm` (προαιρετικό): το **μέγιστο καθαρό υπο-άνοιγμα**
 * ενός **συνεχούς** δοκού (`deriveBeamSpanModel`), όταν υπάρχουν ενδιάμεσες στηρίξεις.
 * Υπερισχύει του πλήρους μήκους **μόνο για ροπή/βέλος** (`spanMm`)· το γραμμικό φορτίο w
 * (kN/m) μένει από το ΠΛΗΡΕΣ άνοιγμα (το φορτίο ανά μέτρο δεν αλλάζει — αλλάζει μόνο το
 * μήκος που κάμπτει). Absent/≤0 → πλήρες μήκος (μηδέν regression). Ίδιο pattern override.
 */
export function buildBeamSectionContext(
  beam: Pick<BeamEntity, 'params' | 'geometry'>,
  supportTypeOverride?: BeamSupportType,
  designTorsionKnm?: number,
  sizingSpanOverrideMm?: number,
): BeamSectionContext {
  const p = beam.params;
  const fullSpanMm = beam.geometry.length * M_TO_MM;
  const spanMm =
    sizingSpanOverrideMm !== undefined && sizingSpanOverrideMm > 0 ? sizingSpanOverrideMm : fullSpanMm;
  return {
    widthMm: p.width,
    depthMm: p.depth,
    spanMm,
    grossAreaMm2: Math.max(0, p.width) * Math.max(0, p.depth),
    supportType: supportTypeOverride ?? p.supportType ?? 'simple',
    ...resolveBeamDesignLoad(p, fullSpanMm),
    ...(designTorsionKnm !== undefined && designTorsionKnm > 0 ? { designTorsionKnm } : {}),
  };
}

/**
 * ADR-472 — γραμμικό φορτίο σχεδιασμού w_Ed (kN/m) του δοκαριού από το tributary
 * `appliedLoad`. Το load-path (ADR-467) αποθηκεύει το ΣΥΝΟΛΙΚΟ tributary φορτίο της
 * δοκού ως αξονικές G/Q συνιστώσες (kN)· w_Ed = W_Ed(ULS) / άνοιγμα. Μηδενικό φορτίο
 * ή μη-θετικό άνοιγμα ⇒ κενό ⇒ min-detailing (μηδέν regression).
 */
function resolveBeamDesignLoad(
  params: BeamParams,
  spanMm: number,
): Pick<BeamSectionContext, 'designLineLoadKnM'> {
  if (spanMm <= 0) return {};
  const load = resolveAppliedMemberLoad(params.appliedLoad);
  if (isZeroMemberLoad(load)) return {};
  const totalUlsKn = combineUls(load, EN1990_ULS_FACTORS).axialKn;
  return { designLineLoadKnM: totalUlsKn / (spanMm / M_TO_MM) };
}

/**
 * ADR-471 (parity με κολόνα) — **ο «ενεργός» οπλισμός μιας δοκού** = το design που πρέπει
 * να σχεδιαστεί/μετρηθεί/ελεγχθεί ΤΩΡΑ:
 *   - absent           → `undefined` (δεν έχει οριστεί οπλισμός· κανείς δεν ζωγραφίζει).
 *   - manual (`!auto`) → το stored design ως έχει (κλειδωμένο, ο χρήστης το όρισε).
 *   - auto (`auto`)    → **φρέσκο code-suggested design από την ΤΡΕΧΟΥΣΑ γεωμετρία** (span =
 *                        derived `beam.geometry.length`) → resize ⇒ real-time επανυπολογισμός.
 *
 * Διατηρεί τις καθαρά-detailing προτιμήσεις (τύπος συνδετήρα + σκέλη) που δεν αλλάζουν
 * διαμήκη/ρ. Pure (provider arg) ⇒ unit-testable· οι renderers χρησιμοποιούν το
 * store-coupled `resolveActiveBeamReinforcementForEntity` (active-reinforcement.ts).
 */
export function resolveActiveBeamReinforcement(
  beam: Pick<BeamEntity, 'params' | 'geometry'>,
  provider: StructuralCodeProvider,
  supportTypeOverride?: BeamSupportType,
  designTorsionKnm?: number,
  sizingSpanOverrideMm?: number,
): BeamReinforcement | undefined {
  const r = beam.params.reinforcement;
  if (!r || !r.auto) return r;
  // ADR-499 §6.3-c — η DERIVED στρέψη (πρόβολος-πλάκα) προστίθεται στον code-suggested
  // οπλισμό (γωνιακοί A_sl + πυκνότεροι κλειστοί συνδετήρες A_st/s) μέσα στον suggester.
  // ADR-504 Φ2 — `sizingSpanOverrideMm`: συνεχής δοκός → ροπή από υπο-άνοιγμα (wL_sub²/10).
  const fresh = provider.suggestBeamReinforcement(
    buildBeamSectionContext(beam, supportTypeOverride, designTorsionKnm, sizingSpanOverrideMm),
  );
  return {
    ...fresh,
    auto: true,
    stirrups: {
      ...fresh.stirrups,
      type: r.stirrups.type,
      ...(r.stirrups.legs ? { legs: r.stirrups.legs } : {}),
    },
  };
}

/**
 * ADR-471 §2 — member-agnostic facade: ο ΕΝΕΡΓΟΣ οπλισμός ΟΠΟΙΟΥΔΗΠΟΤΕ δομικού
 * μέλους (κολόνα/δοκάρι/πλάκα) με ΜΙΑ κλήση — δρομολογεί στο type-specific
 * `resolveActive{Column,Beam,Slab}Reinforcement`. Function overloads (N.2 — μηδέν cast):
 * ο caller παίρνει τον ακριβή τύπο μετά από type-guard narrow. Μη-οπλίσιμο μέλος → `undefined`.
 *
 * Consumer: organism `reinforcement-checks` (ρ-check/continuity) — ώστε ΟΛΑ τα μέλη
 * να διαβάζουν το ACTIVE design ομοιόμορφα (auto → φρέσκο code-suggested από την
 * τρέχουσα γεωμετρία, ΟΧΙ stored snapshot). Pure (provider arg) ⇒ unit-testable.
 */
export function resolveActiveMemberReinforcement(
  entity: ColumnEntity,
  provider: StructuralCodeProvider,
): ColumnReinforcement | undefined;
export function resolveActiveMemberReinforcement(
  entity: BeamEntity,
  provider: StructuralCodeProvider,
  supportTypeOverride?: BeamSupportType,
  designTorsionKnm?: number,
  sizingSpanOverrideMm?: number,
): BeamReinforcement | undefined;
export function resolveActiveMemberReinforcement(
  entity: SlabEntity,
  provider: StructuralCodeProvider,
): SlabFoundationReinforcement | undefined;
export function resolveActiveMemberReinforcement(
  entity: Entity,
  provider: StructuralCodeProvider,
  supportTypeOverride?: BeamSupportType,
  designTorsionKnm?: number,
  sizingSpanOverrideMm?: number,
): ColumnReinforcement | BeamReinforcement | SlabFoundationReinforcement | undefined;
export function resolveActiveMemberReinforcement(
  entity: Entity,
  provider: StructuralCodeProvider,
  supportTypeOverride?: BeamSupportType,
  designTorsionKnm?: number,
  sizingSpanOverrideMm?: number,
): ColumnReinforcement | BeamReinforcement | SlabFoundationReinforcement | undefined {
  if (isColumnEntity(entity)) return resolveActiveColumnReinforcement(entity.params, provider);
  // ADR-486/504 — ο topology-aware τύπος στήριξης + το υπο-άνοιγμα συνεχούς δοκού υπερισχύουν.
  if (isBeamEntity(entity)) {
    return resolveActiveBeamReinforcement(
      entity, provider, supportTypeOverride, designTorsionKnm, sizingSpanOverrideMm,
    );
  }
  if (isSlabEntity(entity)) return resolveActiveSlabReinforcement(entity, provider);
  // ADR-477 — συνδετήρια δοκός = δοκός: ENΕΡΓΟΣ οπλισμός (auto-aware, parity κολόνας/δοκού)·
  // επιστρέφει `TieBeamReinforcement` (⊂ BeamReinforcement → assignable στο union).
  if (isFoundationEntity(entity) && entity.params.kind === 'tie-beam') {
    return resolveActiveTieBeamReinforcement(entity.params, provider);
  }
  return undefined;
}

/**
 * ADR-477 (parity με δοκάρι) — **ο «ενεργός» οπλισμός μιας συνδετήριας δοκού** = το design
 * που πρέπει να σχεδιαστεί/μετρηθεί/ελεγχθεί ΤΩΡΑ:
 *   - absent / non-auto → το stored design ως έχει (απών → undefined· manual → κλειδωμένο).
 *   - auto (`auto`)     → **φρέσκο code-suggested design από την ΤΡΕΧΟΥΣΑ γεωμετρία** (άνοιγμα =
 *                         derived axis start→end) → resize ⇒ real-time επανυπολογισμός (Revit «by code»).
 *
 * Μια συνδετήρια δοκός ΕΙΝΑΙ δοκός → ο suggester delegate-άρει στο beam· εδώ διατηρούμε τις
 * καθαρά-detailing προτιμήσεις (τύπος συνδετήρα + σκέλη) ώστε το resize να μην τις σβήνει.
 * Pure (provider arg) ⇒ unit-testable· οι renderers χρησιμοποιούν το store-coupled
 * `resolveActiveFootingReinforcementForParams` (active-footing-reinforcement.ts).
 */
export function resolveActiveTieBeamReinforcement(
  params: TieBeamParams,
  provider: StructuralCodeProvider,
): TieBeamReinforcement | undefined {
  const r = params.reinforcement;
  if (!r || r.kind !== 'tie-beam') return undefined;
  if (!r.auto) return r;
  const fresh = provider.suggestFootingReinforcement(buildFootingSectionContextFromParams(params));
  if (fresh.kind !== 'tie-beam') return r;
  return {
    ...fresh,
    auto: true,
    stirrups: {
      ...fresh.stirrups,
      type: r.stirrups.type,
      ...(r.stirrups.legs ? { legs: r.stirrups.legs } : {}),
    },
  };
}

/**
 * Πέδιλο/πεδιλοδοκός/συνδετήρια → discriminated `FootingSectionContext`. pad =
 * ορθογώνιο ίχνος width×length· strip/tie-beam = band πλάτους width κατά τον
 * άξονα start→end (tie-beam ΕΙΝΑΙ δοκός → reuse beam ctx fields).
 */
export function buildFootingSectionContext(footing: FoundationEntity): FootingSectionContext {
  return buildFootingSectionContextFromParams(footing.params);
}

/**
 * Params-based variant (το context εξαρτάται ΜΟΝΟ από params — geometry-is-SSoT· ο
 * άξονας start→end φέρει το άνοιγμα). Το χρησιμοποιεί ο tie-beam active resolver
 * (render path) που δεν κρατά entity. Mirror του `buildColumnSectionContextFromParams`.
 */
export function buildFootingSectionContextFromParams(p: FoundationParams): FootingSectionContext {
  switch (p.kind) {
    case 'pad':
      return {
        kind: 'pad',
        widthMm: p.width,
        lengthMm: p.length,
        thicknessMm: p.thicknessMm,
        grossAreaMm2: Math.max(0, p.width) * Math.max(0, p.length),
        eccentricityRatio: padEccentricityRatio(p),
      };
    case 'strip':
      return {
        kind: 'strip',
        widthMm: p.width,
        thicknessMm: p.thicknessMm,
        spanMm: axisLengthMm(p.start, p.end),
      };
    case 'tie-beam':
      return {
        kind: 'tie-beam',
        widthMm: p.width,
        depthMm: p.thicknessMm,
        spanMm: axisLengthMm(p.start, p.end),
        grossAreaMm2: Math.max(0, p.width) * Math.max(0, p.thicknessMm),
        supportType: 'simple',
        // ADR-477 Slice 3 — η σεισμική δύναμη σύνδεσης τροφοδοτεί As,tie στον suggester.
        ...(p.seismicTieForceKn && p.seismicTieForceKn > 0
          ? { designAxialTieKn: p.seismicTieForceKn }
          : {}),
      };
  }
}

// ADR-459 Φ4e/E3 + ADR-476 — ο slab section-context ζει στο `./section-context-slab.ts`
// (N.7.1 file-size split, αυτόνομο)· ξανα-εξάγεται εδώ ώστε οι callers να συνεχίζουν να
// εισάγουν από το ΕΝΑ `section-context`.
export {
  isFoundationSlabEntity,
  isSuspendedSlabEntity,
  resolveSlabReinforcementKind,
  resolveActiveSlabReinforcement,
  buildSlabFoundationSectionContext,
};
