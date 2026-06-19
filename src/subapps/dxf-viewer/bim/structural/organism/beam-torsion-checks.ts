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
import type { StructuralDiagnostic } from './structural-organism-types';
import { assessBeamTorsion } from '../loads/beam-torsion';

/** i18n key prefix (ns `dxf-viewer-shell`) — κοινό με τα υπόλοιπα structural διαγνωστικά. */
const MSG = 'structuralOrganism.diagnostics';

/**
 * Έλεγχοι στρέψης δοκών πάνω στα entities της σκηνής (ADR-499 §C). Pure — δεν χρειάζεται
 * provider (το `T_Rd,max` είναι γεωμετρικό-υλικό). Κενό όταν καμία δοκός δεν φέρει πρόβολο-πλάκα.
 *
 * **Warning ΜΟΝΟ σε `'growToFix'`** (ADR-499 §D): υπερβαίνει την τρέχουσα διατομή αλλά λύνεται
 * μεγαλώνοντας το ύψος («μεγάλωσε τη διατομή»). Το `'infeasible'` (ανέφικτο ακόμη και στο
 * πρακτικό μέγιστο) κλιμακώνεται σε **error** από το `feasibility-checks` → ποτέ διπλό μήνυμα.
 */
export function runBeamTorsionChecks(entities: readonly Entity[]): StructuralDiagnostic[] {
  const out: StructuralDiagnostic[] = [];
  for (const [beamId, a] of assessBeamTorsion(entities)) {
    if (a.classification !== 'growToFix') continue;
    out.push({
      id: `beamCantileverTorsionExceedsCapacity:${beamId}`,
      code: 'beamCantileverTorsionExceedsCapacity',
      severity: 'warning',
      messageKey: `${MSG}.beamCantileverTorsionExceedsCapacity`,
      primaryEntityId: beamId,
      entityIds: [beamId],
      messageParams: {
        tEd: a.tEdKnm.toFixed(1),
        tRd: a.tRdMaxCurrentKnm.toFixed(1),
        width: Math.round(a.widthMm),
        depth: Math.round(a.depthMm),
      },
    });
  }
  return out;
}
