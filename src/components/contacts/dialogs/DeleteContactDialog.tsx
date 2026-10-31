/**
 * 🏢 DELETE CONTACT DIALOG — SOFT DELETE + UNDO TOAST
 *
 * ENTERPRISE-CLASS: Soft-deletes contacts (moves to trash) with undo capability.
 * No dependency pre-check needed — data stays intact in Firestore.
 *
 * @created 2025-12-27 - Smart Factory Conversion
 * @updated 2026-04-01 - Soft-delete with undo toast (ADR-191 lifecycle)
 * @version 4.0.0 - Soft Delete + Undo
 */

'use client';

import { createSmartDialog } from '@/core/modals/SmartDialogEngine';
import {
  deleteContactWithPolicy,
  deleteMultipleContactsWithPolicy,
  restoreMultipleDeletedContactsWithPolicy,
} from '@/services/contact-mutation-gateway';
import { useNotifications } from '@/providers/NotificationProvider';
import { ENTITY_TYPES } from '@/config/domain-constants';
import { useTranslation } from 'react-i18next';
import type { Contact } from '@/types/contacts';

interface DeleteContactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact: Contact | null;
  selectedContactIds?: string[];
  onContactsDeleted: () => void;
}

/**
 * 🗑️ Soft-delete dialog with undo toast.
 *
 * Flow: Confirm → soft-delete (status='deleted') → toast with "Αναίρεση" (5sec)
 * No dependency pre-check — soft-delete preserves all data for recovery.
 */
export function DeleteContactDialog(props: DeleteContactDialogProps) {
  const { notify } = useNotifications();
  const { t } = useTranslation('contacts');

  return createSmartDialog({
    entityType: ENTITY_TYPES.CONTACT,
    operationType: 'delete',
    copyVariant: 'contactSoftDelete',
    props: {
      ...props,
      onSubmit: async () => {
        const ids = props.selectedContactIds?.length
          ? props.selectedContactIds
          : props.contact?.id ? [props.contact.id] : [];

        if (ids.length === 0) return;

        if (ids.length === 1) {
          await deleteContactWithPolicy({ id: ids[0] });
        } else {
          await deleteMultipleContactsWithPolicy({ ids });
        }

        props.onContactsDeleted?.();

        // 🗑️ Undo toast — 5 second window to restore
        const count = ids.length;
        notify(
          count === 1
            ? t('trash.deleteSuccess')
            : t('trash.deleteSuccessMultiple', { count }),
          {
            type: 'success',
            duration: 5000,
            actions: [{
              label: t('trash.undo'),
              onClick: async () => {
                try {
                  await restoreMultipleDeletedContactsWithPolicy({ ids });
                  notify(t('trash.undoSuccess'), { type: 'info', duration: 2000 });
                  props.onContactsDeleted?.(); // refresh list
                } catch {
                  notify(t('trash.undoFailed'), { type: 'error' });
                }
              },
            }],
          }
        );
      }
    }
  });
}
