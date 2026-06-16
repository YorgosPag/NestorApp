/**
 * Footing design diagnostics (ADR-464, Slice 1).
 *
 * Revit-grade analytical warnings πάνω στον DERIVED στατικό οργανισμό + τα φορτία
 * (manual analytical loads κολώνας) + την εδαφική παραδοχή (σ_allow). Slice 1 =
 * `bearingInadequate` (έλεγχος έδρασης μεμονωμένου πεδίλου, EC7). Διάτρηση/κάμψη
 * προστίθενται additive (Slices 2-3).
 *
 * **ΞΕΧΩΡΙΣΤΟΣ runner** από το `runReinforcementChecks` — χρειάζεται επιπλέον το
 * `σ_allow` (building setting) που τα reinforcement διαγνωστικά δεν έχουν· έτσι το
 * υπάρχον `reinforcement-checks.ts` μένει αμετάβλητο (lower risk). Pure — μηδέν
 * mutation/persist· i18n keys + DERIVED params μόνο (N.11).
 *
 * Engine αδρανές (μηδέν εύρημα) όταν: δεν υπάρχει σ_allow, ή η κολώνα δεν έχει
 * `appliedLoad`, ή το πέδιλο δεν είναι `pad` (μεμονωμένο) — advisory, όχι θόρυβος.
 *
 * @see ./footing-design.ts — ο engine που καλείται
 * @see ../organism/reinforcement-checks.ts — ο δίδυμος runner (ρ-checks)
 * @see docs/centralized-systems/reference/adrs/ADR-464-advanced-footing-reinforcement.md
 */

import type { Entity } from '../../../types/entities';
import { isColumnEntity, isFoundationEntity } from '../../../types/entities';
import type { FoundationEntity } from '../../types/foundation-types';
import type { ColumnEntity } from '../../types/column-types';
import { concreteWeightKg } from '../concrete-grades';
import { buildColumnSectionContext } from '../section-context';
import type { StructuralCodeProvider } from '../codes/structural-code-types';
import {
  combineSls,
  combineUls,
} from '../loads/load-combinations';
import {
  isZeroMemberLoad,
  resolveAppliedMemberLoad,
} from '../loads/structural-loads-types';
import { computeFootingDesign } from './footing-design';
import type { FootingDesignInput } from './footing-design-types';
import type { StructuralDiagnostic, StructuralGraph } from '../organism/structural-organism-types';

/** i18n key prefix (ns `dxf-viewer-shell`) — κοινό με τα reinforcement διαγνωστικά. */
const MSG = 'structuralOrganism.diagnostics';

/** Επιτάχυνση βαρύτητας (m/s²) — μετατροπή μάζας σκυροδέματος σε φορτίο. */
const GRAVITY_MS2 = 9.81;

/** Ίδιο βάρος πεδίλου (kN) από τον όγκο σκυροδέματός του (m³). */
function footingSelfWeightKn(footing: FoundationEntity): number {
  return (concreteWeightKg(footing.geometry.volume) * GRAVITY_MS2) / 1000;
}

/** Χτίζει την είσοδο σχεδιασμού για ζεύγος πέδιλο(pad)↔κολόνα, ή null αν δεν εφαρμόζεται. */
function buildPadDesignInput(
  footing: FoundationEntity,
  column: ColumnEntity,
  provider: StructuralCodeProvider,
  soilBearingCapacityKpa: number,
): FootingDesignInput | null {
  if (footing.params.kind !== 'pad') return null; // Slice 1 — μεμονωμένο πέδιλο μόνο
  const memberLoad = resolveAppliedMemberLoad(column.params.appliedLoad);
  if (isZeroMemberLoad(memberLoad)) return null; // χωρίς φορτίο → engine αδρανές
  const col = buildColumnSectionContext(column);
  const factors = provider.footingDesignFactors();
  return {
    widthMm: footing.params.width,
    lengthMm: footing.params.length,
    thicknessMm: footing.params.thicknessMm,
    columnWidthMm: col.widthMm,
    columnDepthMm: col.depthMm,
    serviceLoad: combineSls(memberLoad),
    ulsLoad: combineUls(memberLoad, factors.combination),
    soilBearingCapacityKpa,
    footingSelfWeightKn: footingSelfWeightKn(footing),
  };
}

const pct = (x: number): string => (x * 100).toFixed(0);
const round = (x: number): string => (Number.isFinite(x) ? x.toFixed(0) : '∞');

/**
 * Τρέξε τους ελέγχους σχεδιασμού θεμελίωσης. Pure — απαιτεί τον DERIVED graph (FK
 * πέδιλο↔κολόνα μέσω `footing-bearing` ακμών), τα entities (φορτία/γεωμετρία), τον
 * code provider (συντελεστές), και την εδαφική παραδοχή σ_allow. Επιστρέφει κενό
 * όταν δεν έχει οριστεί σ_allow (advisory — δεν μπορεί να ελεγχθεί χωρίς έδαφος).
 */
export function runFootingDesignChecks(
  graph: StructuralGraph,
  entities: readonly Entity[],
  provider: StructuralCodeProvider,
  soilBearingCapacityKpa: number | undefined,
): StructuralDiagnostic[] {
  if (!soilBearingCapacityKpa || soilBearingCapacityKpa <= 0) return [];
  const entityById = new Map<string, Entity>(entities.map((e) => [e.id, e]));
  const out: StructuralDiagnostic[] = [];
  for (const edge of graph.edges) {
    if (edge.kind !== 'footing-bearing') continue;
    const footing = entityById.get(edge.supportId);
    const column = entityById.get(edge.supportedId);
    if (!footing || !column || !isFoundationEntity(footing) || !isColumnEntity(column)) continue;
    const input = buildPadDesignInput(footing, column, provider, soilBearingCapacityKpa);
    if (!input) continue;
    const { bearing } = computeFootingDesign(input);
    if (bearing.check.adequate) continue;
    out.push({
      id: `bearingInadequate:${footing.id}`,
      code: 'bearingInadequate',
      severity: 'error',
      messageKey: `${MSG}.bearingInadequate`,
      primaryEntityId: footing.id,
      entityIds: [footing.id, column.id],
      messageParams: {
        pMax: round(bearing.pMaxKpa),
        capacity: round(bearing.check.capacity),
        utilization: pct(bearing.check.utilization),
      },
    });
  }
  return out;
}
