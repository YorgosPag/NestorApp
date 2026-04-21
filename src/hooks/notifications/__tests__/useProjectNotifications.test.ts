/**
 * ============================================================================
 * useProjectNotifications — Unit tests (SSoT safety net)
 * ============================================================================
 *
 * Pins the contract between ProjectNotifications methods and the i18n keys in
 * NOTIFICATION_KEYS.projects. Includes the nested address.* dispatcher and
 * the serverMessage override branch (custom string overrides the i18n key).
 *
 * @see src/config/notification-keys.ts — SSoT registry
 * @see src/hooks/notifications/useProjectNotifications.ts — hook under test
 */
import { renderHook } from '@testing-library/react';
import { NOTIFICATION_KEYS } from '@/config/notification-keys';
import { useProjectNotifications } from '../useProjectNotifications';

const success = jest.fn();
const error = jest.fn();
const info = jest.fn();
const warning = jest.fn();

jest.mock('@/providers/NotificationProvider', () => ({
  useNotifications: () => ({ success, error, info, warning }),
}));

beforeEach(() => {
  success.mockClear();
  error.mockClear();
  info.mockClear();
  warning.mockClear();
});

describe('useProjectNotifications — top-level project lifecycle', () => {
  it('created → success(NOTIFICATION_KEYS.projects.created)', () => {
    const { result } = renderHook(() => useProjectNotifications());
    result.current.created();
    expect(success).toHaveBeenCalledWith(NOTIFICATION_KEYS.projects.created);
  });

  it('updated → success(NOTIFICATION_KEYS.projects.updated)', () => {
    const { result } = renderHook(() => useProjectNotifications());
    result.current.updated();
    expect(success).toHaveBeenCalledWith(NOTIFICATION_KEYS.projects.updated);
  });

  it('deleted → success(NOTIFICATION_KEYS.projects.deleted)', () => {
    const { result } = renderHook(() => useProjectNotifications());
    result.current.deleted();
    expect(success).toHaveBeenCalledWith(NOTIFICATION_KEYS.projects.deleted);
  });

  it('archived → success(NOTIFICATION_KEYS.projects.archived)', () => {
    const { result } = renderHook(() => useProjectNotifications());
    result.current.archived();
    expect(success).toHaveBeenCalledWith(NOTIFICATION_KEYS.projects.archived);
  });

  it('exported → success(NOTIFICATION_KEYS.projects.exported)', () => {
    const { result } = renderHook(() => useProjectNotifications());
    result.current.exported();
    expect(success).toHaveBeenCalledWith(NOTIFICATION_KEYS.projects.exported);
  });

  it('loadingError → error(NOTIFICATION_KEYS.projects.loadingError)', () => {
    const { result } = renderHook(() => useProjectNotifications());
    result.current.loadingError();
    expect(error).toHaveBeenCalledWith(NOTIFICATION_KEYS.projects.loadingError);
  });
});

describe('useProjectNotifications — address sub-dispatcher', () => {
  it('address.added → success(NOTIFICATION_KEYS.projects.address.added)', () => {
    const { result } = renderHook(() => useProjectNotifications());
    result.current.address.added();
    expect(success).toHaveBeenCalledWith(NOTIFICATION_KEYS.projects.address.added);
  });

  it('address.updated → success(NOTIFICATION_KEYS.projects.address.updated)', () => {
    const { result } = renderHook(() => useProjectNotifications());
    result.current.address.updated();
    expect(success).toHaveBeenCalledWith(NOTIFICATION_KEYS.projects.address.updated);
  });

  it('address.deleted → success(NOTIFICATION_KEYS.projects.address.deleted)', () => {
    const { result } = renderHook(() => useProjectNotifications());
    result.current.address.deleted();
    expect(success).toHaveBeenCalledWith(NOTIFICATION_KEYS.projects.address.deleted);
  });

  it('address.cleared → success(NOTIFICATION_KEYS.projects.address.cleared)', () => {
    const { result } = renderHook(() => useProjectNotifications());
    result.current.address.cleared();
    expect(success).toHaveBeenCalledWith(NOTIFICATION_KEYS.projects.address.cleared);
  });

  it('address.primaryUpdated → success(NOTIFICATION_KEYS.projects.address.primaryUpdated)', () => {
    const { result } = renderHook(() => useProjectNotifications());
    result.current.address.primaryUpdated();
    expect(success).toHaveBeenCalledWith(NOTIFICATION_KEYS.projects.address.primaryUpdated);
  });

  it('address.soleAddressMustBePrimary → error with SSoT key', () => {
    const { result } = renderHook(() => useProjectNotifications());
    result.current.address.soleAddressMustBePrimary();
    expect(error).toHaveBeenCalledWith(
      NOTIFICATION_KEYS.projects.address.soleAddressMustBePrimary,
    );
  });

  it('address.cityRequired → error with SSoT key', () => {
    const { result } = renderHook(() => useProjectNotifications());
    result.current.address.cityRequired();
    expect(error).toHaveBeenCalledWith(NOTIFICATION_KEYS.projects.address.cityRequired);
  });
});

describe('useProjectNotifications — address error branches (serverMessage override)', () => {
  it.each([
    ['saveError', NOTIFICATION_KEYS.projects.address.saveError],
    ['updateError', NOTIFICATION_KEYS.projects.address.updateError],
    ['deleteError', NOTIFICATION_KEYS.projects.address.deleteError],
    ['clearError', NOTIFICATION_KEYS.projects.address.clearError],
  ] as const)(
    '%s without serverMessage → error(SSoT key)',
    (method, expectedKey) => {
      const { result } = renderHook(() => useProjectNotifications());
      (result.current.address[method] as (s?: string) => void)();
      expect(error).toHaveBeenCalledWith(expectedKey);
    },
  );

  it.each([
    ['saveError'],
    ['updateError'],
    ['deleteError'],
    ['clearError'],
  ] as const)(
    '%s with serverMessage → error(serverMessage) overrides SSoT key',
    (method) => {
      const { result } = renderHook(() => useProjectNotifications());
      (result.current.address[method] as (s?: string) => void)('network timeout');
      expect(error).toHaveBeenCalledWith('network timeout');
    },
  );

  it.each([
    ['saveError'],
    ['updateError'],
    ['deleteError'],
    ['clearError'],
  ] as const)(
    '%s with blank serverMessage → falls back to SSoT key (not whitespace)',
    (method) => {
      const { result } = renderHook(() => useProjectNotifications());
      (result.current.address[method] as (s?: string) => void)('   ');
      expect(error).toHaveBeenCalledWith(
        NOTIFICATION_KEYS.projects.address[method],
      );
    },
  );
});

describe('useProjectNotifications — dispatch discipline', () => {
  it('top-level + address methods are independent (no cross-dispatch)', () => {
    const { result } = renderHook(() => useProjectNotifications());
    result.current.created();
    result.current.address.added();
    expect(success).toHaveBeenCalledTimes(2);
    expect(error).toHaveBeenCalledTimes(0);
    expect(info).toHaveBeenCalledTimes(0);
    expect(warning).toHaveBeenCalledTimes(0);
  });
});
