/**
 * Footing design diagnostics (ADR-464, Slice 1).
 *
 * Revit-grade analytical warnings από τα φορτία σχεδιασμού πεδίλου
 * (`FoundationParams.appliedLoad`) + την εδαφική παραδοχή (σ_allow building
 * setting). Slice 1 = `bearingInadequate` (έλεγχος έδρασης μεμονωμένου πεδίλου,
 * EC7). Διάτρηση/κάμψη προστίθενται additive (Slices 2-3).
 *
 * Pure — μηδέν mutation/persist· i18n keys + DERIVED params μόνο (N.11). Engine
 * αδρανές (μηδέν εύρημα) όταν: δεν υπάρχει σ_allow, ή το πέδιλο δεν έχει
 * `appliedLoad`, ή δεν είναι `pad` (μεμονωμένο) — advisory, όχι θόρυβος.
 *
 * @see ./footing-design.ts — ο engine που καλείται
 * @see ../organism/reinforcement-checks.ts — ο δίδυμος runner (ρ-checks)
 * @see docs/centralized-systems/reference/adrs/ADR-464-advanced-footing-reinforcement.md
 */

import type { Entity } from '../../../types/entities';
import { isFoundationEntity } from '../../../types/entities';
import type { StructuralCodeProvider } from '../codes/structural-code-types';
import { KERN_RATIO } from './footing-bearing';
import { computeFootingDesign } from './footing-design';
import { buildPadFootingDesignInput } from './footing-design-input';
import { computeRaftBearing } from './raft-bearing';
import { isFoundationSlabEntity } from '../section-context';
import type { StructuralDiagnostic } from '../organism/structural-organism-types';

/**
 * ADR-464 Slice 5 — building-level παράμετροι του raft bearing (tributary area-load
 * model: όροφοι + κατανεμημένα φορτία). Absent → ο raft έλεγχος αδρανεί (advisory).
 */
export interface RaftLoadContext {
  readonly storeyCount: number;
  readonly deadAreaLoadKpa: number;
  readonly liveAreaLoadKpa: number;
}

/** i18n key prefix (ns `dxf-viewer-shell`) — κοινό με τα reinforcement διαγνωστικά. */
const MSG = 'structuralOrganism.diagnostics';

const pct = (x: number): string => (x * 100).toFixed(0);
const pct1 = (x: number): string => (x * 100).toFixed(1);
const round = (x: number): string => (Number.isFinite(x) ? x.toFixed(0) : '∞');
const mpa = (x: number): string => (Number.isFinite(x) ? x.toFixed(2) : '∞');

interface BearingLike {
  readonly pMaxKpa: number;
  readonly check: { readonly adequate: boolean; readonly capacity: number; readonly utilization: number };
}

/** Push `bearingInadequate` αν η έδραση (πέδιλο ή raft) υπερβαίνει το σ_allow. SSoT. */
function pushBearingInadequate(out: StructuralDiagnostic[], entityId: string, bearing: BearingLike): void {
  if (bearing.check.adequate) return;
  out.push({
    id: `bearingInadequate:${entityId}`,
    code: 'bearingInadequate',
    severity: 'error',
    messageKey: `${MSG}.bearingInadequate`,
    primaryEntityId: entityId,
    entityIds: [entityId],
    messageParams: {
      pMax: round(bearing.pMaxKpa),
      capacity: round(bearing.check.capacity),
      utilization: pct(bearing.check.utilization),
    },
  });
}

/**
 * Τρέξε τους ελέγχους σχεδιασμού θεμελίωσης πάνω στα entities της σκηνής. Pure —
 * απαιτεί τον code provider (συντελεστές) + την εδαφική παραδοχή σ_allow. Επιστρέφει
 * κενό όταν δεν έχει οριστεί σ_allow (advisory — δεν ελέγχεται χωρίς έδαφος).
 */
export function runFootingDesignChecks(
  entities: readonly Entity[],
  provider: StructuralCodeProvider,
  soilBearingCapacityKpa: number | undefined,
  raftLoad?: RaftLoadContext,
): StructuralDiagnostic[] {
  if (!soilBearingCapacityKpa || soilBearingCapacityKpa <= 0) return [];
  const out: StructuralDiagnostic[] = [];
  for (const footing of entities) {
    if (!isFoundationEntity(footing)) continue;
    const input = buildPadFootingDesignInput(footing, provider, soilBearingCapacityKpa, entities);
    if (!input) continue;
    const { bearing, flexure, punching, oneWayShear } = computeFootingDesign(input);

    pushBearingInadequate(out, footing.id, bearing);

    // ADR-464 Slice 2 — έκκεντρο πέδιλο (e>kern, ULS): απαιτείται άνω σχάρα (hogging).
    if (flexure.hoggingGoverns) {
      const ratio = Math.max(flexure.eccentricityRatioX, flexure.eccentricityRatioY);
      out.push({
        id: `padEccentricHogging:${footing.id}`,
        code: 'padEccentricHogging',
        severity: 'warning',
        messageKey: `${MSG}.padEccentricHogging`,
        primaryEntityId: footing.id,
        entityIds: [footing.id],
        messageParams: { ratio: pct1(ratio), kern: pct1(KERN_RATIO) },
      });
    }

    // ADR-464 Slice 3 — διάτρηση (EC2 §6.4): v_Ed > v_Rd,c στο βασικό περίγραμμα.
    if (!punching.check.adequate) {
      out.push({
        id: `punchingInadequate:${footing.id}`,
        code: 'punchingInadequate',
        severity: 'error',
        messageKey: `${MSG}.punchingInadequate`,
        primaryEntityId: footing.id,
        entityIds: [footing.id],
        messageParams: {
          vEd: mpa(punching.vEdMpa),
          vRd: mpa(punching.vRdcMpa),
          utilization: pct(punching.check.utilization),
        },
      });
    }

    // ADR-464 Slice 3 — τέμνουσα μονής διεύθυνσης (EC2 §6.2.2) στην κρίσιμη διατομή d.
    if (!oneWayShear.check.adequate) {
      out.push({
        id: `oneWayShearInadequate:${footing.id}`,
        code: 'oneWayShearInadequate',
        severity: 'error',
        messageKey: `${MSG}.oneWayShearInadequate`,
        primaryEntityId: footing.id,
        entityIds: [footing.id],
        messageParams: {
          vEd: mpa(oneWayShear.check.demand),
          vRd: mpa(oneWayShear.vRdcMpa),
          utilization: pct(oneWayShear.check.utilization),
        },
      });
    }
  }

  // ADR-464 Slice 5 — raft/εδαφόπλακα μέση έδραση (uniform pressure vs σ_allow).
  // Αδρανές χωρίς area-load context (advisory — δεν υπάρχει πηγή φορτίου).
  if (raftLoad) {
    for (const slab of entities) {
      if (!isFoundationSlabEntity(slab)) continue;
      const bearing = computeRaftBearing(slab, { ...raftLoad, soilBearingCapacityKpa });
      if (bearing) pushBearingInadequate(out, slab.id, bearing);
    }
  }
  return out;
}
