/**
 * Άγκυρα — **ΟΙ ΕΓΓΡΑΦΕΣ ΤΗΣ ΟΘΟΝΗΣ ΡΥΘΜΙΣΕΩΝ** (ADR-849 Α3)
 *
 * (Ε) *μαθαίνει ο άνθρωπος ότι μια αλλαγή ΔΕΝ αποθηκεύτηκε;* — πριν την Α3 η αποτυχία πήγαινε μόνο
 * στο log· (Π) *μπλοκάρει μια εγγραφή την επόμενη;* — πριν την Α3 ένα κοινό `isSaving`
 * απενεργοποιούσε κάθε διακόπτη, και το δεύτερο γρήγορο κλικ χανόταν.
 */

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const mockNotifyError = jest.fn();
jest.mock('@/providers/NotificationProvider', () => ({
  useNotifications: () => ({ error: mockNotifyError }),
}));

/** Κάθε μέθοδος του service καταλήγει εδώ ως `(όνομα, ...ορίσματα)`. */
const mockWrite = jest.fn((..._args: unknown[]) => Promise.resolve());
jest.mock('@/services/user-notification-settings', () => ({
  userNotificationSettingsService: new Proxy(
    {},
    { get: (_target, method) => (...args: unknown[]) => mockWrite(String(method), ...args) },
  ),
}));

import { act, renderHook, waitFor } from '@testing-library/react';

import { useNotificationSettingsWrites } from '@/components/account/useNotificationSettingsWrites';

const MATCH = { category: 'properties', settingKey: 'demandListingMatch' } as const;
const LEAD = { category: 'crm', settingKey: 'newLead' } as const;

function deferred() {
  let resolve: () => void = () => undefined;
  let reject: (error: unknown) => void = () => undefined;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  mockWrite.mockClear();
  mockNotifyError.mockClear();
});

describe('Ε — η αποτυχία φαίνεται', () => {
  it('Ε1 🔴 — απορριφθείσα εγγραφή ⇒ ορατό σφάλμα, και η κεφαλίδα ΔΕΝ λέει «αποθηκεύτηκαν»', async () => {
    const write = deferred();
    mockWrite.mockReturnValueOnce(write.promise);
    const { result } = renderHook(() => useNotificationSettingsWrites('u1'));

    act(() => result.current.setTypeEmail(MATCH, 'off'));
    expect(result.current.saveState).toBe('saving');

    await act(async () => write.reject(new Error('permission-denied')));
    await waitFor(() => expect(result.current.saveState).toBe('idle'));
    expect(mockNotifyError).toHaveBeenCalledWith('common-account:account.notificationSettings.writeFailed');
  });

  it('Ε2 — επιτυχία ⇒ «αποθηκεύτηκαν», κανένα σφάλμα', async () => {
    const { result } = renderHook(() => useNotificationSettingsWrites('u1'));
    act(() => result.current.setEmailFrequency('daily'));
    await waitFor(() => expect(result.current.saveState).toBe('saved'));
    expect(mockWrite).toHaveBeenCalledWith('setEmailFrequency', 'u1', 'daily');
    expect(mockNotifyError).not.toHaveBeenCalled();
  });
});

describe('Π — καμία εγγραφή δεν μπλοκάρει την επόμενη', () => {
  it('Π1 🔑 — δύο γρήγορα κλικ ⇒ ΔΥΟ εγγραφές αμέσως· «αποθηκεύτηκαν» μόνο όταν φτάσουν ΚΑΙ οι δύο', async () => {
    const first = deferred();
    const second = deferred();
    mockWrite.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const { result } = renderHook(() => useNotificationSettingsWrites('u1'));

    act(() => {
      result.current.setTypeEnabled(MATCH, false);
      result.current.setTypeEmail(LEAD, 'off');
    });
    expect(mockWrite).toHaveBeenNthCalledWith(1, 'toggleCategorySetting', 'u1', {
      category: 'properties',
      setting: 'demandListingMatch',
      enabled: false,
    });
    expect(mockWrite).toHaveBeenNthCalledWith(2, 'setEmailTypeMode', 'u1', LEAD, 'off');

    await act(async () => first.resolve());
    expect(result.current.saveState).toBe('saving');
    await act(async () => second.resolve());
    await waitFor(() => expect(result.current.saveState).toBe('saved'));
  });
});
