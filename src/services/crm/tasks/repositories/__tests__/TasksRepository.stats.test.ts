/**
 * ΑΓΚΥΡΑ ADR-869 §4 — `getStats` δεν ζητά φίλτρο εύρους, και ο μετρητής των ακυρωμένων γεμίζει.
 *
 * Το περιστατικό: το ερώτημα έχτιζε `where('status', '!=', 'cancelled')`. Το `!=` είναι για
 * το Firestore φίλτρο **εύρους** — μαζί με το `companyId` που εγχέει ο μισθωτής και το
 * προαιρετικό `assignedTo` απαιτούσε τον composite δείκτη `(assignedTo, companyId, status)`,
 * που **δεν υπάρχει** (ζωντανή δοκιμή: `FAILED_PRECONDITION`). Η μέθοδος δεν είχε καλούντα,
 * άρα η παγίδα ήταν οπλισμένη αλλά απυροδότητη. Το **ίδιο** φίλτρο κρατούσε τον μετρητή
 * `stats.cancelled` μονίμως στο 0, γιατί τα ακυρωμένα δεν έφταναν ποτέ στον βρόχο.
 */

import { TasksRepository } from '../TasksRepository';

interface FakeConstraint {
  readonly kind: 'where' | 'orderBy';
  readonly field: string;
  readonly op?: string;
  readonly value?: unknown;
}

jest.mock('firebase/firestore', () => ({
  where: (field: string, op: string, value: unknown): FakeConstraint => ({ kind: 'where', field, op, value }),
  orderBy: (field: string): FakeConstraint => ({ kind: 'orderBy', field }),
  doc: jest.fn(),
  updateDoc: jest.fn(),
  deleteDoc: jest.fn(),
  setDoc: jest.fn(),
  serverTimestamp: jest.fn(),
  Timestamp: { fromDate: jest.fn(), now: jest.fn() },
}));

jest.mock('@/lib/firebase', () => ({ db: {} }));

const getAll = jest.fn();
jest.mock('@/services/firestore', () => ({
  firestoreQueryService: {
    getAll: (...args: unknown[]) => getAll(...args),
    getById: jest.fn(),
    requireAuthContext: jest.fn(),
  },
}));

function constraintsOfLastCall(): FakeConstraint[] {
  const last = getAll.mock.calls.at(-1);
  return ((last?.[1] as { constraints?: FakeConstraint[] } | undefined)?.constraints ?? []);
}

const TASKS = [
  { id: 't1', status: 'pending', priority: 'high', type: 'call' },
  { id: 't2', status: 'in_progress', priority: 'low', type: 'call' },
  { id: 't3', status: 'completed', priority: 'medium', type: 'visit' },
  { id: 't4', status: 'cancelled', priority: 'urgent', type: 'visit' },
  { id: 't5', status: 'cancelled', priority: 'low', type: 'call' },
];

describe('TasksRepository.getStats — ADR-869 §4', () => {
  beforeEach(() => {
    getAll.mockReset();
    getAll.mockResolvedValue({ documents: TASKS, isEmpty: false });
  });

  it('το ερώτημα είναι ΜΟΝΟ ισότητες — καμία ανισότητα, άρα κανένας composite δείκτης', async () => {
    await new TasksRepository().getStats('user-1');

    const operators = constraintsOfLastCall().filter((c) => c.kind === 'where').map((c) => c.op);
    expect(operators).not.toContain('!=');
    expect(operators.every((op) => op === '==')).toBe(true);
  });

  it('ο μετρητής των ακυρωμένων γεμίζει — ήταν μονίμως 0', async () => {
    const stats = await new TasksRepository().getStats();

    expect(stats.cancelled).toBe(2);
  });

  it('το `total` εξακολουθεί να ΜΗΝ μετρά ακυρωμένα — η σημασία δεν άλλαξε', async () => {
    const stats = await new TasksRepository().getStats();

    expect(stats.total).toBe(3);
    expect(stats.pending).toBe(1);
    expect(stats.inProgress).toBe(1);
    expect(stats.completed).toBe(1);
  });

  it('τα ακυρωμένα δεν μολύνουν ούτε τις κατανομές προτεραιότητας/τύπου', async () => {
    const stats = await new TasksRepository().getStats();

    // t4 (urgent) και t5 (low) είναι ακυρωμένα ⇒ εκτός.
    expect(stats.byPriority).toEqual({ low: 1, medium: 1, high: 1, urgent: 0 });
    expect(stats.byType).toEqual({ call: 2, visit: 1 });
  });

  it('με χρήστη φιλτράρει σε ΕΝΑ `assignedTo ==`· χωρίς χρήστη δεν φιλτράρει καθόλου', async () => {
    const repo = new TasksRepository();

    await repo.getStats('user-1');
    expect(constraintsOfLastCall()).toEqual([
      { kind: 'where', field: 'assignedTo', op: '==', value: 'user-1' },
    ]);

    await repo.getStats();
    expect(constraintsOfLastCall()).toEqual([]);
  });
});
