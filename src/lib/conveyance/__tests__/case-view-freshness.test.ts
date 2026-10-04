/**
 * ADR-901 §14.8 — άγκυρα Α37: μια αργή ανάγνωση **δεν** γυρίζει ποτέ πίσω την οθόνη (ούτε τη βάση του CAS).
 */

import type { ConveyanceCaseView, EngagedCaseView } from '@/types/conveyance-case';
import { isOlderEngagedView, isOlderHostView } from '../case-view-freshness';

function hostView(id: string, version: number, revision: number): ConveyanceCaseView {
  return { conveyanceCase: { id, version }, freshness: { revision, freshUntil: '2026-10-05T21:00:00.000Z' } } as unknown as ConveyanceCaseView;
}

function engagedView(engagementId: string, revision: number): EngagedCaseView {
  return { engagementId, freshness: { revision, freshUntil: '2026-10-05T21:00:00.000Z' } } as unknown as EngagedCaseView;
}

describe('isOlderHostView', () => {
  it.each([
    ['μικρότερη αναθεώρηση', hostView('c1', 3, 4), hostView('c1', 3, 5), true],
    ['μικρότερη έκδοση CAS (η βάση του επόμενου PATCH)', hostView('c1', 2, 6), hostView('c1', 3, 5), true],
    ['ίδια ή νεότερη', hostView('c1', 3, 5), hostView('c1', 3, 5), false],
    ['νεότερη', hostView('c1', 4, 6), hostView('c1', 3, 5), false],
    ['ΑΛΛΗ υπόθεση (νέα υπόθεση του ακινήτου) ⇒ πάντα δεκτή', hostView('c2', 0, 1), hostView('c1', 9, 9), false],
  ])('%s', (_label, next, current, older) => {
    expect(isOlderHostView(next, current)).toBe(older);
  });

  it('καμία τρέχουσα / καμία νέα ⇒ δεκτή', () => {
    expect(isOlderHostView(hostView('c1', 0, 0), null)).toBe(false);
    expect(isOlderHostView(null, hostView('c1', 0, 0))).toBe(false);
  });
});

describe('isOlderEngagedView', () => {
  it('μικρότερη αναθεώρηση της ΙΔΙΑΣ συμμετοχής ⇒ παλιότερη · άλλη συμμετοχή ⇒ δεκτή', () => {
    expect(isOlderEngagedView(engagedView('e1', 2), engagedView('e1', 3))).toBe(true);
    expect(isOlderEngagedView(engagedView('e1', 3), engagedView('e1', 3))).toBe(false);
    expect(isOlderEngagedView(engagedView('e2', 0), engagedView('e1', 3))).toBe(false);
    expect(isOlderEngagedView(engagedView('e1', 0), null)).toBe(false);
  });
});
