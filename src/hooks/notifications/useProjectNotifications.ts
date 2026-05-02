'use client';

/**
 * ============================================================================
 * useProjectNotifications — Domain Notification Dispatcher (SSoT)
 * ============================================================================
 *
 * Owns every notification fired for project-related actions.
 *
 * **Why**: Callers should express INTENT (`created()`, `addressAdded()`), not
 * knowledge of i18n keys. Keys change in ONE place when copy evolves.
 *
 * **Usage**:
 * ```ts
 * const projectNotifications = useProjectNotifications();
 * projectNotifications.created();              // project create success
 * projectNotifications.address.added();        // address add success
 * projectNotifications.address.updateError();  // address update error
 * ```
 *
 * **Contract**:
 * - All project notifications MUST go through this hook
 * - Never import `useNotifications` directly in project code
 * - Never hardcode Greek/English strings — always use a key from `notification-keys.ts`
 *
 * @module hooks/notifications/useProjectNotifications
 * @see src/config/notification-keys.ts — SSoT for keys
 */

import { useMemo } from 'react';
import { useNotifications } from '@/providers/NotificationProvider';
import { NOTIFICATION_KEYS } from '@/config/notification-keys';

export interface ProjectAddressNotifications {
  readonly added: () => void;
  readonly updated: () => void;
  readonly deleted: () => void;
  readonly cleared: () => void;
  readonly primaryUpdated: () => void;
  readonly saveError: (serverMessage?: string) => void;
  readonly updateError: (serverMessage?: string) => void;
  readonly deleteError: (serverMessage?: string) => void;
  readonly clearError: (serverMessage?: string) => void;
  readonly soleAddressMustBePrimary: () => void;
  readonly cityRequired: () => void;
}

export interface ProjectNotifications {
  readonly created: () => void;
  readonly updated: () => void;
  readonly deleted: () => void;
  readonly movedToTrash: () => void;
  readonly archived: () => void;
  readonly exported: () => void;
  readonly loadingError: () => void;
  readonly address: ProjectAddressNotifications;
}

export function useProjectNotifications(): ProjectNotifications {
  const { success, error } = useNotifications();

  return useMemo<ProjectNotifications>(() => {
    const fireError = (key: string, serverMessage?: string) => {
      if (serverMessage && serverMessage.trim().length > 0) {
        error(serverMessage);
        return;
      }
      error(key);
    };

    return {
      created: () => success(NOTIFICATION_KEYS.projects.created),
      updated: () => success(NOTIFICATION_KEYS.projects.updated),
      deleted: () => success(NOTIFICATION_KEYS.projects.deleted),
      movedToTrash: () => success(NOTIFICATION_KEYS.projects.movedToTrash),
      archived: () => success(NOTIFICATION_KEYS.projects.archived),
      exported: () => success(NOTIFICATION_KEYS.projects.exported),
      loadingError: () => error(NOTIFICATION_KEYS.projects.loadingError),
      address: {
        added: () => success(NOTIFICATION_KEYS.projects.address.added),
        updated: () => success(NOTIFICATION_KEYS.projects.address.updated),
        deleted: () => success(NOTIFICATION_KEYS.projects.address.deleted),
        cleared: () => success(NOTIFICATION_KEYS.projects.address.cleared),
        primaryUpdated: () => success(NOTIFICATION_KEYS.projects.address.primaryUpdated),
        saveError: (serverMessage) => fireError(NOTIFICATION_KEYS.projects.address.saveError, serverMessage),
        updateError: (serverMessage) => fireError(NOTIFICATION_KEYS.projects.address.updateError, serverMessage),
        deleteError: (serverMessage) => fireError(NOTIFICATION_KEYS.projects.address.deleteError, serverMessage),
        clearError: (serverMessage) => fireError(NOTIFICATION_KEYS.projects.address.clearError, serverMessage),
        soleAddressMustBePrimary: () => error(NOTIFICATION_KEYS.projects.address.soleAddressMustBePrimary),
        cityRequired: () => error(NOTIFICATION_KEYS.projects.address.cityRequired),
      },
    };
  }, [success, error]);
}
