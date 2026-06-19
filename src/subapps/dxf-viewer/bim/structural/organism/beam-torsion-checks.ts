/**
 * Beam torsion diagnostics (ADR-499 §C v1).
 *
 * Revit-grade προειδοποίηση όταν μια δοκός φέρει **μονόπλευρη πρόβολο-πλάκα** (ADR-498) που
 * την στρίβει με `T_Ed` μεγαλύτερο από τη βασική στρεπτική αντοχή `T_Rd,max` της διατομής
 * (θλιπτήρας σκυροδέματος, EC2 §6.3.2). Σε αυτή την περίπτωση **καμία ποσότητα συνδετήρων
 * δεν αρκεί** — απαιτείται μεγαλύτερη διατομή ή αλλαγή σχεδιασμού (η έσχατη παρέμβαση του
 * οράματος, ADR-487 §7· τροφοδοτεί το Slice D global feasibility).
 *
 * Mirror του `runSlabChecks` (ADR-498): warning ΜΟΝΟ όταν `T_Ed > T_Rd,max` (αλλιώς σιωπηλό —
 * οι στρεπτικοί συνδετήρες θα το καλύψουν στο πλήρες §6.3). Pure — zero React/DOM/Firestore.
 *
 * **Scope v1:** μόνο ανίχνευση (sensor). Η αυτο-διόρθωση (section-grow + στρεπτικός οπλισμός)
 * = πλήρες EC2 §6.3 (DEFER, νέα συνεδρία).
 *
 * @see ../loads/beam-torsion.ts — computeBeamDesignTorsion (το demand T_Ed)
 * @see ../codes/torsion-capacity.ts — plasticTorsionalResistanceKnm (το όριο T_Rd,max)
 * @see ./slab-checks.ts — runSlabChecks (το pattern mirror)
 * @see docs/centralized-systems/reference/adrs/ADR-499-auto-correcting-organism.md
 */

import type { Entity } from '../../../types/entities';
import { isBeamEntity } from '../../../types/entities';
import type { StructuralDiagnostic } from './structural-organism-types';
import { computeBeamDesignTorsion } from '../loads/beam-torsion';
import { plasticTorsionalResistanceKnm } from '../codes/torsion-capacity';
import { buildBeamSectionContext } from '../section-context';
import { DEFAULT_CONCRETE_GRADE, concreteFcdMpa } from '../concrete-grades';

/** i18n key prefix (ns `dxf-viewer-shell`) — κοινό με τα υπόλοιπα structural διαγνωστικά. */
const MSG = 'structuralOrganism.diagnostics';

/**
 * Έλεγχοι στρέψης δοκών πάνω στα entities της σκηνής (ADR-499 §C). Pure — δεν χρειάζεται
 * provider (το `T_Rd,max` είναι γεωμετρικό-υλικό). Κενό όταν καμία δοκός δεν φέρει πρόβολο-πλάκα.
 */
export function runBeamTorsionChecks(entities: readonly Entity[]): StructuralDiagnostic[] {
  const torsionByBeam = computeBeamDesignTorsion(entities);
  if (torsionByBeam.size === 0) return [];
  const out: StructuralDiagnostic[] = [];

  for (const e of entities) {
    if (!isBeamEntity(e)) continue;
    const tEdKnm = torsionByBeam.get(e.id) ?? 0;
    if (tEdKnm <= 0) continue;

    const ctx = buildBeamSectionContext(e);
    const fcd = concreteFcdMpa(ctx.concreteGrade ?? DEFAULT_CONCRETE_GRADE);
    const tRdMaxKnm = plasticTorsionalResistanceKnm(ctx.widthMm, ctx.depthMm, fcd);
    if (tRdMaxKnm <= 0 || tEdKnm <= tRdMaxKnm) continue; // η διατομή αντέχει → σιωπηλό

    out.push({
      id: `beamCantileverTorsionExceedsCapacity:${e.id}`,
      code: 'beamCantileverTorsionExceedsCapacity',
      severity: 'warning',
      messageKey: `${MSG}.beamCantileverTorsionExceedsCapacity`,
      primaryEntityId: e.id,
      entityIds: [e.id],
      messageParams: {
        tEd: tEdKnm.toFixed(1),
        tRd: tRdMaxKnm.toFixed(1),
        width: Math.round(ctx.widthMm),
        depth: Math.round(ctx.depthMm),
      },
    });
  }
  return out;
}
