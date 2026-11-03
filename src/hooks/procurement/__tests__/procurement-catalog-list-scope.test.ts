/**
 * ADR-928 Φ3α-2 — το `useProcurementCatalogList` επεκτάθηκε (εμβέλεια + πεδίο ζωντάνιας) αντί για τρίτο αντίγραφο.
 * Ό,τι κρίνεται: (α) οι δύο παλιοί καταναλωτές κρατούν το `isDeleted == false` χωρίς αλλαγή· (β) η εμβέλεια φτάνει στο
 * ερώτημα· (γ) η λίστα του έργου Α δεν φαίνεται ΠΟΤΕ στο έργο Β, ούτε για ένα render (cache ανά κλειδί).
 */

import { act, renderHook } from '@testing-library/react';
import { firestoreQueryService } from '@/services/firestore/firestore-query.service';
import { createStaleCache } from '@/lib/stale-cache';
import { createModuleLogger } from '@/lib/telemetry';
import { useMaterials } from '../useMaterials';
import { useProjectSubcontractAgreements } from '../subcontracts/useProjectSubcontractAgreements';
import { useProcurementCatalogList, type ProcurementCatalogListConfig } from '../useProcurementCatalogList';

jest.mock('firebase/firestore', () => ({
  where: (field: string, op: string, value: unknown) => ({ type: 'where', field, op, value }),
  orderBy: (field: string, direction: string) => ({ type: 'orderBy', field, direction }),
}));
// Σταθερή ταυτότητα, όπως στην εφαρμογή (το `useAuth` κρατά το ίδιο αντικείμενο ανάμεσα στα renders).
const mockAuth = { user: { uid: 'u1' }, loading: false };
jest.mock('@/hooks/useAuth', () => ({ useAuth: () => mockAuth }));
jest.mock('@/hooks/useCompanyId', () => ({ useCompanyId: () => ({ companyId: 'co1' }) }));
jest.mock('@/services/firestore/firestore-query.service', () => ({
  firestoreQueryService: { subscribe: jest.fn(() => () => undefined) },
}));

type Deliver = (result: { documents: unknown[] }) => void;
const subscribe = jest.mocked(firestoreQueryService.subscribe);

const lastCall = () => subscribe.mock.calls[subscribe.mock.calls.length - 1];
const deliver = (documents: unknown[]) => act(() => (lastCall()[1] as Deliver)({ documents }));
const constraintsOf = (call: ReturnType<typeof lastCall>) => (call[3] as { constraints: unknown[] }).constraints;

interface Doc { readonly id: string; readonly isArchived: boolean; readonly rank: number }

const archivedConfig: ProcurementCatalogListConfig<Doc> = {
  collection: 'SUBCONTRACT_CLAUSES',
  cache: createStaleCache<Doc[]>('test-archived'),
  compare: (a, b) => a.rank - b.rank,
  logger: createModuleLogger('test'),
  label: 'Test',
  liveness: 'isArchived',
};

beforeEach(() => subscribe.mockClear());

describe('useProcurementCatalogList — πεδίο ζωντάνιας', () => {
  it('παλιός καταναλωτής (υλικά): `isDeleted == false` όπως πριν, χωρίς δήλωση', () => {
    renderHook(() => useMaterials());
    expect(lastCall()[0]).toBe('MATERIALS');
    expect(constraintsOf(lastCall())).toEqual([{ type: 'where', field: 'isDeleted', op: '==', value: false }]);
  });

  it('δηλωμένο πεδίο: ερώτημα ΚΑΙ φίλτρο στον πελάτη πάνω στο ίδιο πεδίο, με ταξινόμηση', () => {
    const { result } = renderHook(() => useProcurementCatalogList(archivedConfig));
    expect(constraintsOf(lastCall())).toEqual([{ type: 'where', field: 'isArchived', op: '==', value: false }]);
    deliver([{ id: 'b', isArchived: false, rank: 2 }, { id: 'x', isArchived: true, rank: 0 }, { id: 'a', isArchived: false, rank: 1 }]);
    expect(result.current.items.map((doc) => doc.id)).toEqual(['a', 'b']);
  });
});

describe('useProjectSubcontractAgreements — εμβέλεια έργου', () => {
  it('ερώτημα = `projectIds array-contains` + `updatedAt ↓` (ο δείκτης της γραμμής Firebase), χωρίς φίλτρο διαγραφής', () => {
    renderHook(() => useProjectSubcontractAgreements('proj_A'));
    expect(lastCall()[0]).toBe('SUBCONTRACT_AGREEMENTS');
    expect(constraintsOf(lastCall())).toEqual([
      { type: 'where', field: 'projectIds', op: 'array-contains', value: 'proj_A' },
      { type: 'orderBy', field: 'updatedAt', direction: 'desc' },
    ]);
  });

  it('αλλαγή έργου: η λίστα του Α ΔΕΝ φαίνεται στο Β· επιστροφή στο Α ⇒ από την cache του Α, χωρίς αναμονή', () => {
    const { result, rerender } = renderHook(({ projectId }) => useProjectSubcontractAgreements(projectId), {
      initialProps: { projectId: 'proj_A' },
    });
    deliver([{ id: 'sca_A', updatedAt: '2026-11-01T00:00:00.000Z' }]);
    expect(result.current.items.map((doc) => doc.id)).toEqual(['sca_A']);

    rerender({ projectId: 'proj_B' });
    expect(result.current.items).toEqual([]);
    expect(result.current.loading).toBe(true);
    expect(constraintsOf(lastCall())[0]).toEqual({ type: 'where', field: 'projectIds', op: 'array-contains', value: 'proj_B' });

    rerender({ projectId: 'proj_A' });
    expect(result.current.items.map((doc) => doc.id)).toEqual(['sca_A']);
    expect(result.current.loading).toBe(false);
  });
});
