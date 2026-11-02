/**
 * `toOpportunity` / `toCommunication` — ποσά, διάρκειες και κείμενα φτάνουν στην οθόνη
 * όπως γράφτηκαν· μόνο οι στιγμές γίνονται ISO (ADR-218).
 */

jest.mock('@/lib/firebase', () => ({ db: {} }));
jest.mock('firebase/firestore', () => ({
  doc: jest.fn(),
  setDoc: jest.fn(),
  updateDoc: jest.fn(),
  deleteDoc: jest.fn(),
  orderBy: jest.fn(),
  where: jest.fn(),
  serverTimestamp: jest.fn(),
}));
jest.mock('@/services/firestore', () => ({ firestoreQueryService: {} }));
jest.mock('@/services/enterprise-id.service', () => ({ generateOpportunityId: jest.fn() }));

import { toCommunication } from '../communications-client.service';
import { toOpportunity } from '../opportunities.service';

const instant = '2026-11-03T08:00:00.000Z';

describe('toOpportunity', () => {
  const opportunity = toOpportunity({
    id: 'opp_1',
    title: 'Επίσκεψη στο T-D-2.02',
    estimatedValue: 170000,
    probability: 40,
    createdAt: { toDate: () => new Date(instant) },
  });

  it('κρατά το ποσό και την πιθανότητα ως αριθμούς', () => {
    expect(opportunity.estimatedValue).toBe(170000);
    expect(opportunity.probability).toBe(40);
  });

  it('κρατά τον τίτλο ως κείμενο', () => {
    expect(opportunity.title).toBe('Επίσκεψη στο T-D-2.02');
  });

  it('μετατρέπει τη στιγμή σε ISO', () => {
    expect(opportunity.createdAt).toBe(instant);
  });
});

describe('toCommunication', () => {
  const communication = toCommunication({
    id: 'msg_1',
    duration: 120,
    subject: 'Ραντεβού 12',
    createdAt: new Date(instant),
  });

  it('κρατά τη διάρκεια και το θέμα όπως γράφτηκαν', () => {
    expect(communication.duration).toBe(120);
    expect(communication.subject).toBe('Ραντεβού 12');
  });

  it('μετατρέπει τη στιγμή σε ISO', () => {
    expect(communication.createdAt).toBe(instant);
  });
});
