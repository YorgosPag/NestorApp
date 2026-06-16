/**
 * Footing design input builder (ADR-464, Slice 1b).
 *
 * ΕΝΑ σημείο που χτίζει το `FootingDesignInput` ΑΠΟ ένα `FoundationEntity` (pad) +
 * provider + σ_allow — ώστε ΚΑΙ ο diagnostics runner (`footing-design-checks`) ΚΑΙ
 * τα UI readouts (`foundation-structural-bridge`) να το μοιράζονται (μηδέν
 * duplicate, N.0.2). Επιστρέφει `null` όταν δεν εφαρμόζεται (μη-pad ή μηδέν φορτίο).
 *
 * Pure — zero React/DOM/Firestore. geometry-is-SSoT.
 *
 * @see ./footing-design.ts
 */

import type { FoundationEntity } from '../../types/foundation-types';
import { concreteWeightKg } from '../concrete-grades';
import type { StructuralCodeProvider } from '../codes/structural-code-types';
import { combineSls, combineUls } from '../loads/load-combinations';
import { isZeroMemberLoad, resolveAppliedMemberLoad } from '../loads/structural-loads-types';
import { buildFootingSectionContext } from '../section-context';
import type { FootingDesignInput } from './footing-design-types';

/** Επιτάχυνση βαρύτητας (m/s²) — μετατροπή μάζας σκυροδέματος σε φορτίο. */
const GRAVITY_MS2 = 9.81;

/** Ίδιο βάρος πεδίλου (kN) από τον όγκο σκυροδέματός του (m³). */
function footingSelfWeightKn(footing: FoundationEntity): number {
  return (concreteWeightKg(footing.geometry.volume) * GRAVITY_MS2) / 1000;
}

/**
 * `FootingDesignInput` για μεμονωμένο πέδιλο (pad) με ορισμένο φορτίο, ή `null`
 * (μη-pad / μηδενικό φορτίο → engine αδρανές). Column dims = 0 (χρειάζονται μόνο
 * για διάτρηση/κάμψη, Slices 2-3).
 */
export function buildPadFootingDesignInput(
  footing: FoundationEntity,
  provider: StructuralCodeProvider,
  soilBearingCapacityKpa: number,
): FootingDesignInput | null {
  if (footing.params.kind !== 'pad') return null;
  const memberLoad = resolveAppliedMemberLoad(footing.params.appliedLoad);
  if (isZeroMemberLoad(memberLoad)) return null;
  const factors = provider.footingDesignFactors();
  // cnom από τα code limits (SSoT) — ενεργό βάθος d της κάμψης (Slice 2).
  const coverMm = provider.footingReinforcementLimits(buildFootingSectionContext(footing)).nominalCoverMm;
  return {
    widthMm: footing.params.width,
    lengthMm: footing.params.length,
    thicknessMm: footing.params.thicknessMm,
    columnWidthMm: 0,
    columnDepthMm: 0,
    serviceLoad: combineSls(memberLoad),
    ulsLoad: combineUls(memberLoad, factors.combination),
    soilBearingCapacityKpa,
    footingSelfWeightKn: footingSelfWeightKn(footing),
    coverMm,
  };
}
