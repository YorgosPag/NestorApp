/**
 * column-support-moment — SSoT ντετερμινιστικής ροπής σχεδιασμού **στηρίζουσας κολώνας**
 * από δοκάρι-πρόβολο (ADR-502 Slice 2, mirror του `beam-torsion.ts`).
 *
 * Όταν ένα δοκάρι γίνεται πρόβολος (ADR-486, ακριβώς 1 φέρουσα κολώνα), η πάκτωση στη
 * ρίζα παραδίδει ροπή `M = w·L²/2` στη μοναδική στηρίζουσα κολώνα (moment-frame κόμβος)·
 * η κολώνα πρέπει να την παραλάβει (M-N διατομή + οπλισμός). Σήμερα αυτό φτάνει στην
 * κολώνα **μόνο** μέσω FEM (engaged-gated)· εδώ το κάνουμε **στατικό & always-on**.
 *
 * **ΕΝΑ SSoT, μηδέν νέα μηχανική:** το `w·L²/2` του προβόλου είναι ΑΚΡΙΒΩΣ το
 * `beamDesignMomentNmm` που ήδη υπολογίζει ο οπλισμός+sizing του ίδιου του δοκαριού
 * (`supportType='cantilever'` → `spanMomentDivisor ÷2`). Το μοιραζόμαστε → μηδέν διπλή αλήθεια.
 *
 * **Στατικό, ΟΧΙ FEM:** ντετερμινιστική συνάρτηση γεωμετρίας+φορτίου → idempotent → ζει
 * live μέσα στο organism pass (μηδέν επίλυση, μηδέν reactive trigger — μάθημα ADR-491).
 * Όταν ο μηχανικός «παρατηρεί στατικά» (engaged), το FEM (ADR-491) **υπερισχύει** — η
 * ιεραρχία `FEM ?? static` ζει στο `resolveActiveColumnDesignMoment` (active-reinforcement).
 *
 * Pure — zero React/DOM/Firestore. Έξοδος: `Map<columnId → M (kNm)>` (additive όταν πολλοί
 * πρόβολοι καταλήγουν στην ίδια κολώνα). Κενό όταν καμία πρόβολος-δοκός.
 *
 * @see ./beam-torsion.ts — το αδελφό pattern (στρέψη δοκού από πρόβολο-πλάκα)
 * @see ../codes/suggest-reinforcement.ts — beamDesignMomentNmm (το κοινό w·L²/2)
 * @see ../active-reinforcement.ts — resolveActiveColumnDesignMoment (FEM ?? static ιεραρχία)
 * @see docs/centralized-systems/reference/adrs/ADR-502-live-reaction-aware-takedown.md
 */

import type { Entity } from '../../../types/entities';
import { isBeamEntity } from '../../../types/entities';
import type { StructuralGraph } from '../organism/structural-organism-types';
import { resolveBeamSupportCondition } from '../organism/derive-beam-support';
import { beamSupportColumnIds } from './load-path-walk';
import { buildBeamSectionContext } from '../section-context';
import { beamDesignMomentNmm } from '../codes/suggest-reinforcement';

const NMM_TO_KNM = 1e6;

/**
 * Ροπή σχεδιασμού `M` (kNm) ανά **στηρίζουσα κολώνα** από τα δοκάρια-προβόλους που
 * πακτώνονται σε αυτήν. Cantilever = ακριβώς 1 φέρουσα κολώνα (ADR-486): η κολώνα
 * παραλαμβάνει το `w·L²/2` του προβόλου. Additive (>1 πρόβολος → ίδια κολώνα). Κενό
 * όταν καμία πρόβολος-δοκός. Pure — `M` = γεωμετρία+φορτίο (μηδέν store).
 */
export function buildColumnSupportMomentMap(
  entities: readonly Entity[],
  graph: StructuralGraph,
): Map<string, number> {
  const out = new Map<string, number>();
  for (const e of entities) {
    if (!isBeamEntity(e)) continue;
    const cond = resolveBeamSupportCondition(graph, e.id, e.params.supportType);
    if (cond.supportType !== 'cantilever') continue;
    const cols = beamSupportColumnIds(graph, e.id);
    if (cols.length !== 1) continue; // πρόβολος = ακριβώς 1 στήριξη (ρητό stored override → skip)
    const mKnm = beamDesignMomentNmm(buildBeamSectionContext(e, 'cantilever')) / NMM_TO_KNM;
    if (mKnm <= 0) continue;
    out.set(cols[0], (out.get(cols[0]) ?? 0) + mKnm);
  }
  return out;
}
