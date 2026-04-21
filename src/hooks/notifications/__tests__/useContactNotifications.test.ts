/**
 * ============================================================================
 * useContactNotifications — Unit tests (SSoT safety net)
 * ============================================================================
 *
 * Pins the contract between ContactNotifications methods and the i18n keys in
 * NOTIFICATION_KEYS.contacts. If a key is renamed or a method rewired to a
 * different leaf, this suite fails — blocking silent regressions during the
 * 110-file Boy Scout migration (Phase 3).
 *
 * Strategy:
 *   - Mock @/providers/NotificationProvider so useNotifications() returns Jest
 *     spies for success/error/info/warning.
 *   - Call each method on the hook result, assert the spy received the exact
 *     key string (sourced directly from NOTIFICATION_KEYS — not hardcoded).
 *
 * @see src/config/notification-keys.ts — SSoT registry
 * @see src/hooks/notifications/useContactNotifications.ts — hook under test
 */
import { renderHook } from '@testing-library/react';
import { NOTIFICATION_KEYS } from '@/config/notification-keys';
import { useContactNotifications } from '../useContactNotifications';

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

describe('useContactNotifications', () => {
  it('createSuccess → success(NOTIFICATION_KEYS.contacts.form.createSuccess)', () => {
    const { result } = renderHook(() => useContactNotifications());
    result.current.createSuccess();
    expect(success).toHaveBeenCalledTimes(1);
    expect(success).toHaveBeenCalledWith(NOTIFICATION_KEYS.contacts.form.createSuccess);
  });

  it('updateSuccess → success(NOTIFICATION_KEYS.contacts.form.updateSuccess)', () => {
    const { result } = renderHook(() => useContactNotifications());
    result.current.updateSuccess();
    expect(success).toHaveBeenCalledWith(NOTIFICATION_KEYS.contacts.form.updateSuccess);
  });

  it('updateError → error(NOTIFICATION_KEYS.contacts.form.updateError)', () => {
    const { result } = renderHook(() => useContactNotifications());
    result.current.updateError();
    expect(error).toHaveBeenCalledWith(NOTIFICATION_KEYS.contacts.form.updateError);
  });

  it('uploadsFailed → error(NOTIFICATION_KEYS.contacts.form.failedUploads)', () => {
    const { result } = renderHook(() => useContactNotifications());
    result.current.uploadsFailed();
    expect(error).toHaveBeenCalledWith(NOTIFICATION_KEYS.contacts.form.failedUploads);
  });

  it('uploadsPending → info(NOTIFICATION_KEYS.contacts.form.pendingUploads, {duration:3000})', () => {
    const { result } = renderHook(() => useContactNotifications());
    result.current.uploadsPending();
    expect(info).toHaveBeenCalledTimes(1);
    expect(info).toHaveBeenCalledWith(
      NOTIFICATION_KEYS.contacts.form.pendingUploads,
      { duration: 3000 },
    );
  });

  it('validationUnknownType → error(NOTIFICATION_KEYS.contacts.validation.unknownType)', () => {
    const { result } = renderHook(() => useContactNotifications());
    result.current.validationUnknownType();
    expect(error).toHaveBeenCalledWith(NOTIFICATION_KEYS.contacts.validation.unknownType);
  });

  it('validationReviewFields → error(NOTIFICATION_KEYS.contacts.validation.reviewHighlightedFields)', () => {
    const { result } = renderHook(() => useContactNotifications());
    result.current.validationReviewFields();
    expect(error).toHaveBeenCalledWith(
      NOTIFICATION_KEYS.contacts.validation.reviewHighlightedFields,
    );
  });

  it('each method fires exactly one notification (no double-dispatch)', () => {
    const { result } = renderHook(() => useContactNotifications());
    result.current.createSuccess();
    result.current.updateSuccess();
    result.current.updateError();
    expect(success).toHaveBeenCalledTimes(2);
    expect(error).toHaveBeenCalledTimes(1);
    expect(info).toHaveBeenCalledTimes(0);
    expect(warning).toHaveBeenCalledTimes(0);
  });
});
