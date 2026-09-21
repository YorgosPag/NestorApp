/**
 * Άγκυρα — **ένας κύκλος auto-fill, ένας χρονιστής** (`useContactAutoFill`).
 *
 * Τα δύο αντίγραφα που αντικατέστησε άφηναν τον χρονιστή «σβήσε το μήνυμα σε 3″» ζωντανό:
 * μετά το unmount, και ανάμεσα σε δύο επιλογές (το μήνυμα της δεύτερης έσβηνε νωρίς).
 */

import { act, renderHook } from '@testing-library/react';
import { useContactAutoFill } from '../useContactAutoFill';

const getContact = jest.fn();
jest.mock('@/services/contacts.service', () => ({
  ContactsService: { getContact: (id: string) => getContact(id) },
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const SUMMARY = { id: 'c1', name: 'Άννα' } as Parameters<ReturnType<typeof useContactAutoFill>['handleContactAutoFill']>[0];

beforeEach(() => {
  jest.useFakeTimers();
  getContact.mockReset();
});
afterEach(() => jest.useRealTimers());

describe('useContactAutoFill', () => {
  it('επιλογή ⇒ εφαρμόζει την ΠΛΗΡΗ επαφή, δείχνει μήνυμα, και το σβήνει σε 3″', async () => {
    const full = { id: 'c1', type: 'company', companyName: 'ΑΕ' };
    getContact.mockResolvedValue(full);
    const apply = jest.fn();
    const { result } = renderHook(() => useContactAutoFill(apply));

    await act(() => result.current.handleContactAutoFill(SUMMARY));
    expect(apply).toHaveBeenCalledWith(full);
    expect(result.current.selectedContactId).toBe('c1');
    expect(result.current.autoFillMessage).toBe('setup.contactAutoFilled');

    act(() => {
      jest.advanceTimersByTime(3000);
    });
    expect(result.current.autoFillMessage).toBeNull();
  });

  it('η δεύτερη επιλογή ακυρώνει τον χρονιστή της πρώτης', async () => {
    getContact.mockResolvedValue({ id: 'c1' });
    const { result } = renderHook(() => useContactAutoFill(jest.fn()));

    await act(() => result.current.handleContactAutoFill(SUMMARY));
    act(() => {
      jest.advanceTimersByTime(2000);
    });
    await act(() => result.current.handleContactAutoFill(SUMMARY));
    act(() => {
      jest.advanceTimersByTime(1500); // ο πρώτος θα είχε λήξει εδώ
    });
    expect(result.current.autoFillMessage).toBe('setup.contactAutoFilled');
  });

  it('unmount ⇒ ο χρονιστής του μηνύματος ακυρώνεται', async () => {
    getContact.mockResolvedValue({ id: 'c1' });
    const { result, unmount } = renderHook(() => useContactAutoFill(jest.fn()));
    await act(() => result.current.handleContactAutoFill(SUMMARY));
    // ⚠️ Διαφορά, όχι απόλυτο: το περιβάλλον (React/jsdom) κρατά δικούς του χρονιστές.
    const before = jest.getTimerCount();
    unmount();
    expect(jest.getTimerCount()).toBe(before - 1);
  });

  it('η επαφή δεν βρέθηκε / σφάλμα ⇒ μήνυμα σφάλματος, τίποτα δεν εφαρμόζεται', async () => {
    const apply = jest.fn();
    getContact.mockResolvedValueOnce(null).mockRejectedValueOnce(new Error('δίκτυο'));
    const { result } = renderHook(() => useContactAutoFill(apply));

    await act(() => result.current.handleContactAutoFill(SUMMARY));
    expect(result.current.autoFillMessage).toBe('setup.contactAutoFillError');
    await act(() => result.current.handleContactAutoFill(SUMMARY));
    expect(result.current.autoFillMessage).toBe('setup.contactAutoFillError');
    expect(apply).not.toHaveBeenCalled();
  });

  it('καθαρισμός (null) ⇒ άδεια επιλογή, κανένα μήνυμα', async () => {
    const { result } = renderHook(() => useContactAutoFill(jest.fn(), 'c9'));
    expect(result.current.selectedContactId).toBe('c9');
    await act(() => result.current.handleContactAutoFill(null));
    expect(result.current.selectedContactId).toBe('');
    expect(result.current.autoFillMessage).toBeNull();
  });
});
