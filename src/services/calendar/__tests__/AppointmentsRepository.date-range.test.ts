/**
 * ΑΓΚΥΡΑ ADR-869 §3 + §12 — το ημερολόγιο ρωτά ΕΥΡΟΣ, δεν σαρώνει τη συλλογή.
 *
 * **Η διαδρομή του**: η μέθοδος έτρεχε τρία ερωτήματα — δύο εύρους παράλληλα, εκ των
 * οποίων το ένα (`where('date','>=')`) πετούσε **πάντα** `FAILED_PRECONDITION`, οπότε ο
 * έλεγχος «και τα δύο πέτυχαν» ήταν πάντα ψευδής και η πραγματική συμπεριφορά ήταν
 * **πλήρης σάρωση** με φίλτρο στον πελάτη.
 *
 * Τώρα η ερώτηση **είναι πεδίο**: το `appointment.effectiveDate` γράφεται από τον γραφέα
 * και έχει δείκτη `(companyId, appointment.effectiveDate)`. Ένα ερώτημα, ένα εύρος.
 *
 * 🔑 Ο τελευταίος έλεγχος είναι ο σημαντικός: το repository **δεν φιλτράρει πια τίποτα**.
 * Αν κάποιος ξαναβάλει φίλτρο στον πελάτη, σημαίνει ότι ξανάγινε σάρωση.
 */

import { AppointmentsRepository } from '../AppointmentsRepository';

interface FakeConstraint {
  readonly kind: 'where' | 'orderBy';
  readonly field: string;
  readonly op?: string;
  readonly value?: unknown;
}

jest.mock('firebase/firestore', () => ({
  where: (field: string, op: string, value: unknown): FakeConstraint => ({ kind: 'where', field, op, value }),
  orderBy: (field: string): FakeConstraint => ({ kind: 'orderBy', field }),
}));

const getAll = jest.fn();
jest.mock('@/services/firestore', () => ({
  firestoreQueryService: {
    getAll: (...args: unknown[]) => getAll(...args),
    getById: jest.fn(),
  },
}));

/** Τα constraints κάθε κλήσης `getAll`, ισοπεδωμένα. */
function constraintsOfEveryCall(): FakeConstraint[] {
  return getAll.mock.calls.flatMap(
    (call) => ((call[1] as { constraints?: FakeConstraint[] } | undefined)?.constraints ?? []),
  );
}

const START = new Date('2026-03-01T00:00:00Z');
const END = new Date('2026-03-31T00:00:00Z');

describe('AppointmentsRepository.getByDateRange — ADR-869 §3 + §12', () => {
  beforeEach(() => {
    getAll.mockReset();
    getAll.mockResolvedValue({ documents: [], isEmpty: true });
  });

  it('ρωτά ΕΥΡΟΣ στο κανονικό πεδίο — το μόνο που έχει δείκτη', async () => {
    await new AppointmentsRepository().getByDateRange(START, END);

    expect(constraintsOfEveryCall()).toEqual([
      { kind: 'where', field: 'appointment.effectiveDate', op: '>=', value: '2026-03-01' },
      { kind: 'where', field: 'appointment.effectiveDate', op: '<=', value: '2026-03-31' },
    ]);
  });

  it('ΔΕΝ ρωτά ποτέ τα ιστορικά πεδία — εκεί ήταν και το ζωντανό κενό δείκτη', async () => {
    await new AppointmentsRepository().getByDateRange(START, END);

    const historical = constraintsOfEveryCall().filter(
      (c) => c.field === 'date' || c.field === 'appointment.requestedDate' || c.field === 'appointment.confirmedDate',
    );
    expect(historical).toEqual([]);
  });

  it('κάνει ΕΝΑ ταξίδι, όχι τρία', async () => {
    await new AppointmentsRepository().getByDateRange(START, END);

    expect(getAll).toHaveBeenCalledTimes(1);
  });

  it('🔑 ΔΕΝ φιλτράρει στον πελάτη — ό,τι έκρινε ο διακομιστής, αυτό επιστρέφει', async () => {
    // Έγγραφα που ένα φίλτρο πελάτη θα πετούσε (καμία ημερομηνία, ημερομηνία εκτός εύρους).
    getAll.mockResolvedValue({
      documents: [
        { id: 'a1', appointment: { effectiveDate: '2026-03-10' } },
        { id: 'a2', appointment: { effectiveDate: '2026-11-30' } },
        { id: 'a3' },
      ],
      isEmpty: false,
    });

    const found = await new AppointmentsRepository().getByDateRange(START, END);

    expect(found.map((a) => a.id)).toEqual(['a1', 'a2', 'a3']);
  });
});
