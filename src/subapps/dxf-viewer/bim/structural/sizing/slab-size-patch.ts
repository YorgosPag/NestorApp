/**
 * slab-size-patch — auto διαστασιολόγηση πάχους πλάκας-προβόλου ως undoable params
 * patch (ADR-499 Slice B). Γέφυρα του pure `suggestSlabThickness` (slab-sizing SSoT)
 * με την τρέχουσα οντότητα + convergence guard, mirror του `buildBeamSizePatch`.
 *
 * **Διαφορά από τον οπλισμό:** το `thickness` ΕΙΝΑΙ γεωμετρία → **persist-άρεται** (όχι
 * derived-on-render)· εφαρμόζεται ΜΙΑ φορά μέσω command με convergence guard
 * (anti-oscillation), όπως το auto-sized δοκάρι (ADR-475).
 *
 * Pure — zero React/DOM/Firestore. Όλα σε mm.
 *
 * @see ./slab-sizing.ts — `suggestSlabThickness` (το pure core)
 * @see ./beam-size-patch.ts — `buildBeamSizePatch` (το αδελφό pattern)
 * @see docs/centralized-systems/reference/adrs/ADR-499-auto-correcting-organism.md
 */

import type { Entity } from '../../../types/entities';
import { isSlabEntity } from '../../../types/entities';
import type { SlabEntity, SlabParams } from '../../types/slab-types';
import type { SlabSupportCondition } from '../loads/slab-beam-support';
import type { StructuralCodeProvider } from '../codes/structural-code-types';
import { buildSlabFoundationSectionContext } from '../section-context';
import { suggestSlabThickness } from './slab-sizing';

/** Patch πάχους πλάκας (mirror `MemberSizePatch` δοκαριού). */
export interface SlabSizePatch {
  readonly prev: SlabParams;
  readonly next: SlabParams;
}

/**
 * ADR-499 — Είναι η πλάκα σε AUTO διαστασιολόγηση; default = AUTO (absent/true)·
 * `false` = κλειδωμένη (ο μηχανικός όρισε χειροκίνητα το πάχος → user wins). Οι
 * **composite** πλάκες (`dna`) εξαιρούνται: το πάχος προκύπτει από `dna.totalThickness`.
 */
export function isSlabAutoSized(params: SlabParams): boolean {
  return params.autoSized !== false && params.dna === undefined;
}

/**
 * ADR-499 — convergence guard: διαφέρει ΟΥΣΙΩΔΩΣ το πάχος; (10mm-quantized → exact
 * compare· ίδια πρόταση → `false` → μηδέν patch → μηδέν undo entry → μηδέν event storm,
 * anti-oscillation — mirror `beamSectionMateriallyDiffers`).
 */
function slabThicknessMateriallyDiffers(currentMm: number, suggestedMm: number): boolean {
  return currentMm !== suggestedMm;
}

/**
 * ADR-499 — auto-size patch μιας πλάκας-προβόλου: re-derive πάχος από γεωμετρία+φορτίο.
 *   - μη-πλάκα / locked (`autoSized:false`) / composite (`dna`) → `null` (user wins).
 *   - μη-πρόβολος / μη-εφαρμόσιμο → `null` (ο sizer επιστρέφει undefined).
 *   - converged (ίδιο πάχος) → `null` (convergence guard, idempotent).
 *   - αλλιώς → `{ prev, next }` με νέο `thickness` + `autoSized:true`.
 * Geometry-mutating — ο caller το τυλίγει σε undoable command (mirror δοκαριού).
 *
 * ADR-498 — `supportCondition`: ο caller (command) περνά την topology-aware συνθήκη
 * στήριξης (`resolveActiveSlabSupportCondition`) ώστε ο πρόβολος να διαστασιολογείται
 * με q·L²/2. Απών → `'simple'` στον ctx → ο sizer επιστρέφει `undefined` (no-op).
 */
export function buildSlabSizePatch(
  entity: Entity,
  provider: StructuralCodeProvider,
  supportCondition?: SlabSupportCondition,
): SlabSizePatch | null {
  if (!isSlabEntity(entity)) return null;
  const slab = entity as SlabEntity;
  if (!isSlabAutoSized(slab.params)) return null;
  const suggested = suggestSlabThickness(provider, buildSlabFoundationSectionContext(slab, supportCondition));
  if (!suggested) return null;
  if (!slabThicknessMateriallyDiffers(slab.params.thickness, suggested.thicknessMm)) return null;
  return {
    prev: slab.params,
    next: { ...slab.params, thickness: suggested.thicknessMm, autoSized: true },
  };
}

/** Επάρκεια χειροκίνητου πάχους πλάκας (ADR-503 Slice 3 lock-gate). */
export interface SlabSectionAdequacy {
  readonly adequate: boolean;
  /** Το ελάχιστο επαρκές πάχος (mm) — για το μήνυμα toast + το clamp. */
  readonly minThicknessMm: number;
}

/**
 * ADR-503 Slice 3 — Είναι ΕΠΑΡΚΕΣ το **πάχος** μιας χειροκίνητης πλάκας; `adequate` ⇔
 * `next.thickness ≥ suggested.thicknessMm`. Ο `suggestSlabThickness` είναι cantilever-only
 * (αναρτημένη πλάκα-πρόβολος)· `undefined` (αμφιέρειστη / εδαφόπλακα / μηδέν άνοιγμα) ⇒ ο gate
 * δεν αφορά → `adequate:true` (no-op, μηδέν false-positive). Το ctx χτίζεται από τα **next** params.
 * `supportCondition` = topology-aware (`resolveActiveSlabSupportCondition`, ίδιο SSoT με τον
 * auto-sizer & τον οπλισμό). Pure (provider arg).
 */
export function isSlabSectionAdequate(
  provider: StructuralCodeProvider,
  slab: SlabEntity,
  next: SlabParams,
  supportCondition?: SlabSupportCondition,
): SlabSectionAdequacy {
  const suggested = suggestSlabThickness(
    provider,
    buildSlabFoundationSectionContext({ ...slab, params: next }, supportCondition),
  );
  if (!suggested) return { adequate: true, minThicknessMm: next.thickness };
  return { adequate: next.thickness >= suggested.thicknessMm, minThicknessMm: suggested.thicknessMm };
}

/** Αποτέλεσμα του safety-gated lock σε **χειροκίνητο** πάχος πλάκας (ADR-503 Slice 3). */
export interface SlabSectionLockResolution {
  /** Οι params που θα γραφτούν: locked (`autoSized:false`) αν επαρκές· αλλιώς bumped στο ελάχιστο επαρκές + AUTO. */
  readonly params: SlabParams;
  /** `true` ⇔ το χειροκίνητο πάχος απορρίφθηκε (υποδιαστασιολόγηση) → ο caller δείχνει toast. */
  readonly rejected: boolean;
  /** Το ελάχιστο επαρκές πάχος (για το μήνυμα toast). */
  readonly minThicknessMm: number;
}

/**
 * ADR-503 Slice 3 — **ΕΝΑ SSoT** για το lock σε χειροκίνητο πάχος πλάκας (panel/ribbon· η πλάκα
 * δεν έχει grip πάχους). Mirror του `resolveColumnSectionLock`. Σήμερα ο dispatcher ΔΕΝ κλείδωνε
 * καθόλου → χειροκίνητο πάχος έμενε AUTO → ο proactive κύκλος το ξαναέγραφε (pre-existing α-gap).
 * Κανόνας (Giorgio Q2):
 *   - **composite `dna`** (πάχος = `dna.totalThickness`, δεν το διαχειρίζεται ο auto-sizer) → pass-through.
 *   - **δεν άλλαξε πάχος** → pass-through.
 *   - manual **≥ επαρκές** → lock OK: `{...next, autoSized:false}` (user wins, Revit).
 *   - manual **< επαρκές** (υποδιαστασιολόγηση) → **ΜΠΛΟΚ**: `{...next, thickness:minThicknessMm,
 *     autoSized:true}` (μένει AUTO, το σύστημα κρατά το ελάχιστο επαρκές) + `rejected:true`.
 *
 * Invariant: καμία persisted πλάκα ποτέ κάτω από το επαρκές. Pure — ο caller το τυλίγει σε command.
 */
export function resolveSlabSectionLock(
  provider: StructuralCodeProvider,
  slab: SlabEntity,
  prevParams: SlabParams,
  nextParams: SlabParams,
  supportCondition?: SlabSupportCondition,
): SlabSectionLockResolution {
  const passThrough: SlabSectionLockResolution = {
    params: nextParams, rejected: false, minThicknessMm: nextParams.thickness,
  };
  if (nextParams.dna !== undefined) return passThrough;
  if (nextParams.thickness === prevParams.thickness) return passThrough;

  const { adequate, minThicknessMm } = isSlabSectionAdequate(provider, slab, nextParams, supportCondition);
  if (adequate) {
    return { params: { ...nextParams, autoSized: false }, rejected: false, minThicknessMm };
  }
  return {
    params: { ...nextParams, thickness: minThicknessMm, autoSized: true },
    rejected: true,
    minThicknessMm,
  };
}
