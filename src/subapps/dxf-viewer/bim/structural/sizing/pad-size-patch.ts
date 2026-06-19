/**
 * pad-size-patch — safety-gated lock σε **χειροκίνητη** διάσταση μεμονωμένου πεδίλου
 * (ADR-503 Slice 3, organism-wide). Mirror του `resolveColumnSectionLock`/`resolveBeamSectionLock`,
 * αλλά με δύο διαφορές ειδικές για το πέδιλο:
 *
 *  1. **Lock flag = `autoDesigned`** (ΟΧΙ `autoSized`). Το `FoundationParams` δεν έχει `autoSized`·
 *     το **μόνο** που ξαναδιαστασιολογεί ένα pad είναι ο `auto-foundation-layout` reconciler, ο
 *     οποίος ενεργεί ΜΟΝΟ σε `autoDesigned===true` (τα χειροκίνητα τα σέβεται απόλυτα). Άρα το
 *     `autoDesigned` ΕΙΝΑΙ ο σωστός lock-flag — μηδέν νέο field/schema/reconciler change.
 *  2. **Η επάρκεια εξαρτάται από εξωτερικό context** (διαστάσεις στηρίζουσας κολώνας + φορτίο +
 *     σ_allow), όχι self-contained όπως δοκός/πλάκα. Ο caller χτίζει το `PadSizingInput` μέσω
 *     `buildPadSizingInput` (entities + ρυθμίσεις) και το περνά στις pure συναρτήσεις.
 *
 * Reuse (μηδέν duplicate, N.0.2): `suggestPadDimensions` (το two-way SSoT· επιστρέφει πάντα
 * τουλάχιστον το γεωμετρικό/detailing min), `resolveSupportingColumn` (explicit FK `footingId`,
 * ίδιο SSoT με το `footing-design-input`), `buildColumnSectionContext`, `combineSls`.
 *
 * Pure — zero React/DOM/Firestore. Όλα σε mm.
 *
 * @see ../footing-design/suggest-pad-dimensions.ts — `suggestPadDimensions` (το two-way core)
 * @see ./column-size-patch.ts — `resolveColumnSectionLock` (το αδελφό pattern)
 * @see docs/centralized-systems/reference/adrs/ADR-503-two-way-auto-size-safety-gated-lock.md
 */

import type { Entity } from '../../../types/entities';
import type { FoundationEntity, PadFootingParams } from '../../types/foundation-types';
import { resolveSupportingColumn } from '../footing-design/footing-support-column';
import { buildColumnSectionContext } from '../section-context';
import { combineSls } from '../loads/load-combinations';
import { resolveAppliedMemberLoad } from '../loads/structural-loads-types';
import { suggestPadDimensions, type PadSizingInput } from '../footing-design/suggest-pad-dimensions';

/**
 * ADR-503 Slice 3 — Είναι σε AUTO διαστασιολόγηση ένα pad πέδιλο; Reuse `autoDesigned` ως
 * lock-flag: `true` = το διαχειρίζεται ο reconciler (re-size/merge/remove)· absent/`false` =
 * χειροκίνητο (κλειδωμένο, ο μηχανικός όρισε τη διάσταση → user wins).
 */
export function isPadAutoSized(params: PadFootingParams): boolean {
  return params.autoDesigned === true;
}

/**
 * ADR-503 Slice 3 — χτίζει το `PadSizingInput` ενός pad από το ζωντανό context: διαστάσεις
 * στηρίζουσας κολώνας (explicit FK `footingId`, ίδιο SSoT με το `footing-design-input`),
 * χαρακτηριστικό service αξονικό N=G+Q (από το `appliedLoad`) και σ_allow (από τις ρυθμίσεις).
 * Χωρίς attached κολώνα → 0 dims· χωρίς φορτίο/σ → ο sizer πέφτει στο γεωμετρικό/detailing min
 * (`PAD_MIN_SIDE_MM`) — μηδέν false-negative. `null` όταν δεν είναι pad. Pure (entities/soil args).
 */
export function buildPadSizingInput(
  footing: FoundationEntity,
  entities: readonly Entity[],
  soilBearingCapacityKpa: number | undefined,
): PadSizingInput | null {
  if (footing.params.kind !== 'pad') return null;
  const column = resolveSupportingColumn(footing.id, entities);
  const colCtx = column ? buildColumnSectionContext(column) : null;
  const axialServiceKn = combineSls(resolveAppliedMemberLoad(footing.params.appliedLoad)).axialKn;
  return {
    columnWidthMm: colCtx?.widthMm ?? 0,
    columnDepthMm: colCtx?.depthMm ?? 0,
    ...(axialServiceKn > 0 ? { axialServiceKn } : {}),
    ...(soilBearingCapacityKpa && soilBearingCapacityKpa > 0 ? { soilBearingCapacityKpa } : {}),
  };
}

/** Επάρκεια χειροκίνητης διάστασης pad πεδίλου (ADR-503 Slice 3 lock-gate). */
export interface PadSectionAdequacy {
  readonly adequate: boolean;
  /** Η ελάχιστη επαρκής διάσταση (mm) — για το μήνυμα toast + το clamp. */
  readonly minWidthMm: number;
  readonly minLengthMm: number;
}

/**
 * ADR-503 Slice 3 — Είναι ΕΠΑΡΚΗΣ η **διάσταση** ενός χειροκίνητου pad; `adequate` ⇔
 * `next.width ≥ minWidth && next.length ≥ minLength`, όπου `min*` = το ελάχιστο επαρκές από
 * `suggestPadDimensions` (έδραση `A_req=N/σ` ∨ γεωμετρικό min κολώνας+προεξοχή ∨ `PAD_MIN_SIDE`).
 * Two-way: μεγαλώνει όταν υποδιαστασιολογείται, η over-dimensioned επιτρέπεται (επιλογή μηχανικού).
 */
export function isPadSectionAdequate(
  input: PadSizingInput,
  next: { readonly widthMm: number; readonly lengthMm: number },
): PadSectionAdequacy {
  const { widthMm, lengthMm } = suggestPadDimensions(input);
  return {
    adequate: next.widthMm >= widthMm && next.lengthMm >= lengthMm,
    minWidthMm: widthMm,
    minLengthMm: lengthMm,
  };
}

/** Αποτέλεσμα του safety-gated lock σε **χειροκίνητη** διάσταση pad πεδίλου (ADR-503 Slice 3). */
export interface PadSectionLockResolution {
  /** Οι params που θα γραφτούν: locked (`autoDesigned:false`) αν επαρκές· αλλιώς bumped στην ελάχιστη επαρκή. */
  readonly params: PadFootingParams;
  /** `true` ⇔ η χειροκίνητη διάσταση απορρίφθηκε (υποδιαστασιολόγηση) → ο caller δείχνει toast. */
  readonly rejected: boolean;
  /** Η ελάχιστη επαρκής διάσταση (για το μήνυμα toast). */
  readonly minWidthMm: number;
  readonly minLengthMm: number;
}

/**
 * ADR-503 Slice 3 — **ΕΝΑ SSoT** για την απόφαση lock σε χειροκίνητη διάσταση pad πεδίλου (grip
 * width/length resize). Κανόνας (Giorgio Q2), mirror κολώνας/δοκού:
 *   - **δεν άλλαξε διάσταση** → pass-through.
 *   - manual **≥ επαρκές** → lock OK: `{...next, autoDesigned:false}` (κλειδώνει από τον reconciler·
 *     ο μηχανικός το θέλει έτσι — επιτρέπεται και η over-dimensioned, Revit user-wins).
 *   - manual **< επαρκές** (υποδιαστασιολόγηση) → **ΜΠΛΟΚ**: clamp στην ελάχιστη επαρκή `minW×minL`,
 *     **διατηρώντας** το υπάρχον `autoDesigned` (αν ήταν auto → μένει auto-managed· αν manual →
 *     μένει manual αλλά πλέον ασφαλές) + `rejected:true`.
 *
 * Invariant: καμία persisted διάσταση πεδίλου ποτέ κάτω από το επαρκές. Pure — ο caller το τυλίγει σε command.
 */
export function resolvePadSectionLock(
  input: PadSizingInput,
  prevParams: PadFootingParams,
  nextParams: PadFootingParams,
): PadSectionLockResolution {
  const sizeChanged = nextParams.width !== prevParams.width || nextParams.length !== prevParams.length;
  if (!sizeChanged) {
    return { params: nextParams, rejected: false, minWidthMm: nextParams.width, minLengthMm: nextParams.length };
  }
  const { adequate, minWidthMm, minLengthMm } = isPadSectionAdequate(input, {
    widthMm: nextParams.width,
    lengthMm: nextParams.length,
  });
  if (adequate) {
    return { params: { ...nextParams, autoDesigned: false }, rejected: false, minWidthMm, minLengthMm };
  }
  return {
    params: { ...nextParams, width: minWidthMm, length: minLengthMm },
    rejected: true,
    minWidthMm,
    minLengthMm,
  };
}
