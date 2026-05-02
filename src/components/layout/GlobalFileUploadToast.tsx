'use client';

/**
 * GlobalFileUploadToast — SSoT upload success notification (ADR-191)
 *
 * Subscribes once to FILE_UPDATED (status=ready) and shows a toast for every
 * file that completes uploading, regardless of which hook/service triggered it.
 * Mounted once in ConditionalAppShell — covers all upload paths in the app.
 */

import { useEffect } from 'react';
import { RealtimeService } from '@/services/realtime';
import type { FileUpdatedPayload, FileTrashedPayload } from '@/services/realtime/types';
import { useFilesNotifications } from '@/hooks/notifications/useFilesNotifications';

export function GlobalFileUploadToast() {
  const fileNotifications = useFilesNotifications();

  useEffect(() => {
    const unsubUpload = RealtimeService.subscribe('FILE_UPDATED', (payload: FileUpdatedPayload) => {
      if (payload.updates.status === 'ready' && payload.updates.displayName) {
        fileNotifications.upload.fileReady(payload.updates.displayName);
      }
    });

    const unsubTrash = RealtimeService.subscribe('FILE_TRASHED', (payload: FileTrashedPayload) => {
      if (payload.displayName) {
        fileNotifications.trash.movedToTrash(payload.displayName);
      }
    });

    return () => {
      unsubUpload();
      unsubTrash();
    };
  }, [fileNotifications]);

  return null;
}
