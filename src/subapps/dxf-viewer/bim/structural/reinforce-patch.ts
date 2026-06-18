/**
 * Auto-reinforce **patch** builder SSoT (ADR-472 S3 / ADR-476 / ADR-477).
 *
 * `buildReinforcePatch(entity, provider)` → `{prev, next}` params patch ώστε ένα δομικό
 * μέλος (κολόνα/δοκάρι/πλάκα/πέδιλο/συνδετήρια) να αποκτήσει code-suggested οπλισμό —
 * geometry-neutral (additive, δεν αλλάζει διαστάσεις) + stale-intent re-study (auto:true →
 * re-derive από ΤΡΕΧΟΥΣΑ γεωμετρία) + convergence guards (`*MateriallyDiffers`) που
 * εξουδετερώνουν το event storm (ίδια πρόταση → μηδέν patch → μηδέν undo entry).
 *
 * **Γιατί ξεχωριστό module (όχι μέσα στο section-context):** το `section-context.ts` είναι
 * το «context builders + active resolvers» SSoT· εδώ ζει η ΚΑΤΑΝΑΛΩΣΗ τους (patch dispatcher).
 * Ο διαχωρισμός κρατά ΚΑΘΕ αρχείο < Google file-size limit (N.7.1) με ΕΝΑ-ευθύνη — one-way
 * εξάρτηση `reinforce-patch → section-context` (μηδέν κύκλος).
 *
 * Pure — zero React/DOM/Firestore (provider arg) ⇒ unit-testable. Όλες οι μετρήσεις σε mm.
 *
 * @see ./section-context.ts — οι context builders + active resolvers που καταναλώνει
 * @see docs/centralized-systems/reference/adrs/ADR-472-load-aware-strength-reinforcement.md §S3
 */

import type { Entity } from '../../types/entities';
import { isColumnEntity, isBeamEntity, isFoundationEntity, isSlabEntity } from '../../types/entities';
import type { ColumnParams } from '../types/column-types';
import type { BeamParams, BeamSupportType } from '../types/beam-types';
import type { FoundationParams, FoundationEntity, TieBeamParams } from '../types/foundation-types';
import type { SlabParams } from '../types/slab-types';
import type { ColumnReinforcement } from './reinforcement/column-reinforcement-types';
import type { BeamReinforcement } from './reinforcement/beam-reinforcement-types';
import type { SlabFoundationReinforcement } from './reinforcement/slab-foundation-reinforcement-types';
import type { TieBeamReinforcement } from './reinforcement/footing-reinforcement-types';
import type { StructuralCodeProvider } from './codes/structural-code-types';
import type { SlabSupportCondition } from './loads/slab-beam-support';
import {
  resolveActiveColumnReinforcement,
  resolveActiveBeamReinforcement,
  resolveActiveSlabReinforcement,
  resolveActiveTieBeamReinforcement,
  buildColumnSectionContext,
  buildBeamSectionContext,
  buildSlabFoundationSectionContext,
  buildFootingSectionContextFromParams,
} from './section-context';

/** Params οποιουδήποτε δομικού μέλους που δέχεται οπλισμό. */
export type ReinforceableParams = ColumnParams | BeamParams | FoundationParams | SlabParams;

/**
 * Patch params ενός μέλους για auto-reinforce. `prev` = τα τρέχοντα params
 * (ΧΩΡΙΣ κλειδί `reinforcement` — idempotent skip το εγγυάται)· `next` = με το
 * code-suggested `reinforcement`. Το `prev` κρατιέται αυτούσιο (ΟΧΙ explicit
 * `reinforcement: undefined`) ώστε το undo→persist να μη σπάει το Firestore.
 */
export interface ReinforcePatch {
  readonly prev: ReinforceableParams;
  readonly next: ReinforceableParams;
}

/**
 * ADR-472 S3 — Convergence guard: αλλάζει **ουσιωδώς** ο διαμήκης οπλισμός κολόνας;
 * Σύγκριση των discrete πεδίων που οδηγεί η strength design (πλήθος + διάμετρος ράβδων)
 * — exact, μηδέν float tolerance (η As είναι derived count·area, άρα count+Ø = ΑΚΡΙΒΗΣ
 * ταυτότητα της πρότασης). Ίδιο φορτίο → ίδια πρόταση → `false` → μηδέν patch → μηδέν
 * undo entry → μηδέν event storm (anti-oscillation). Καθαρά-detailing prefs (τύπος
 * συνδετήρα/cross-tie) ΔΕΝ θεωρούνται «ουσιώδης» αλλαγή — δεν προκαλούν re-study.
 */
export function columnReinforcementMateriallyDiffers(
  a: ColumnReinforcement,
  b: ColumnReinforcement,
): boolean {
  return (
    a.longitudinal.count !== b.longitudinal.count ||
    a.longitudinal.diameterMm !== b.longitudinal.diameterMm
  );
}

/**
 * ADR-472 S3 — όπως το column variant, για δοκάρι: σύγκριση κάτω+άνω στρώσης (πλήθος +
 * διάμετρος). Η κάμψη `M_Ed = w·L²/c` οδηγεί το `bottom`/`top` count·Ø — exact compare.
 */
export function beamReinforcementMateriallyDiffers(
  a: BeamReinforcement,
  b: BeamReinforcement,
): boolean {
  return (
    a.bottom.count !== b.bottom.count ||
    a.bottom.diameterMm !== b.bottom.diameterMm ||
    a.top.count !== b.top.count ||
    a.top.diameterMm !== b.top.diameterMm
  );
}

/**
 * ADR-476 — όπως τα column/beam variants, για πλάκα: σύγκριση των 4 σχαρών
 * (διάμετρος + βήμα κάτω X/Y + άνω X/Y). Το πάχος/άνοιγμα/φορτίο οδηγεί το mesh — exact
 * compare ⇒ anti-oscillation guard (ίδια γεωμετρία → ίδια πρόταση → μηδέν patch).
 */
export function slabReinforcementMateriallyDiffers(
  a: SlabFoundationReinforcement,
  b: SlabFoundationReinforcement,
): boolean {
  const meshDiffers = (x: { diameterMm: number; spacingMm: number }, y: { diameterMm: number; spacingMm: number }): boolean =>
    x.diameterMm !== y.diameterMm || x.spacingMm !== y.spacingMm;
  return (
    meshDiffers(a.bottomMeshX, b.bottomMeshX) ||
    meshDiffers(a.bottomMeshY, b.bottomMeshY) ||
    meshDiffers(a.topMeshX, b.topMeshX) ||
    meshDiffers(a.topMeshY, b.topMeshY)
  );
}

/**
 * Code-suggested οπλισμός → `{prev, next}` patch (SSoT dispatcher κολόνα/δοκάρι/πέδιλο).
 * Επιστρέφει `null` αν το entity δεν είναι δομικό μέλος. Geometry-neutral — additive,
 * δεν αλλάζει διαστάσεις.
 *
 * ADR-472 S3 (stale-intent invalidation) — κολόνα/δοκάρι:
 *   - absent             → νέα code-suggested πρόταση (`auto:true`).
 *   - manual (`!auto`)   → `null` (Revit: χειροκίνητη υπέρβαση κλειδωμένη, user wins).
 *   - `auto:true`        → re-derive από ΤΡΕΧΟΥΣΑ γεωμετρία+φορτίο (SSoT `resolveActive*`)·
 *                          patch ΜΟΝΟ αν `materiallyDiffers` (convergence guard).
 * Πέδιλα/εδαφόπλακα: αμετάβλητο idempotent skip (re-size μέσω ADR-464).
 *
 * ADR-486 — `supportType` (προαιρετικό): ο **topology-aware** τύπος στήριξης δοκαριού
 * (πρόβολος όταν 1 στήριξη) που ο caller (auto-reinforce core) παράγει από τον graph.
 * Έτσι ο πρόβολος ξανα-σχεδιάζεται με `wL²/2` → `materiallyDiffers` → patch → ο
 * persisted οπλισμός ΚΑΙ το toast ακολουθούν τη νέα τοπολογία (όχι «κανένα μέλος»).
 *
 * ADR-491 — `columnFemMomentKnm` (προαιρετικό): η **FEM ροπή του φορέα** στη στήριξη του
 * προβόλου (`wL²/2`) που ο caller (auto-reinforce core) διαβάζει από το engaged-gated FEM
 * store. Έτσι η κολώνα στήριξης ξανα-σχεδιάζεται M-N για τη ροπή → patch → persisted οπλισμός
 * επαρκής (utilization ≤ 1). Mirror του beam `supportType` (αναλυτικός override).
 */
export function buildReinforcePatch(
  entity: Entity,
  provider: StructuralCodeProvider,
  supportType?: BeamSupportType,
  columnFemMomentKnm?: number,
  slabSupportCondition?: SlabSupportCondition,
): ReinforcePatch | null {
  if (isColumnEntity(entity)) {
    const stored = entity.params.reinforcement;
    if (stored && !stored.auto) return null; // manual override → ΠΟΤΕ overwrite
    const fresh: ColumnReinforcement = stored
      ? resolveActiveColumnReinforcement(entity.params, provider, columnFemMomentKnm) ?? stored
      : {
          ...provider.suggestColumnReinforcement(buildColumnSectionContext(entity, columnFemMomentKnm)),
          auto: true,
        };
    if (stored && !columnReinforcementMateriallyDiffers(stored, fresh)) return null;
    return { prev: entity.params, next: { ...entity.params, reinforcement: fresh } };
  }
  if (isBeamEntity(entity)) {
    const stored = entity.params.reinforcement;
    if (stored && !stored.auto) return null; // manual override → ΠΟΤΕ overwrite (parity με κολόνα)
    // ADR-486 — topology-aware supportType override (πρόβολος → wL²/2) και στις δύο διαδρομές.
    const fresh: BeamReinforcement = stored
      ? resolveActiveBeamReinforcement(entity, provider, supportType) ?? stored
      : { ...provider.suggestBeamReinforcement(buildBeamSectionContext(entity, supportType)), auto: true };
    if (stored && !beamReinforcementMateriallyDiffers(stored, fresh)) return null;
    return { prev: entity.params, next: { ...entity.params, reinforcement: fresh } };
  }
  if (isFoundationEntity(entity)) return buildFoundationReinforcePatch(entity, provider);
  if (isSlabEntity(entity)) {
    // ADR-476 — ΟΛΑ τα είδη πλάκας (εδαφόπλακα + αναρτημένη), auto-aware (parity κολόνα):
    //   absent → νέα πρόταση (auto:true)· manual (!auto) → null· auto → re-derive + guard.
    const stored = entity.params.structuralReinforcement;
    if (stored && !stored.auto) return null; // manual override → ΠΟΤΕ overwrite
    // ADR-498 — topology-aware συνθήκη στήριξης (πρόβολος → hogging άνω σχάρα) και στις δύο διαδρομές.
    const fresh: SlabFoundationReinforcement = stored
      ? resolveActiveSlabReinforcement(entity, provider, slabSupportCondition) ?? stored
      : { ...provider.suggestSlabFoundationReinforcement(buildSlabFoundationSectionContext(entity, slabSupportCondition)), auto: true };
    if (stored && !slabReinforcementMateriallyDiffers(stored, fresh)) return null;
    return { prev: entity.params, next: { ...entity.params, structuralReinforcement: fresh } };
  }
  return null;
}

/**
 * Foundation per-kind narrowing — το `suggestFootingReinforcement` επιστρέφει
 * discriminated `FootingReinforcement`· ο discriminator ταιριάζει με το ctx (άρα
 * με το `params.kind`), αλλά ο compiler το διασφαλίζει ρητά (μηδέν cast, N.2).
 */
function buildFoundationReinforcePatch(
  footing: FoundationEntity,
  provider: StructuralCodeProvider,
): ReinforcePatch | null {
  const p = footing.params;
  // ADR-477 — συνδετήρια δοκός = δοκός → auto-aware (parity κολόνα/δοκάρι/πλάκα):
  //   absent → νέα πρόταση (auto:true)· manual (!auto) → null· auto → re-derive + guard.
  if (p.kind === 'tie-beam') return buildTieBeamReinforcePatch(p, provider);
  // pad/strip: idempotent skip — ο σχεδιασμός τους (re-size) ζει στο ADR-464.
  if (p.reinforcement) return null;
  const r = provider.suggestFootingReinforcement(buildFootingSectionContextFromParams(p));
  switch (p.kind) {
    case 'pad':
      return r.kind === 'pad' ? { prev: p, next: { ...p, reinforcement: r } } : null;
    case 'strip':
      return r.kind === 'strip' ? { prev: p, next: { ...p, reinforcement: r } } : null;
  }
}

/**
 * ADR-477 — tie-beam auto-reinforce patch (parity με κολόνα/δοκάρι, S3 convergence guard):
 *   - absent           → νέα code-suggested πρόταση (`auto:true`).
 *   - manual (`!auto`) → `null` (Revit: χειροκίνητη υπέρβαση κλειδωμένη, user wins).
 *   - `auto:true`      → re-derive από ΤΡΕΧΟΥΣΑ γεωμετρία (`resolveActiveTieBeamReinforcement`)·
 *                        patch ΜΟΝΟ αν `beamReinforcementMateriallyDiffers` (anti-oscillation).
 */
function buildTieBeamReinforcePatch(
  p: TieBeamParams,
  provider: StructuralCodeProvider,
): ReinforcePatch | null {
  const stored = p.reinforcement;
  if (stored && stored.kind === 'tie-beam' && !stored.auto) return null; // manual → ΠΟΤΕ overwrite
  const suggested = provider.suggestFootingReinforcement(buildFootingSectionContextFromParams(p));
  if (suggested.kind !== 'tie-beam') return null;
  const fresh: TieBeamReinforcement =
    stored && stored.kind === 'tie-beam'
      ? resolveActiveTieBeamReinforcement(p, provider) ?? { ...suggested, auto: true }
      : { ...suggested, auto: true };
  if (stored && stored.kind === 'tie-beam' && !beamReinforcementMateriallyDiffers(stored, fresh)) {
    return null;
  }
  return { prev: p, next: { ...p, reinforcement: fresh } };
}
