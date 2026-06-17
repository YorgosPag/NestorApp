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
import type { BeamEntity, BeamParams } from '../types/beam-types';
import type { FoundationEntity, FoundationParams, PadFootingParams, TieBeamParams } from '../types/foundation-types';
import type { SlabEntity } from '../types/slab-types';
import { mmToSceneUnits } from '../../utils/scene-units';
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
  SlabFoundationSectionContext,
  SlabReinforcementKind,
  StructuralCodeProvider,
} from './codes/structural-code-types';

const M_TO_MM = 1000;

/** True αν η πλάκα είναι εδαφόπλακα/raft (kind foundation/ground). */
export function isFoundationSlabEntity(e: Entity): e is SlabEntity {
  return isSlabEntity(e) && (e.kind === 'foundation' || e.kind === 'ground');
}

/** ADR-476 — True αν η πλάκα είναι **αναρτημένη** (kind floor/ceiling/roof). */
export function isSuspendedSlabEntity(e: Entity): e is SlabEntity {
  return isSlabEntity(e) && (e.kind === 'floor' || e.kind === 'ceiling' || e.kind === 'roof');
}

/**
 * ADR-476 — δομική οικογένεια οπλισμού της πλάκας: foundation/ground → 'foundation'
 * (raft, EC2 §9.8.2)· floor/ceiling/roof → 'suspended' (EC2 §9.3.1). ΕΝΑ SSoT mapping.
 */
export function resolveSlabReinforcementKind(slab: SlabEntity): SlabReinforcementKind {
  return slab.kind === 'foundation' || slab.kind === 'ground' ? 'foundation' : 'suspended';
}

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
export function buildColumnSectionContext(column: ColumnEntity): ColumnSectionContext {
  return buildColumnSectionContextFromParams(column.params);
}

/** Params-based variant (το context εξαρτάται ΜΟΝΟ από params — geometry-is-SSoT). */
export function buildColumnSectionContextFromParams(params: ColumnParams): ColumnSectionContext {
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
    ...resolveColumnDesignLoad(params, section.minThicknessMm),
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
 */
function resolveColumnDesignLoad(
  params: ColumnParams,
  sectionDepthMm: number,
): Pick<ColumnSectionContext, 'designAxialKn' | 'concreteGrade' | 'designMomentKnm'> {
  const load = resolveAppliedMemberLoad(params.appliedLoad);
  if (isZeroMemberLoad(load)) return {};
  const designAxialKn = combineUls(load, EN1990_ULS_FACTORS).axialKn;
  return {
    designAxialKn,
    concreteGrade: params.concreteGrade ?? DEFAULT_CONCRETE_GRADE,
    designMomentKnm: nominalColumnMomentKnm(designAxialKn, sectionDepthMm),
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
 * ⇒ unit-testable· οι renderers χρησιμοποιούν το `…ForParams` convenience παρακάτω.
 */
export function resolveActiveColumnReinforcement(
  params: ColumnParams,
  provider: StructuralCodeProvider,
): ColumnReinforcement | undefined {
  const r = params.reinforcement;
  if (!r || !r.auto) return r;
  const fresh = provider.suggestColumnReinforcement(buildColumnSectionContextFromParams(params));
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
 */
export function buildBeamSectionContext(beam: Pick<BeamEntity, 'params' | 'geometry'>): BeamSectionContext {
  const p = beam.params;
  const spanMm = beam.geometry.length * M_TO_MM;
  return {
    widthMm: p.width,
    depthMm: p.depth,
    spanMm,
    grossAreaMm2: Math.max(0, p.width) * Math.max(0, p.depth),
    supportType: p.supportType ?? 'simple',
    ...resolveBeamDesignLoad(p, spanMm),
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
): BeamReinforcement | undefined {
  const r = beam.params.reinforcement;
  if (!r || !r.auto) return r;
  const fresh = provider.suggestBeamReinforcement(buildBeamSectionContext(beam));
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
 * ADR-476 (parity με κολόνα/δοκάρι) — **ο «ενεργός» οπλισμός μιας πλάκας**:
 *   - absent           → `undefined` (δεν έχει οριστεί· κανείς δεν ζωγραφίζει).
 *   - manual (`!auto`) → το stored design ως έχει (κλειδωμένο, ο χρήστης το όρισε).
 *   - auto (`auto`)    → **φρέσκο code-suggested design από την ΤΡΕΧΟΥΣΑ γεωμετρία**
 *                        (πάχος/outline/span/φορτίο) → resize ⇒ real-time re-study.
 * Διατηρεί το `auto:true` flag. Pure (provider arg) ⇒ unit-testable· οι renderers
 * χρησιμοποιούν το store-coupled `resolveActiveSlabReinforcementForEntity`.
 */
export function resolveActiveSlabReinforcement(
  slab: SlabEntity,
  provider: StructuralCodeProvider,
): SlabFoundationReinforcement | undefined {
  const r = slab.params.structuralReinforcement;
  if (!r || !r.auto) return r;
  const fresh = provider.suggestSlabFoundationReinforcement(buildSlabFoundationSectionContext(slab));
  return { ...fresh, auto: true };
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
): BeamReinforcement | undefined;
export function resolveActiveMemberReinforcement(
  entity: SlabEntity,
  provider: StructuralCodeProvider,
): SlabFoundationReinforcement | undefined;
export function resolveActiveMemberReinforcement(
  entity: Entity,
  provider: StructuralCodeProvider,
): ColumnReinforcement | BeamReinforcement | SlabFoundationReinforcement | undefined;
export function resolveActiveMemberReinforcement(
  entity: Entity,
  provider: StructuralCodeProvider,
): ColumnReinforcement | BeamReinforcement | SlabFoundationReinforcement | undefined {
  if (isColumnEntity(entity)) return resolveActiveColumnReinforcement(entity.params, provider);
  if (isBeamEntity(entity)) return resolveActiveBeamReinforcement(entity, provider);
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
      };
  }
}

/**
 * Πλάκα → `SlabFoundationSectionContext` (universal, ADR-459 Φ4e/E3 + ADR-476). bbox
 * dims από το `outline` (canvas units → mm μέσω `sceneUnits`, geometry-is-SSoT — όπως ο
 * graph footprint). Οι σχάρες τρέχουν στο περιβάλλον ορθογώνιο (πλακοειδής σύμβαση).
 * kind-aware: foundation vs suspended· οι αναρτημένες παίρνουν span (από
 * `geometry.maxFreeSpanM`) + φορτίο σχεδιασμού (q_Ed) για strength-driven κάτω σχάρα.
 */
export function buildSlabFoundationSectionContext(slab: SlabEntity): SlabFoundationSectionContext {
  const perScene = mmToSceneUnits(slab.params.sceneUnits ?? 'mm');
  const verts = slab.params.outline.vertices;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const v of verts) {
    if (v.x < minX) minX = v.x;
    if (v.x > maxX) maxX = v.x;
    if (v.y < minY) minY = v.y;
    if (v.y > maxY) maxY = v.y;
  }
  const widthMm = verts.length > 0 ? (maxX - minX) / perScene : 0;
  const lengthMm = verts.length > 0 ? (maxY - minY) / perScene : 0;
  const grossAreaMm2 = Math.max(0, widthMm) * Math.max(0, lengthMm);
  const kind = resolveSlabReinforcementKind(slab);
  return {
    widthMm,
    lengthMm,
    thicknessMm: slab.params.thickness,
    grossAreaMm2,
    kind,
    maxFreeSpanMm: Math.max(0, slab.geometry.maxFreeSpanM) * M_TO_MM,
    concreteGrade: slab.params.concreteGrade ?? DEFAULT_CONCRETE_GRADE,
    ...resolveSlabDesignLoad(slab, grossAreaMm2),
  };
}

/**
 * ADR-476 — φορτίο σχεδιασμού επιφανείας q_Ed (kPa = kN/m², ULS) μιας **αναρτημένης**
 * πλάκας από το tributary `appliedLoad` (ADR-467): q_Ed = W_Ed(ULS)[kN] / area[m²].
 * Μηδενικό/απών φορτίο ή μη-θετικό εμβαδό ⇒ κενό ⇒ min-detailing (μηδέν regression,
 * όπως κολόνα/δοκάρι). Οι εδαφόπλακες αγνοούν το q (raft = εδαφική αντίδραση, §9.8.2).
 */
function resolveSlabDesignLoad(
  slab: SlabEntity,
  grossAreaMm2: number,
): Pick<SlabFoundationSectionContext, 'designLoadKpa'> {
  if (slab.kind === 'foundation' || slab.kind === 'ground') return {};
  const areaM2 = grossAreaMm2 / 1e6;
  if (areaM2 <= 0) return {};
  const load = resolveAppliedMemberLoad(slab.params.appliedLoad);
  if (isZeroMemberLoad(load)) return {};
  const totalUlsKn = combineUls(load, EN1990_ULS_FACTORS).axialKn;
  return { designLoadKpa: totalUlsKn / areaM2 };
}
