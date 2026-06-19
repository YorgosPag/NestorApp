/**
 * beam-size-patch — auto διαστασιολόγηση δοκαριού ως undoable params patch
 * (ADR-475). Γέφυρα του pure `suggestBeamSection` (member-sizing SSoT) με την
 * τρέχουσα οντότητα + τον convergence guard, mirror του `buildReinforcePatch`
 * (reinforce-patch) για τον οπλισμό.
 *
 * **Γιατί ξεχωριστό module (όχι μέσα στο section-context):** σπάει την κυκλική
 * εξάρτηση `section-context → member-sizing → section-context` (το core sizing
 * χρειάζεται το `BeamSectionContext`, ενώ το patch χρειάζεται ΚΑΙ το context-builder
 * ΚΑΙ τον sizer). Καθαρό SSoT για τη geometry-mutating διαστασιολόγηση — distinct
 * concern από τον (additive, derived-on-render) οπλισμό.
 *
 * **Διαφορά από τον οπλισμό:** η διατομή ΕΙΝΑΙ γεωμετρία → το `depth` **persist-άρεται**
 * (δεν είναι derived-on-render)· γι' αυτό εφαρμόζεται ΜΙΑ φορά μέσω command με
 * convergence guard (anti-oscillation), όπως το auto-sized πέδιλο (ADR-464) — όχι
 * re-derive σε κάθε frame.
 *
 * Pure — zero React/DOM/Firestore. Όλα σε mm.
 *
 * @see ./member-sizing.ts — `suggestBeamSection` (το pure core)
 * @see ../reinforce-patch.ts — `buildReinforcePatch` (το αντίστοιχο για οπλισμό)
 * @see docs/centralized-systems/reference/adrs/ADR-475-auto-member-sizing.md
 */

import type { Entity } from '../../../types/entities';
import { isBeamEntity } from '../../../types/entities';
import type { BeamEntity, BeamParams, BeamSupportType } from '../../types/beam-types';
import type { StructuralCodeProvider } from '../codes/structural-code-types';
import { buildBeamSectionContext } from '../section-context';
import { suggestBeamSection, type BeamSizing } from './member-sizing';

/** Patch διατομής μέλους (beam-only v1· generic επέκταση κολόνας = ADR-475 §4 DEFER). */
export interface MemberSizePatch {
  readonly prev: BeamParams;
  readonly next: BeamParams;
}

/**
 * ADR-475 — Είναι το δοκάρι σε AUTO διαστασιολόγηση; default = AUTO (absent/true)·
 * `false` = κλειδωμένο (ο μηχανικός όρισε χειροκίνητα τη διατομή → user wins).
 */
export function isBeamAutoSized(params: BeamParams): boolean {
  return params.autoSized !== false;
}

/**
 * ADR-475 — η ΕΝΕΡΓΗ προτεινόμενη διατομή ενός AUTO δοκαριού από την ΤΡΕΧΟΥΣΑ
 * γεωμετρία + φορτίο (span = derived `geometry.length`). Locked → `undefined`
 * (η stored διατομή ισχύει ως έχει). Pure (provider arg) ⇒ unit-testable.
 *
 * ADR-486 §C — `supportTypeOverride` (προαιρετικό): ο **topology-aware** τύπος
 * στήριξης (ADR-486). Κρίσιμο για τον πρόβολο: χωρίς αυτόν ο sizer έβλεπε το stored
 * `'simple'` → wL²/8 → υπο-διαστασιολόγηση → ο οπλισμός (που υπολογίζεται σωστά με
 * wL²/2) δεν χωρούσε → ρ > ρ_max. Mirror του reinforce path (`resolveActiveBeam*`).
 */
function resolveActiveBeamSection(
  beam: Pick<BeamEntity, 'params' | 'geometry'>,
  provider: StructuralCodeProvider,
  supportTypeOverride?: BeamSupportType,
  designTorsionKnm?: number,
  sizingSpanOverrideMm?: number,
): BeamSizing | undefined {
  if (!isBeamAutoSized(beam.params)) return undefined;
  return suggestBeamSection(
    provider,
    buildBeamSectionContext(beam, supportTypeOverride, designTorsionKnm, sizingSpanOverrideMm),
  );
}

/**
 * ADR-475 — convergence guard: διαφέρει ΟΥΣΙΩΔΩΣ η διατομή; (50mm-quantized →
 * exact compare· ίδια πρόταση → `false` → μηδέν patch → μηδέν undo entry → μηδέν
 * event storm, anti-oscillation — mirror `beamReinforcementMateriallyDiffers`).
 */
function beamSectionMateriallyDiffers(
  current: { readonly width: number; readonly depth: number },
  suggested: BeamSizing,
): boolean {
  return current.width !== suggested.widthMm || current.depth !== suggested.depthMm;
}

/**
 * ADR-475 — auto-size patch ενός δοκαριού: re-derive διατομή από γεωμετρία+φορτίο.
 *   - μη-δοκάρι / locked (`autoSized:false`) → `null` (user wins).
 *   - converged (ίδια διατομή) → `null` (convergence guard, idempotent).
 *   - αλλιώς → `{ prev, next }` με νέο `depth`/`width` + `autoSized:true`.
 * Geometry-mutating — ο caller το τυλίγει σε undoable command (mirror foundation).
 *
 * ADR-486 §C — `supportTypeOverride`: ο caller (command) περνά τον topology-aware
 * τύπο στήριξης (`resolveActiveBeamSupportType`) ώστε ο πρόβολος να διαστασιολογείται
 * με wL²/2 (όχι stored 'simple'). Απών → fallback στο stored (graphless = legacy).
 *
 * ADR-499 §6.3-b — `designTorsionKnm`: ο caller περνά την DERIVED στρεπτική ροπή
 * (`resolveActiveBeamTorsion`) ώστε ο sizer να μεγαλώνει το ύψος ώστε
 * `T_Ed/T_Rd,max + V_Ed/V_Rd,max ≤ 1`. Απών/≤0 → καμία στρέψη (μηδέν regression).
 *
 * ADR-504 Φ2 — `sizingSpanOverrideMm`: ο caller περνά το DERIVED υπο-άνοιγμα συνεχούς δοκού
 * (`resolveActiveBeamSpanMm`) ώστε ο sizer να μικραίνει το ύψος (ροπή/βέλος από max sub-span).
 * Απών/≤0 → πλήρες μήκος (μηδέν regression). Αυτό κάνει ΠΡΑΞΗ το «η δοκός μικραίνει».
 */
export function buildBeamSizePatch(
  entity: Entity,
  provider: StructuralCodeProvider,
  supportTypeOverride?: BeamSupportType,
  designTorsionKnm?: number,
  sizingSpanOverrideMm?: number,
): MemberSizePatch | null {
  if (!isBeamEntity(entity)) return null;
  const suggested = resolveActiveBeamSection(
    entity, provider, supportTypeOverride, designTorsionKnm, sizingSpanOverrideMm,
  );
  if (!suggested) return null;
  const p = entity.params;
  if (!beamSectionMateriallyDiffers(p, suggested)) return null;
  return {
    prev: p,
    next: { ...p, width: suggested.widthMm, depth: suggested.depthMm, autoSized: true },
  };
}

/** Επάρκεια χειροκίνητης διατομής δοκαριού (ADR-503 Slice 3 lock-gate). depth-driven. */
export interface BeamSectionAdequacy {
  readonly adequate: boolean;
  /** Το ελάχιστο επαρκές ύψος (mm) — για το μήνυμα toast + το clamp. */
  readonly minDepthMm: number;
}

/**
 * ADR-503 Slice 3 — Είναι ΕΠΑΡΚΕΣ το **ύψος** μιας χειροκίνητης διατομής δοκαριού;
 * `adequate` ⇔ `next.depth ≥ suggested.depthMm`· το `suggestBeamSection` δίνει το ελάχιστο
 * επαρκές ύψος = max[serviceability L/d, κάμψη, διάτμηση, στρέψη, MIN] (rounded). Το ctx χτίζεται
 * από τα **next** params ώστε το πλάτος (αρχιτεκτονική επιλογή) να επηρεάζει σωστά το απαιτούμενο
 * ύψος. `supportTypeOverride`/`designTorsionKnm` = topology-aware overrides (ίδιο SSoT με τον
 * auto-sizer & τον οπλισμό· πρόβολος → wL²/2 + στρέψη). Pure (provider arg).
 */
export function isBeamSectionAdequate(
  provider: StructuralCodeProvider,
  beam: Pick<BeamEntity, 'params' | 'geometry'>,
  next: BeamParams,
  supportTypeOverride?: BeamSupportType,
  designTorsionKnm?: number,
  sizingSpanOverrideMm?: number,
): BeamSectionAdequacy {
  const suggested = suggestBeamSection(
    provider,
    buildBeamSectionContext(
      { ...beam, params: next }, supportTypeOverride, designTorsionKnm, sizingSpanOverrideMm,
    ),
  );
  return { adequate: next.depth >= suggested.depthMm, minDepthMm: suggested.depthMm };
}

/** Αποτέλεσμα του safety-gated lock σε **χειροκίνητη** επεξεργασία διατομής δοκαριού (ADR-503 Slice 3). */
export interface BeamSectionLockResolution {
  /** Οι params που θα γραφτούν: locked (`autoSized:false`) αν επαρκής· αλλιώς bumped στο ελάχιστο επαρκές ύψος + AUTO. */
  readonly params: BeamParams;
  /** `true` ⇔ η χειροκίνητη διατομή απορρίφθηκε (υποδιαστασιολόγηση) → ο caller δείχνει toast. */
  readonly rejected: boolean;
  /** Το ελάχιστο επαρκές ύψος (για το μήνυμα toast). */
  readonly minDepthMm: number;
}

/**
 * ADR-503 Slice 3 — **ΕΝΑ SSoT** για την απόφαση lock σε χειροκίνητη διατομή δοκαριού (grip
 * resize ∨ panel/ribbon). Αντικαθιστά το inline `sectionChanged ? {...,autoSized:false} : ...`
 * σε 2 σημεία (N.0.2). Mirror του `resolveColumnSectionLock`. Κανόνας (Giorgio Q2):
 *   - **δεν άλλαξε διατομή** (width/depth ίδια) → pass-through (μη-section edits δεν κλειδώνουν).
 *   - manual **≥ επαρκές** → lock OK: `{...next, autoSized:false}` (user wins, Revit).
 *   - manual **< επαρκές** (υποδιαστασιολόγηση) → **ΜΠΛΟΚ**: `{...next, depth:minDepthMm,
 *     autoSized:true}` (μένει AUTO, το σύστημα κρατά το ελάχιστο επαρκές) + `rejected:true`.
 *
 * Invariant: καμία persisted δοκός ποτέ κάτω από το επαρκές. Pure — ο caller το τυλίγει σε command.
 * `supportTypeOverride`/`designTorsionKnm`: topology-aware (`resolveActiveBeamSupportType`/
 * `resolveActiveBeamTorsion`, ίδιο SSoT με τον auto-sizer).
 */
export function resolveBeamSectionLock(
  provider: StructuralCodeProvider,
  beam: Pick<BeamEntity, 'params' | 'geometry'>,
  prevParams: BeamParams,
  nextParams: BeamParams,
  supportTypeOverride?: BeamSupportType,
  designTorsionKnm?: number,
  sizingSpanOverrideMm?: number,
): BeamSectionLockResolution {
  const sectionChanged = nextParams.width !== prevParams.width || nextParams.depth !== prevParams.depth;
  if (!sectionChanged) {
    return { params: nextParams, rejected: false, minDepthMm: nextParams.depth };
  }
  const { adequate, minDepthMm } = isBeamSectionAdequate(
    provider, beam, nextParams, supportTypeOverride, designTorsionKnm, sizingSpanOverrideMm,
  );
  if (adequate) {
    return { params: { ...nextParams, autoSized: false }, rejected: false, minDepthMm };
  }
  return { params: { ...nextParams, depth: minDepthMm, autoSized: true }, rejected: true, minDepthMm };
}
