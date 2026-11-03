/**
 * ADR-927 §9 — ο καθολικός drawer αποδίδεται στο ΡΙΖΙΚΟ layout, πάνω από τον πάροχο toasts.
 * Το hook ενεργειών εκεί ΔΕΝ πρέπει να πετά: το `useNotifications` έριξε το prerender του `/_not-found`
 * και μαζί ολόκληρο το production build (384bb147, 2026-11-03).
 */
import { renderHook } from '@testing-library/react';

jest.mock('@/lib/workspace/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('@/i18n', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));
jest.mock('@/services/notificationService', () => ({
  dismissNotification: jest.fn(() => Promise.resolve()),
  markNotificationsAsRead: jest.fn(() => Promise.resolve()),
  setNotificationDeliveryState: jest.fn(() => Promise.resolve()),
}));

import { useNotificationActions } from '../useNotificationActions';

describe('useNotificationActions έξω από NotificationProvider', () => {
  it('δεν πετά — ο drawer του ριζικού layout αποδίδεται χωρίς πάροχο', () => {
    const { result } = renderHook(() => useNotificationActions());
    expect(typeof result.current.dismiss).toBe('function');
  });

  it('η απόρριψη άγνωστης ειδοποίησης ολοκληρώνεται χωρίς toast και χωρίς σφάλμα', async () => {
    const { result } = renderHook(() => useNotificationActions());
    await expect(result.current.dismiss('missing')).resolves.toBeUndefined();
  });
});
