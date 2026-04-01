/**
 * 🗑️ PERMANENT DELETE DIALOG — Hard delete with dependency check
 *
 * Only available from trash view. Uses ADR-226 deletion guard pre-check.
 * Calls permanent-delete API endpoint (runs executeDeletion with cascade).
 *
 * @module components/contacts/dialogs/PermanentDeleteDialog
 * @enterprise ADR-226 Deletion Guard + ADR-191 lifecycle terminal state
 */

'use client';

import { useEffect, useRef } from 'react';
import { createSmartDialog } from '@/core/modals/SmartDialogEngine';
import { ContactsService } from '@/services/contacts.service';
import { useDeletionGuard } from '@/hooks/useDeletionGuard';
import { DeletionBlockedDialog } from '@/components/shared/DeletionBlockedDialog';
import type { Contact } from '@/types/contacts';

interface PermanentDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact: Contact | null;
  selectedContactIds?: string[];
  onContactsDeleted: () => void;
}

/**
 * 🛡️ Permanent delete with ADR-226 dependency pre-check.
 *
 * Flow: Pre-check → (Blocked? Show dialog) : (Confirm → permanent delete)
 */
export function PermanentDeleteDialog(props: PermanentDeleteDialogProps) {
  const { checkBeforeDelete, blocked, resetCheck, checkResult } = useDeletionGuard('contact');
  const checkedRef = useRef(false);

  useEffect(() => {
    if (!props.open) {
      checkedRef.current = false;
      return;
    }

    const contactId = props.contact?.id;
    if (!contactId || props.selectedContactIds?.length) return;
    if (checkedRef.current) return;

    checkedRef.current = true;
    checkBeforeDelete(contactId).then((allowed) => {
      if (!allowed) {
        props.onOpenChange(false);
      }
    });
  }, [props.open, props.contact?.id]);

  return (
    <>
      <DeletionBlockedDialog
        open={blocked}
        onOpenChange={(open) => { if (!open) resetCheck(); }}
        dependencies={checkResult?.dependencies ?? []}
        message={checkResult?.message ?? ''}
        entitySubtype={props.contact?.type}
      />
      {createSmartDialog({
        entityType: 'contact',
        operationType: 'delete',
        props: {
          ...props,
          open: props.open && !blocked,
          onSubmit: async () => {
            const ids = props.selectedContactIds?.length
              ? props.selectedContactIds
              : props.contact?.id ? [props.contact.id] : [];

            if (ids.length === 0) return;

            if (ids.length === 1) {
              await ContactsService.permanentDeleteContact(ids[0]);
            } else {
              await ContactsService.permanentDeleteMultipleContacts(ids);
            }

            props.onContactsDeleted?.();
          }
        }
      })}
    </>
  );
}
