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
import { suggestBeamSection } from './member-sizing';

/** Patch διατομής μέλους (beam-only v1· generic επέκταση κολόνας = ADR-475 §4 DEFER). */
export interface MemberSizePatch {
  readonly prev: BeamParams;
  readonly next: BeamParams;
}

/**
 * ADR-506 — τα width-aware όρια διαστασιολόγησης ενός δοκαριού (storey/topology-derived). Τα
 * παράγει ο store-coupled `resolveActiveBeamSizingLimits` (active-reinforcement) και τα περνά
 * ο caller (command / grip / panel) στον pure sizer/lock. Absent ⇒ depth-only (μηδέν regression).
 */
export interface BeamSizingLimits {
  /** Πρακτικό άνω όριο ΥΨΟΥΣ (mm) = ύψος ορόφου − ελεύθερο ύψος κάτω από δοκό (ΝΟΚ). */
  readonly practicalDepthLimitMm: number;
  /** Άνω όριο ΠΛΑΤΟΥΣ (mm) = κάθετη προβολή στηρίζουσας κολώνας. Absent ⇒ depth-only. */
  readonly maxWidthMm?: number;
}

/**
 * ADR-475 — Είναι το **ΥΨΟΣ** του δοκαριού σε AUTO διαστασιολόγηση; default = AUTO (absent/true)·
 * `false` = κλειδωμένο (ο μηχανικός όρισε χειροκίνητα το ύψος → user wins).
 */
export function isBeamAutoSized(params: BeamParams): boolean {
  return params.autoSized !== false;
}

/**
 * ADR-506 — Είναι το **ΠΛΑΤΟΣ** του δοκαριού σε AUTO διαστασιολόγηση; default = AUTO (absent/true)·
 * `false` = κλειδωμένο (ο μηχανικός όρισε χειροκίνητα το πλάτος → αρχιτεκτονική επιλογή, user wins).
 * Ανεξάρτητο από το `isBeamAutoSized` (ύψος) — independent lock.
 */
export function isBeamWidthAutoSized(params: BeamParams): boolean {
  return params.autoSizedWidth !== false;
}

/**
 * ADR-475/506 — auto-size patch ενός δοκαριού: re-derive διατομή (ύψος ∧/∨ πλάτος) από
 * γεωμετρία+φορτίο+τοπολογία.
 *   - μη-δοκάρι → `null`.
 *   - πλήρως κλειδωμένο (`autoSized:false` ΚΑΙ `autoSizedWidth:false`) → `null` (user wins).
 *   - converged (ίδια διατομή) → `null` (convergence guard, idempotent).
 *   - αλλιώς → `{ prev, next }` με νέα διάσταση μόνο στα **AUTO** πεδία (+ αντίστοιχα flags).
 * Geometry-mutating — ο caller το τυλίγει σε undoable command (mirror foundation).
 *
 * **Independent locks (ADR-506):** το ύψος (`autoSized`) και το πλάτος (`autoSizedWidth`)
 * ρυθμίζονται ανεξάρτητα — κλειδωμένη διάσταση κρατά το stored value, η AUTO ξανα-υπολογίζεται.
 *
 * Override args (ίδιο pattern με reinforce path): `supportTypeOverride` (ADR-486 topology-aware
 * πρόβολος→wL²/2), `designTorsionKnm` (ADR-499 §6.3 στρέψη→ύψος), `sizingSpanOverrideMm` (ADR-504
 * συνεχής δοκός→υπο-άνοιγμα), `limits` (ADR-506 πρακτικό ΝΟΚ ύψος + cap πλάτους κολώνας →
 * width-sizing). Απόντα → fallback legacy (μηδέν regression).
 */
export function buildBeamSizePatch(
  entity: Entity,
  provider: StructuralCodeProvider,
  supportTypeOverride?: BeamSupportType,
  designTorsionKnm?: number,
  sizingSpanOverrideMm?: number,
  limits?: BeamSizingLimits,
): MemberSizePatch | null {
  if (!isBeamEntity(entity)) return null;
  const p = entity.params;
  const widthAuto = isBeamWidthAutoSized(p);
  const depthAuto = isBeamAutoSized(p);
  if (!widthAuto && !depthAuto) return null; // πλήρως κλειδωμένο → user wins
  const suggested = suggestBeamSection(
    provider,
    buildBeamSectionContext(entity, supportTypeOverride, designTorsionKnm, sizingSpanOverrideMm, {
      ...limits,
      widthAutoSized: widthAuto,
      depthAutoSized: depthAuto,
    }),
  );
  const nextWidth = widthAuto ? suggested.widthMm : p.width;
  const nextDepth = depthAuto ? suggested.depthMm : p.depth;
  if (nextWidth === p.width && nextDepth === p.depth) return null; // convergence guard (idempotent)
  return {
    prev: p,
    next: {
      ...p,
      width: nextWidth,
      depth: nextDepth,
      ...(widthAuto ? { autoSizedWidth: true } : {}),
      ...(depthAuto ? { autoSized: true } : {}),
    },
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
  limits?: BeamSizingLimits,
): BeamSectionAdequacy {
  // ADR-506 — adequacy κρίνεται με ΣΤΑΘΕΡΟ το χειροκίνητο πλάτος (`widthAutoSized:false`) ώστε το
  // `suggested.depthMm` να είναι το ελάχιστο επαρκές ύψος ΓΙ' ΑΥΤΟ το πλάτος (capped στο ΝΟΚ όριο).
  const suggested = suggestBeamSection(
    provider,
    buildBeamSectionContext(
      { ...beam, params: next }, supportTypeOverride, designTorsionKnm, sizingSpanOverrideMm,
      { ...limits, widthAutoSized: false, depthAutoSized: true },
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
 * ADR-503 Slice 3 / ADR-506 — **ΕΝΑ SSoT** για την απόφαση lock σε χειροκίνητη διατομή δοκαριού
 * (grip resize ∨ panel/ribbon). Mirror του `resolveColumnSectionLock`. **Independent locks** —
 * το ύψος και το πλάτος κλειδώνουν ξεχωριστά ανάλογα με το ΤΙ άλλαξε:
 *   - **τίποτα** (width/depth ίδια) → pass-through (μη-section edits δεν κλειδώνουν).
 *   - **άλλαξε ΥΨΟΣ**: manual ≥ επαρκές → lock ύψους (`autoSized:false`, user wins)· manual <
 *     επαρκές (υποδιαστασιολόγηση) → **ΜΠΛΟΚ**: `depth:minDepthMm` + `autoSized:true` + `rejected`.
 *   - **άλλαξε ΠΛΑΤΟΣ**: lock πλάτους (`autoSizedWidth:false`) — το πλάτος είναι αρχιτεκτονική
 *     επιλογή (Giorgio), δεν απορρίπτεται· το ύψος μένει AUTO και ξανα-υπολογίζεται γι' αυτό το
 *     πλάτος (αν τελικά ανεπαρκές → ο validator/ADR-504 advisory το επισημαίνει).
 *
 * Invariant: καμία persisted δοκός ποτέ με ΥΨΟΣ κάτω από το επαρκές. Pure — ο caller το τυλίγει σε
 * command. Override args topology-aware (`resolveActiveBeam*`) + `limits` (ADR-506 ΝΟΚ/cap κολώνας).
 */
export function resolveBeamSectionLock(
  provider: StructuralCodeProvider,
  beam: Pick<BeamEntity, 'params' | 'geometry'>,
  prevParams: BeamParams,
  nextParams: BeamParams,
  supportTypeOverride?: BeamSupportType,
  designTorsionKnm?: number,
  sizingSpanOverrideMm?: number,
  limits?: BeamSizingLimits,
): BeamSectionLockResolution {
  const widthChanged = nextParams.width !== prevParams.width;
  const depthChanged = nextParams.depth !== prevParams.depth;
  if (!widthChanged && !depthChanged) {
    return { params: nextParams, rejected: false, minDepthMm: nextParams.depth };
  }
  let params = nextParams;
  let rejected = false;
  let minDepthMm = nextParams.depth;
  if (depthChanged) {
    const adq = isBeamSectionAdequate(
      provider, beam, nextParams, supportTypeOverride, designTorsionKnm, sizingSpanOverrideMm, limits,
    );
    minDepthMm = adq.minDepthMm;
    params = adq.adequate
      ? { ...params, autoSized: false }
      : { ...params, depth: adq.minDepthMm, autoSized: true };
    rejected = !adq.adequate;
  }
  if (widthChanged) {
    params = { ...params, autoSizedWidth: false }; // lock πλάτους (αρχιτεκτονική επιλογή)
  }
  return { params, rejected, minDepthMm };
}
