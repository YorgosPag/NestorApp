'use client';

/**
 * ============================================================================
 * useParkingNotifications — Domain Notification Dispatcher (SSoT)
 * ============================================================================
 *
 * Owns every notification fired for parking-related actions.
 *
 * **Usage**:
 * ```ts
 * const parkingNotifications = useParkingNotifications();
 * parkingNotifications.created();              // parking create success
 * parkingNotifications.createError();          // parking create error
 * ```
 *
 * @module hooks/notifications/useParkingNotifications
 * @see src/config/notification-keys.ts — SSoT for keys
 */

import { useMemo } from 'react';
import { useNotifications } from '@/providers/NotificationProvider';
import { NOTIFICATION_KEYS } from '@/config/notification-keys';

export interface ParkingNotifications {
  readonly created: () => void;
  readonly updated: () => void;
  readonly createError: (serverMessage?: string) => void;
  readonly updateError: (serverMessage?: string) => void;
}

export function useParkingNotifications(): ParkingNotifications {
  const { success, error } = useNotifications();

  return useMemo<ParkingNotifications>(() => {
    const fireError = (key: string, serverMessage?: string) => {
      if (serverMessage && serverMessage.trim().length > 0) {
        error(serverMessage);
        return;
      }
      error(key);
    };

    return {
      created: () => success(NOTIFICATION_KEYS.parking.created),
      updated: () => success(NOTIFICATION_KEYS.parking.updated),
      createError: (serverMessage) => fireError(NOTIFICATION_KEYS.parking.createError, serverMessage),
      updateError: (serverMessage) => fireError(NOTIFICATION_KEYS.parking.updateError, serverMessage),
    };
  }, [success, error]);
}
