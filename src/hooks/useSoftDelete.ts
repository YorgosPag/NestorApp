/**
 * useSoftDelete — Hook with undo toast pattern (Google-level)
 *
 * Calls the existing DELETE endpoint of the entity (which now does soft-delete),
 * and provides a 5-second undo window.
 *
 * @module hooks/useSoftDelete
 * @enterprise ADR-281 — SSOT Soft-Delete System
 */

'use client';

import { useCallback, useState } from 'react';
import { useNotifications } from '@/providers/NotificationProvider';
import { useTranslation } from 'react-i18next';
import { TrashService } from '@/services/trash.service';
import type { SoftDeletableEntityType } from '@/types/soft-deletable';

interface UseSoftDeleteOptions {
  entityType: SoftDeletableEntityType;
  /** Delete function — calls the entity-specific DELETE endpoint */
  deleteFn: (id: string) => Promise<void>;
  /** Callback after successful delete or undo */
  onSuccess?: () => void;
}

interface UseSoftDeleteReturn {
  /** Soft-delete single entity + show undo toast */
  softDelete: (id: string) => Promise<void>;
  /** Soft-delete multiple entities + show undo toast */
  softDeleteMultiple: (ids: string[]) => Promise<void>;
  /** True while a delete/restore is in progress */
  loading: boolean;
}

export function useSoftDelete({ entityType, deleteFn, onSuccess }: UseSoftDeleteOptions): UseSoftDeleteReturn {
  const [loading, setLoading] = useState(false);
  const { notify } = useNotifications();
  const { t } = useTranslation('trash');

  const softDelete = useCallback(async (id: string) => {
    setLoading(true);
    try {
      await deleteFn(id);
      onSuccess?.();

      // Undo toast — 5 second window
      notify(t('deleteSuccess'), {
        type: 'success',
        duration: 5000,
        actions: [{
          label: t('undo'),
          onClick: async () => {
            try {
              await TrashService.restore(entityType, id);
              notify(t('undoSuccess'), { type: 'info', duration: 2000 });
              onSuccess?.();
            } catch {
              notify(t('undoFailed'), { type: 'error' });
            }
          },
        }],
      });
    } finally {
      setLoading(false);
    }
  }, [deleteFn, entityType, notify, onSuccess, t]);

  const softDeleteMultiple = useCallback(async (ids: string[]) => {
    setLoading(true);
    try {
      await Promise.all(ids.map(id => deleteFn(id)));
      onSuccess?.();

      notify(t('deleteSuccessMultiple', { count: ids.length }), {
        type: 'success',
        duration: 5000,
        actions: [{
          label: t('undo'),
          onClick: async () => {
            try {
              await TrashService.bulkRestore(entityType, ids);
              notify(t('undoSuccess'), { type: 'info', duration: 2000 });
              onSuccess?.();
            } catch {
              notify(t('undoFailed'), { type: 'error' });
            }
          },
        }],
      });
    } finally {
      setLoading(false);
    }
  }, [deleteFn, entityType, notify, onSuccess, t]);

  return { softDelete, softDeleteMultiple, loading };
}
