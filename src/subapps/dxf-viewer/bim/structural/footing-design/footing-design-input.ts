/**
 * Footing design input builder (ADR-464, Slices 1b-3).
 *
 * ΕΝΑ σημείο που χτίζει το `FootingDesignInput` ΑΠΟ ένα `FoundationEntity` (pad) +
 * provider + σ_allow — ώστε ΚΑΙ ο diagnostics runner (`footing-design-checks`) ΚΑΙ
 * τα UI readouts (`foundation-structural-bridge`) να το μοιράζονται (μηδέν
 * duplicate, N.0.2). Επιστρέφει `null` όταν δεν εφαρμόζεται (μη-pad ή μηδέν φορτίο).
 *
 * Slice 3: με `entities` resolve-άρει τις διαστάσεις της στηρίζουσας κολώνας μέσω
 * του explicit FK `ColumnParams.footingId` (organism, explicit-FK-wins) → απαραίτητες
 * για διάτρηση/τέμνουσα. Χωρίς `entities` → column dims 0 → οι έλεγχοι αδρανούν
 * (advisory, π.χ. UI bearing readout). ρl & κατηγορία σκυροδέματος αντλούνται από το
 * πέδιλο μόνο (DEFER per-footing grade input → DEFAULT_CONCRETE_GRADE).
 *
 * Pure — zero React/DOM/Firestore. geometry-is-SSoT.
 *
 * @see ./footing-design.ts
 */

import type { Entity } from '../../../types/entities';
import type { FoundationEntity } from '../../types/foundation-types';
import { resolveSupportingColumn } from './footing-support-column';
import { concreteWeightKg, DEFAULT_CONCRETE_GRADE } from '../concrete-grades';
import type { StructuralCodeProvider } from '../codes/structural-code-types';
import { combineSls, combineUls } from '../loads/load-combinations';
import { isZeroMemberLoad, resolveAppliedMemberLoad } from '../loads/structural-loads-types';
import type { ColumnFemAxial } from '../analytical/column-fem-axial';
import { computeFootingReinforcementQuantities } from '../reinforcement/footing-reinforcement-compute';
import { buildColumnSectionContext, buildFootingSectionContext } from '../section-context';
import type { FootingDesignInput } from './footing-design-types';

/** Επιτάχυνση βαρύτητας (m/s²) — μετατροπή μάζας σκυροδέματος σε φορτίο. */
const GRAVITY_MS2 = 9.81;

/** Ίδιο βάρος πεδίλου (kN) από τον όγκο σκυροδέματός του (m³). */
function footingSelfWeightKn(footing: FoundationEntity): number {
  return (concreteWeightKg(footing.geometry.volume) * GRAVITY_MS2) / 1000;
}

/**
 * Διαστάσεις στηρίζουσας κολώνας (bbox mm) μέσω explicit FK `footingId` (organism,
 * explicit-FK-wins). Πρώτη κολώνα που δείχνει στο πέδιλο· spatial fallback = DEFER
 * (advisory). `null` όταν δεν υπάρχει attached κολώνα.
 */
function resolveSupportingColumnDims(
  footingId: string,
  entities: readonly Entity[],
): { widthMm: number; depthMm: number } | null {
  const column = resolveSupportingColumn(footingId, entities);
  if (!column) return null;
  const s = buildColumnSectionContext(column);
  return { widthMm: s.widthMm, depthMm: s.depthMm };
}

/**
 * Ποσοστό εφελκυόμενου (κάτω) οπλισμού ρl του πεδίλου — από το stored design ή, αν
 * απουσιάζει, το code-suggested ελάχιστο (συντηρητικό κάτω όριο για το v_Rd,c).
 */
function resolvePadFlexuralRatio(footing: FoundationEntity, provider: StructuralCodeProvider): number {
  const ctx = buildFootingSectionContext(footing);
  if (ctx.kind !== 'pad') return 0;
  const stored = footing.params.reinforcement;
  const r = stored && stored.kind === 'pad' ? stored : provider.suggestFootingReinforcement(ctx);
  if (r.kind !== 'pad') return 0;
  return computeFootingReinforcementQuantities(ctx, r).ratio;
}

/**
 * `FootingDesignInput` για μεμονωμένο πέδιλο (pad) με ορισμένο φορτίο, ή `null`
 * (μη-pad / μηδενικό φορτίο → engine αδρανές). `entities` (προαιρετικά) → διαστάσεις
 * στηρίζουσας κολώνας για διάτρηση/τέμνουσα· χωρίς → 0 (οι έλεγχοι αδρανούν).
 *
 * **ADR-497 — FEM-authoritative axial:** όταν δοθεί `femAxialOverride` (η αντίδραση
 * βάσης της στηρίζουσας κολώνας από το engaged FEM, ADR-481), το **αξονικό** SLS/ULS
 * **υπερισχύει** του grid-tributary `appliedLoad` (κρατώντας τυχόν ροπές του). Έτσι ο
 * πρόβολος (ADR-495) ρέει στην έδραση/διάτρηση/μέγεθος πεδίλου. Χωρίς override → tributary
 * seed (μηδέν regression). Μία ιεραρχία (FEM engaged → υπερισχύει· αλλιώς tributary).
 */
export function buildPadFootingDesignInput(
  footing: FoundationEntity,
  provider: StructuralCodeProvider,
  soilBearingCapacityKpa: number,
  entities?: readonly Entity[],
  femAxialOverride?: ColumnFemAxial,
): FootingDesignInput | null {
  if (footing.params.kind !== 'pad') return null;
  const memberLoad = resolveAppliedMemberLoad(footing.params.appliedLoad);
  // Αδρανές μόνο όταν ΚΑΙ tributary ΚΑΙ FEM override είναι μηδέν (μηδέν φορτίο οργανισμού).
  if (isZeroMemberLoad(memberLoad) && !femAxialOverride) return null;
  const factors = provider.footingDesignFactors();
  // cnom από τα code limits (SSoT) — ενεργό βάθος d της κάμψης/διάτρησης.
  const coverMm = provider.footingReinforcementLimits(buildFootingSectionContext(footing)).nominalCoverMm;
  const column = entities ? resolveSupportingColumnDims(footing.id, entities) : null;
  const serviceLoad = femAxialOverride
    ? { ...combineSls(memberLoad), axialKn: femAxialOverride.slsKn }
    : combineSls(memberLoad);
  const ulsLoad = femAxialOverride
    ? { ...combineUls(memberLoad, factors.combination), axialKn: femAxialOverride.ulsKn }
    : combineUls(memberLoad, factors.combination);
  return {
    widthMm: footing.params.width,
    lengthMm: footing.params.length,
    thicknessMm: footing.params.thicknessMm,
    columnWidthMm: column?.widthMm ?? 0,
    columnDepthMm: column?.depthMm ?? 0,
    serviceLoad,
    ulsLoad,
    soilBearingCapacityKpa,
    footingSelfWeightKn: footingSelfWeightKn(footing),
    coverMm,
    concreteGrade: DEFAULT_CONCRETE_GRADE,
    flexuralRatioL: resolvePadFlexuralRatio(footing, provider),
  };
}
