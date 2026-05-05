'use client';

/**
 * ============================================================================
 * useContactNotifications — Domain Notification Dispatcher (SSoT)
 * ============================================================================
 *
 * Owns every notification fired for contact-related actions.
 *
 * **Why**: Callers should express INTENT (`createSuccess()`), not knowledge of
 * i18n keys. Changing the message or routing one event to multiple channels
 * is then a single-file edit, not a grep-and-replace across 20 files.
 *
 * **Usage**:
 * ```ts
 * const contactNotifications = useContactNotifications();
 * contactNotifications.createSuccess();   // show create-success toast
 * contactNotifications.updateSuccess();   // show update-success toast
 * contactNotifications.validationError(); // show validation-error toast
 * ```
 *
 * **Contract**:
 * - All contact notifications MUST go through this hook
 * - Never import `useNotifications` directly in contact code
 * - Adding a new notification → extend this hook + add key in `notification-keys.ts`
 *
 * @module hooks/notifications/useContactNotifications
 * @see src/config/notification-keys.ts — SSoT for keys
 */

import { useMemo } from 'react';
import { useNotifications } from '@/providers/NotificationProvider';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { NOTIFICATION_KEYS } from '@/config/notification-keys';

export interface ContactNotifications {
  readonly createSuccess: () => void;
  readonly updateSuccess: () => void;
  readonly updateError: () => void;
  readonly uploadsFailed: () => void;
  readonly uploadsPending: () => void;
  readonly validationUnknownType: () => void;
  readonly validationReviewFields: () => void;
  readonly validationReviewFieldsWithHint: (firstErrorKey: string) => void;
}

export function useContactNotifications(): ContactNotifications {
  const { success, error, info } = useNotifications();
  const { t } = useTranslation('contacts-form');

  return useMemo<ContactNotifications>(
    () => ({
      createSuccess: () => success(NOTIFICATION_KEYS.contacts.form.createSuccess),
      updateSuccess: () => success(NOTIFICATION_KEYS.contacts.form.updateSuccess),
      updateError: () => error(NOTIFICATION_KEYS.contacts.form.updateError),
      uploadsFailed: () => error(NOTIFICATION_KEYS.contacts.form.failedUploads),
      uploadsPending: () => info(NOTIFICATION_KEYS.contacts.form.pendingUploads, { duration: 3000 }),
      validationUnknownType: () => error(NOTIFICATION_KEYS.contacts.validation.unknownType),
      validationReviewFields: () => error(NOTIFICATION_KEYS.contacts.validation.reviewHighlightedFields),
      validationReviewFieldsWithHint: (firstErrorKey: string) => {
        const hint = firstErrorKey ? t(firstErrorKey, { defaultValue: '' }) : '';
        error(NOTIFICATION_KEYS.contacts.validation.reviewHighlightedFields, hint ? { content: hint } : undefined);
      },
    }),
    [success, error, info, t],
  );
}
