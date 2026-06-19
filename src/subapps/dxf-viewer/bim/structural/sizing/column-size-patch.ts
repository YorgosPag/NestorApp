/**
 * column-size-patch — auto διαστασιολόγηση διατομής κολώνας ως undoable params
 * patch (ADR-499 Slice B2). Γέφυρα του pure `suggestColumnSection` (column-sizing
 * SSoT) με την τρέχουσα οντότητα + convergence guard, mirror του `buildBeamSizePatch`.
 *
 * **Διαφορά από τον οπλισμό:** η διατομή (`width`/`depth`) ΕΙΝΑΙ γεωμετρία →
 * **persist-άρεται** (όχι derived-on-render)· εφαρμόζεται ΜΙΑ φορά μέσω command με
 * convergence guard (anti-oscillation), όπως το auto-sized δοκάρι (ADR-475) & πλάκα.
 *
 * Pure — zero React/DOM/Firestore. Όλα σε mm.
 *
 * @see ./column-sizing.ts — `suggestColumnSection` (το pure core)
 * @see ./beam-size-patch.ts — `buildBeamSizePatch` (το αδελφό pattern)
 * @see docs/centralized-systems/reference/adrs/ADR-499-auto-correcting-organism.md
 */

import type { Entity } from '../../../types/entities';
import { isColumnEntity } from '../../../types/entities';
import type { ColumnEntity, ColumnParams } from '../../types/column-types';
import type { StructuralCodeProvider } from '../codes/structural-code-types';
import { suggestColumnSection, isColumnSectionAdequate } from './column-sizing';

/** Patch διατομής κολώνας (mirror `MemberSizePatch` δοκαριού). */
export interface ColumnSizePatch {
  readonly prev: ColumnParams;
  readonly next: ColumnParams;
}

/**
 * ADR-499 — Είναι η κολώνα σε AUTO διαστασιολόγηση; default = AUTO (absent/true)·
 * `false` = κλειδωμένη (ο μηχανικός όρισε χειροκίνητα τη διατομή → user wins). Η
 * εξαίρεση των μη-ορθογώνιων ζει στον sizer (`suggestColumnSection` → undefined).
 */
export function isColumnAutoSized(params: ColumnParams): boolean {
  return params.autoSized !== false;
}

/**
 * ADR-499 — convergence guard: διαφέρει ΟΥΣΙΩΔΩΣ η διατομή; (50mm-quantized →
 * exact compare· ίδια πρόταση → `false` → μηδέν patch → μηδέν undo entry → μηδέν
 * event storm, anti-oscillation — mirror `beamSectionMateriallyDiffers`).
 */
function columnSectionMateriallyDiffers(
  current: { readonly width: number; readonly depth: number },
  suggested: { readonly widthMm: number; readonly depthMm: number },
): boolean {
  return current.width !== suggested.widthMm || current.depth !== suggested.depthMm;
}

/**
 * ADR-499 — auto-size patch μιας κολώνας: re-derive διατομή από φορτίο+λυγηρότητα.
 *   - μη-κολώνα / locked (`autoSized:false`) → `null` (user wins).
 *   - μη-ορθογώνια / μη-εφαρμόσιμο → `null` (ο sizer επιστρέφει undefined).
 *   - converged (ίδια διατομή) → `null` (convergence guard, idempotent).
 *   - αλλιώς → `{ prev, next }` με νέα `width`/`depth` + `autoSized:true`.
 * Geometry-mutating — ο caller το τυλίγει σε undoable command (mirror δοκαριού).
 *
 * ADR-491 / ADR-502 §Slice2 — `femMomentKnm`: ο caller (command) περνά τη **ροπή σχεδιασμού**
 * (`resolveActiveColumnDesignMoment` = engaged FEM ?? static πρόβολος `wL²/2`) ώστε η στηρίζουσα
 * κολώνα προβόλου να διαστασιολογείται **live**. Απών → ο sizer πέφτει στην ονομαστική e₀
 * (graphless fallback, μηδέν regression). Το όνομα της παραμέτρου μένει `femMomentKnm` (legacy).
 */
export function buildColumnSizePatch(
  entity: Entity,
  provider: StructuralCodeProvider,
  femMomentKnm?: number,
): ColumnSizePatch | null {
  if (!isColumnEntity(entity)) return null;
  const column = entity as ColumnEntity;
  if (!isColumnAutoSized(column.params)) return null;
  const suggested = suggestColumnSection(provider, column.params, femMomentKnm);
  if (!suggested) return null;
  if (!columnSectionMateriallyDiffers(column.params, suggested)) return null;
  return {
    prev: column.params,
    next: { ...column.params, width: suggested.widthMm, depth: suggested.depthMm, autoSized: true },
  };
}

/** Αποτέλεσμα του safety-gated lock σε **χειροκίνητη** επεξεργασία διατομής κολώνας (ADR-503 Slice 2). */
export interface ColumnSectionLockResolution {
  /** Οι params που θα γραφτούν: locked (`autoSized:false`) αν επαρκής· αλλιώς bumped στο ελάχιστο επαρκές + AUTO. */
  readonly params: ColumnParams;
  /** `true` ⇔ η χειροκίνητη διατομή απορρίφθηκε (υποδιαστασιολόγηση) → ο caller δείχνει toast. */
  readonly rejected: boolean;
  /** Η ελάχιστη επαρκής διατομή (για το μήνυμα toast). */
  readonly minWidthMm: number;
  readonly minDepthMm: number;
}

/**
 * ADR-503 Slice 2 — **ΕΝΑ SSoT** για την απόφαση lock σε χειροκίνητη επεξεργασία διατομής
 * κολώνας (grip `column-width`/`column-depth` ∨ panel/ribbon). Αντικαθιστά το copy-paste που
 * έχει σήμερα ο δοκός σε 2 σημεία (N.0.2). Κανόνας (Giorgio Q2):
 *   - **δεν άλλαξε διατομή** (material/height/…) → pass-through (μη-section edits δεν κλειδώνουν).
 *   - manual **≥ επαρκές** → lock OK: `{...next, autoSized:false}` (user wins, Revit).
 *   - manual **< επαρκές** (υποδιαστασιολόγηση) → **ΜΠΛΟΚ**: `{...next, width:minW, depth:minD,
 *     autoSized:true}` (μένει AUTO, το σύστημα κρατά την ελάχιστη επαρκή) + `rejected:true`.
 *
 * Invariant: καμία persisted κολώνα ποτέ κάτω από το επαρκές. Pure — ο caller το τυλίγει σε command.
 * `femMomentKnm`: ροπή σχεδιασμού (`resolveActiveColumnDesignMoment`, ίδιο SSoT με τον auto-sizer).
 */
export function resolveColumnSectionLock(
  provider: StructuralCodeProvider,
  prevParams: ColumnParams,
  nextParams: ColumnParams,
  femMomentKnm?: number,
): ColumnSectionLockResolution {
  const sectionChanged = nextParams.width !== prevParams.width || nextParams.depth !== prevParams.depth;
  const noChange: ColumnSectionLockResolution = {
    params: nextParams,
    rejected: false,
    minWidthMm: nextParams.width,
    minDepthMm: nextParams.depth,
  };
  if (!sectionChanged) return noChange;

  const { adequate, minWidthMm, minDepthMm } = isColumnSectionAdequate(provider, nextParams, femMomentKnm);
  if (adequate) {
    return { params: { ...nextParams, autoSized: false }, rejected: false, minWidthMm, minDepthMm };
  }
  return {
    params: { ...nextParams, width: minWidthMm, depth: minDepthMm, autoSized: true },
    rejected: true,
    minWidthMm,
    minDepthMm,
  };
}
