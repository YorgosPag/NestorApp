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
