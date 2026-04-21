'use client';

/**
 * ============================================================================
 * useFilesNotifications — Domain Notification Dispatcher (SSoT)
 * ============================================================================
 *
 * Owns every notification fired for file-related actions across the files domain.
 *
 * **Why**: Callers express INTENT (`upload.success(3)`, `list.renameError()`),
 * not knowledge of i18n keys or namespace routing. This hook handles translation
 * (including ICU interpolation) and notification dispatch in one place.
 *
 * **Usage**:
 * ```ts
 * const fileNotifications = useFilesNotifications();
 * fileNotifications.upload.success(3);
 * fileNotifications.list.renameError();
 * fileNotifications.batch.unarchiveSuccess(5);
 * ```
 *
 * **Contract**:
 * - All file notifications MUST go through this hook
 * - Never import `useNotifications` directly in files-domain code
 * - Adding a new notification → extend this hook + add key in `notification-keys.ts`
 * - Keys with ICU interpolation are resolved here; callers pass typed params
 *
 * @module hooks/notifications/useFilesNotifications
 * @see src/config/notification-keys.ts — SSoT for keys
 */

import { useMemo } from 'react';
import { useNotifications } from '@/providers/NotificationProvider';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { NOTIFICATION_KEYS } from '@/config/notification-keys';

// ============================================================================
// Interfaces
// ============================================================================

export interface FilesUploadNotifications {
  readonly success: (count: number) => void;
  readonly notAuthenticated: () => void;
  readonly authFailed: () => void;
  readonly partialSuccess: (params: { success: number; fail: number; total: number }) => void;
  readonly allFailed: (count: number) => void;
  readonly generic: () => void;
}

export interface FilesListNotifications {
  readonly renameSuccess: () => void;
  readonly renameError: () => void;
  readonly deleteSuccess: () => void;
  readonly deleteError: () => void;
  readonly unlinkSuccess: () => void;
  readonly unlinkError: () => void;
}

export interface FilesTechnicalNotifications {
  readonly pathUnavailable: () => void;
  readonly pathCopied: () => void;
  readonly copyError: () => void;
}

export interface FilesTrashNotifications {
  readonly restoreSuccess: () => void;
  readonly restoreError: () => void;
}

export interface FilesArchivedNotifications {
  readonly unarchiveSuccess: () => void;
  readonly unarchiveError: () => void;
}

export interface FilesBatchNotifications {
  // archiveSuccess/archivePartialSuccess/archiveNoChanges intentionally absent:
  // owned by showArchiveResultFeedback() per SSoT registry module "archive-feedback"
  readonly archiveError: (serverMessage?: string) => void;
  readonly unarchiveSuccess: (count: number) => void;
  readonly unarchiveError: (serverMessage?: string) => void;
  readonly noAIClassifiableFiles: () => void;
}

export interface FilesNotifications {
  readonly upload: FilesUploadNotifications;
  readonly list: FilesListNotifications;
  readonly technical: FilesTechnicalNotifications;
  readonly trash: FilesTrashNotifications;
  readonly archived: FilesArchivedNotifications;
  readonly batch: FilesBatchNotifications;
}

// ============================================================================
// Hook
// ============================================================================

export function useFilesNotifications(): FilesNotifications {
  const { success, error, warning } = useNotifications();
  const { t } = useTranslation(['files']);

  return useMemo<FilesNotifications>(
    () => ({
      upload: {
        success: (count) =>
          success(t(NOTIFICATION_KEYS.files.upload.success, { count })),
        notAuthenticated: () =>
          error(t(NOTIFICATION_KEYS.files.upload.notAuthenticated)),
        authFailed: () =>
          error(t(NOTIFICATION_KEYS.files.upload.authFailed)),
        partialSuccess: ({ success: s, fail, total }) =>
          warning(t(NOTIFICATION_KEYS.files.upload.partialSuccess, { success: s, fail, total })),
        allFailed: (count) =>
          error(t(NOTIFICATION_KEYS.files.upload.allFailed, { count })),
        generic: () =>
          error(t(NOTIFICATION_KEYS.files.upload.generic)),
      },

      list: {
        renameSuccess: () => success(t(NOTIFICATION_KEYS.files.list.renameSuccess)),
        renameError: () => error(t(NOTIFICATION_KEYS.files.list.renameError)),
        deleteSuccess: () => success(t(NOTIFICATION_KEYS.files.list.deleteSuccess)),
        deleteError: () => error(t(NOTIFICATION_KEYS.files.list.deleteError)),
        unlinkSuccess: () => success(t(NOTIFICATION_KEYS.files.list.unlinkSuccess)),
        unlinkError: () => error(t(NOTIFICATION_KEYS.files.list.unlinkError)),
      },

      technical: {
        pathUnavailable: () => error(t(NOTIFICATION_KEYS.files.technical.pathUnavailable)),
        pathCopied: () => success(t(NOTIFICATION_KEYS.files.technical.pathCopied)),
        copyError: () => error(t(NOTIFICATION_KEYS.files.technical.copyError)),
      },

      trash: {
        restoreSuccess: () => success(t(NOTIFICATION_KEYS.files.trash.restoreSuccess)),
        restoreError: () => error(t(NOTIFICATION_KEYS.files.trash.restoreError)),
      },

      archived: {
        unarchiveSuccess: () => success(t(NOTIFICATION_KEYS.files.archived.unarchiveSuccess)),
        unarchiveError: () => error(t(NOTIFICATION_KEYS.files.archived.unarchiveError)),
      },

      batch: {
        archiveError: (serverMessage) => {
          if (serverMessage && serverMessage.trim().length > 0) {
            error(serverMessage);
            return;
          }
          error(t(NOTIFICATION_KEYS.files.batch.archiveError));
        },
        unarchiveSuccess: (count) =>
          success(t(NOTIFICATION_KEYS.files.batch.unarchiveSuccess, { count })),
        unarchiveError: (serverMessage) => {
          if (serverMessage && serverMessage.trim().length > 0) {
            error(serverMessage);
            return;
          }
          error(t(NOTIFICATION_KEYS.files.batch.unarchiveError));
        },
        noAIClassifiableFiles: () =>
          warning(t(NOTIFICATION_KEYS.files.batch.noAIClassifiableFiles)),
      },
    }),
    [success, error, warning, t],
  );
}
