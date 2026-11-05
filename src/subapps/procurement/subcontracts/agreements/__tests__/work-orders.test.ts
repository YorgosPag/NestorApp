/**
 * ADR-928 §5.24 — οι εντολές εργασίας ως δεδομένα: ο αριθμός είναι η θέση στο append-only `assignments`, η κρίση είναι
 * του γραφέα (`refuseAssignment`) + το δικαίωμα στο ΕΡΓΟ-ΣΤΟΧΟ, ποτέ τρίτη λογική.
 */

import { refuseAssignment } from '../agreement-lifecycle';
import { assignableMasters, latestWorkOrderFor, workOrderBlock, workOrdersOf } from '../work-orders';
import type { SiteAssignment, SubcontractAgreement } from '../../types/agreement';
import { sampleAgreement, sampleProjectIdentity } from './agreement-fixtures';

const order = (id: string, projectId: string, startDate: string | null = null): SiteAssignment => ({
  id, project: sampleProjectIdentity(projectId), startDate, durationDays: null, note: null, assignedBy: 'u_pm', assignedAt: '2026-11-20T08:00:00.000Z',
});

function master(status: SubcontractAgreement['status'], assignments: readonly SiteAssignment[] = []): SubcontractAgreement {
  return sampleAgreement({ id: `sca_${status}`, status, scope: { kind: 'multi_project', assignments }, projectIds: assignments.map((a) => a.project.projectId) });
}

describe('workOrdersOf — ο αριθμός είναι η θέση, σταθερός', () => {
  it('1, 2, 3 με τη σειρά έκδοσης· νέα εντολή δεν αλλάζει τους παλιούς αριθμούς', () => {
    const before = workOrdersOf(master('accepted', [order('a', 'proj_1'), order('b', 'proj_2')]));
    const after = workOrdersOf(master('accepted', [order('a', 'proj_1'), order('b', 'proj_2'), order('c', 'proj_1')]));
    expect(before.map((o) => [o.number, o.assignment.id])).toEqual([[1, 'a'], [2, 'b']]);
    expect(after.slice(0, 2)).toEqual(before);
    expect(after[2].number).toBe(3);
  });

  it('συμφωνητικό ενός έργου ⇒ καμία εντολή', () => {
    expect(workOrdersOf(sampleAgreement())).toEqual([]);
  });
});

describe('latestWorkOrderFor — ενημέρωση για το ίδιο έργο', () => {
  const agreement = master('in_execution', [order('a', 'proj_1', '2026-12-01'), order('b', 'proj_2'), order('c', 'proj_1', '2027-02-01')]);
  it('η ΠΙΟ ΠΡΟΣΦΑΤΗ εντολή του έργου, με τον αριθμό της', () => {
    expect(latestWorkOrderFor(agreement, 'proj_1')).toMatchObject({ number: 3, assignment: { id: 'c' } });
  });
  it('έργο χωρίς εντολή ⇒ null', () => {
    expect(latestWorkOrderFor(agreement, 'proj_9')).toBeNull();
  });
});

describe('workOrderBlock — πρώτα η σύμβαση, μετά ο στόχος, μετά το δικαίωμα', () => {
  it.each(['draft', 'issued', 'completed', 'terminated'] as const)('%s ⇒ η άρνηση του γραφέα, όποιο κι αν είναι το δικαίωμα', (status) => {
    expect(workOrderBlock(master(status), 'proj_1', 'granted')).toEqual({ kind: 'refusal', refusal: refuseAssignment(master(status)) });
  });

  it('συμφωνητικό ενός έργου ⇒ άρνηση (δεν δέχεται εντολές)', () => {
    expect(workOrderBlock(sampleAgreement({ status: 'accepted' }), 'proj_1', 'granted')?.kind).toBe('refusal');
  });

  it('χωρίς έργο-στόχο ⇒ noTarget · απάντηση σε αναμονή ⇒ checking (fail-closed) · άρνηση ⇒ denied · αλλιώς null', () => {
    const accepted = master('accepted');
    expect(workOrderBlock(accepted, null, 'granted')).toEqual({ kind: 'noTarget' });
    expect(workOrderBlock(accepted, 'proj_1', 'pending')).toEqual({ kind: 'checking' });
    expect(workOrderBlock(accepted, 'proj_1', 'denied')).toEqual({ kind: 'denied' });
    expect(workOrderBlock(accepted, 'proj_1', 'granted')).toBeNull();
    expect(workOrderBlock(master('in_execution'), 'proj_1', 'granted')).toBeNull();
  });
});

describe('assignableMasters — μόνο όσες δέχονται εντολή τώρα, με τον κριτή του γραφέα', () => {
  it('αποδεκτή · σε εκτέλεση — όχι πρόχειρη, εκδοθείσα, ολοκληρωμένη ή ενός έργου', () => {
    const all = [master('draft'), master('issued'), master('accepted'), master('in_execution'), master('completed'), sampleAgreement({ id: 'sca_single', status: 'accepted' })];
    expect(assignableMasters(all).map((agreement) => agreement.id)).toEqual(['sca_accepted', 'sca_in_execution']);
  });
});
