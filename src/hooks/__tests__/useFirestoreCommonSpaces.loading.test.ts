/**
 * ADR-931 — Το `loading` του `useFirestoreCommonSpaces` ΚΛΕΙΝΕΙ σε κάθε τερματική κατάσταση.
 *
 * Το σύμπτωμα που αναφέρθηκε (2026-11-04): κάρτες «…» για πάντα στο `/spaces/common` και στο
 * hub `/spaces`. ΔΕΝ αναπαράχθηκε στη μέτρηση (2026-11-05, 8 μετρήσεις στην παραγωγή, πλήρης
 * φόρτωση + πλοήγηση client: 0,1–3,7″). Η σουίτα κλειδώνει το συμβόλαιο ώστε μια μελλοντική
 * αλλαγή να ΜΗ μπορεί να το φέρει: όποιος δρόμος κι αν τερματίσει, το `loading` πέφτει.
 *
 *   1. κενό στιγμιότυπο         → `loading:false`, λίστα κενή (η κενή κατάσταση φαίνεται)
 *   2. σφάλμα συνδρομής          → `loading:false` + `error`
 *   3. αποσυνδεδεμένος χρήστης   → `loading:false` χωρίς συνδρομή (η παγίδα του ADR-929 §1)
 *   4. ταυτότητα σε εξέλιξη      → `loading:true` χωρίς συνδρομή (όχι ψευδές «άδειο»)
 */

import { act, renderHook } from '@testing-library/react';
import { useFirestoreCommonSpaces } from '../useFirestoreCommonSpaces';

interface AuthState { user: { uid: string } | null; loading: boolean }
let authState: AuthState = { user: { uid: 'u1' }, loading: false };

jest.mock('@/auth/hooks/useAuth', () => ({ useAuth: () => authState }));

const subscribeMock = jest.fn();
let onData: ((result: { documents: unknown[] }) => void) | undefined;
let onError: ((error: Error) => void) | undefined;

jest.mock('@/services/firestore', () => ({
  firestoreQueryService: {
    subscribe: (
      _key: string,
      data: (result: { documents: unknown[] }) => void,
      error: (err: Error) => void,
    ) => {
      subscribeMock();
      onData = data;
      onError = error;
      return () => undefined;
    },
  },
}));

beforeEach(() => {
  authState = { user: { uid: 'u1' }, loading: false };
  subscribeMock.mockClear();
  onData = undefined;
  onError = undefined;
});

describe('useFirestoreCommonSpaces — το loading κλείνει πάντα', () => {
  it('κενό στιγμιότυπο → loading:false και κενή λίστα', () => {
    const { result } = renderHook(() => useFirestoreCommonSpaces());
    expect(result.current.loading).toBe(true);

    act(() => onData?.({ documents: [] }));

    expect(result.current.loading).toBe(false);
    expect(result.current.commonSpaces).toHaveLength(0);
    expect(result.current.error).toBeNull();
  });

  it('σφάλμα συνδρομής → loading:false με error', () => {
    const { result } = renderHook(() => useFirestoreCommonSpaces());

    act(() => onError?.(new Error('permission-denied')));

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe('permission-denied');
  });

  it('αποσυνδεδεμένος → loading:false χωρίς συνδρομή', () => {
    authState = { user: null, loading: false };
    const { result } = renderHook(() => useFirestoreCommonSpaces());

    expect(subscribeMock).not.toHaveBeenCalled();
    expect(result.current.loading).toBe(false);
  });

  it('ταυτότητα σε εξέλιξη → loading:true χωρίς συνδρομή', () => {
    authState = { user: null, loading: true };
    const { result } = renderHook(() => useFirestoreCommonSpaces());

    expect(subscribeMock).not.toHaveBeenCalled();
    expect(result.current.loading).toBe(true);
  });
});
