'use client';

/**
 * ============================================================================
 * usePropertyNotifications — Domain Notification Dispatcher (SSoT)
 * ============================================================================
 *
 * Owns every notification fired for property-related actions.
 *
 * **Usage**:
 * ```ts
 * const propertyNotifications = usePropertyNotifications();
 * propertyNotifications.linkedSpaces.parkingLinked();
 * propertyNotifications.linkedSpaces.storageLinked();
 * propertyNotifications.linkedSpaces.spaceRemoved();
 * propertyNotifications.linkedSpaces.updated();
 * ```
 *
 * **Contract**:
 * - All property notifications MUST go through this hook
 * - Never import `useNotifications` directly in property linked-spaces code
 * - Never hardcode Greek/English strings — always use a key from `notification-keys.ts`
 *
 * @module hooks/notifications/usePropertyNotifications
 * @see src/config/notification-keys.ts — SSoT for keys
 */

import { useMemo } from 'react';
import { useNotifications } from '@/providers/NotificationProvider';
import { NOTIFICATION_KEYS } from '@/config/notification-keys';

export interface PropertyLinkedSpacesNotifications {
  readonly parkingLinked: () => void;
  readonly storageLinked: () => void;
  readonly spaceRemoved: () => void;
  readonly updated: () => void;
}

export interface PropertyNotifications {
  readonly linkedSpaces: PropertyLinkedSpacesNotifications;
}

export function usePropertyNotifications(): PropertyNotifications {
  const { success } = useNotifications();

  return useMemo<PropertyNotifications>(() => ({
    linkedSpaces: {
      parkingLinked: () => success(NOTIFICATION_KEYS.properties.linkedSpaces.parkingLinked),
      storageLinked: () => success(NOTIFICATION_KEYS.properties.linkedSpaces.storageLinked),
      spaceRemoved: () => success(NOTIFICATION_KEYS.properties.linkedSpaces.spaceRemoved),
      updated: () => success(NOTIFICATION_KEYS.properties.linkedSpaces.updated),
    },
  }), [success]);
}
