/**
 * Raft / εδαφόπλακα bearing check — EC7 average pressure (ADR-464, Slice 5).
 *
 * Parity του ελέγχου έδρασης για raft/γενική κοιτόστρωση (`SlabEntity` kind
 * foundation/ground): η εδαφόπλακα φέρει ομοιόμορφα όλο το κτίριο, οπότε ο έλεγχος
 * = **μέση πίεση εδάφους** N_ολικό/A vs σ_allow (μηδέν εκκεντρότητα — uniform).
 *
 * Πηγή φορτίου (FEM-free): tributary area-load model (ίδιος SSoT `areaLoadResultant`
 * με τον per-column takedown) πάνω στην ΟΛΗ επιφάνεια της πλάκας × όροφοι, + ίδιο
 * βάρος πλάκας. Αδρανές (null) χωρίς σ_allow ή area loads/ορόφους (advisory). Punching/
 * κάμψη raft = DEFER (απαιτούν per-column κατανομή — ξεχωριστό slice).
 *
 * geometry-is-SSoT· reuse `computeBasePressure`/`makeDesignCheck` (μηδέν διπλότυπο).
 *
 * @see ./footing-bearing.ts — computeBasePressure / makeDesignCheck
 * @see ../loads/load-takedown.ts — areaLoadResultant (κοινό area→load)
 * @see docs/centralized-systems/reference/adrs/ADR-464-advanced-footing-reinforcement.md
 */

import type { SlabEntity } from '../../types/slab-types';
import { buildSlabFoundationSectionContext } from '../section-context';
import { areaLoadResultant } from '../loads/load-takedown';
import { concreteWeightKg } from '../concrete-grades';
import { computeBasePressure, makeDesignCheck } from './footing-bearing';
import type { BearingResult } from './footing-design-types';

const GRAVITY_MS2 = 9.81;
const MM2_TO_M2 = 1 / 1e6;

/** Building-level παράμετροι raft bearing (όροφοι + area loads + σ_allow). */
export interface RaftBearingInput {
  readonly storeyCount: number;
  readonly deadAreaLoadKpa: number;
  readonly liveAreaLoadKpa: number;
  readonly soilBearingCapacityKpa: number;
}

/**
 * Μέση πίεση έδρασης εδαφόπλακας (SLS) vs σ_allow, ή `null` (χωρίς σ_allow / area
 * loads / έγκυρη επιφάνεια). Self-weight πλάκας προστίθεται στο SLS αξονικό (μόνιμο).
 */
export function computeRaftBearing(slab: SlabEntity, input: RaftBearingInput): BearingResult | null {
  if (!(input.soilBearingCapacityKpa > 0)) return null;
  const ctx = buildSlabFoundationSectionContext(slab);
  const areaM2 = ctx.grossAreaMm2 * MM2_TO_M2;
  if (areaM2 <= 0) return null;

  const r = areaLoadResultant(areaM2, input.storeyCount, input.deadAreaLoadKpa, input.liveAreaLoadKpa);
  const serviceAxialKn = r.deadAxialKn + r.liveAxialKn;
  if (serviceAxialKn <= 0) return null; // καμία πηγή φορτίου → advisory (αδρανές)

  const volumeM3 = areaM2 * (ctx.thicknessMm / 1000);
  const selfWeightKn = (concreteWeightKg(volumeM3) * GRAVITY_MS2) / 1000;
  const pressure = computeBasePressure(serviceAxialKn + selfWeightKn, 0, 0, ctx.widthMm, ctx.lengthMm);
  return { ...pressure, check: makeDesignCheck(pressure.pMaxKpa, input.soilBearingCapacityKpa) };
}
