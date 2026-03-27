/**
 * 🏢 DELETE CONTACT DIALOG - SMART FACTORY + DELETION GUARD
 *
 * ENTERPRISE-CLASS: Smart Dialog Engine + ADR-226 Deletion Guard pre-check
 *
 * ✅ CENTRALIZED: Smart Dialog Engine (800 lines)
 * ✅ CENTRALIZED: Contact deletion logic with photo cleanup
 * ✅ 🛡️ ADR-226: Pre-check dependencies before allowing deletion
 *
 * @created 2025-12-27 - Smart Factory Conversion
 * @updated 2026-03-13 - ADR-226 Phase 3: Deletion Guard integration
 * @version 3.0.0 - Smart Factory + Deletion Guard
 */

'use client';

import { useEffect, useRef } from 'react';
import { createSmartDialog } from '@/core/modals/SmartDialogEngine';
import { ContactsService } from '@/services/contacts.service';
import { useDeletionGuard } from '@/hooks/useDeletionGuard';
import type { Contact } from '@/types/contacts';

interface DeleteContactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact: Contact | null;
  selectedContactIds?: string[];
  onContactsDeleted: () => void;
}

/**
 * 🛡️ ADR-226 Phase 3: Deletion Guard + Smart Factory Dialog
 *
 * When opened, first runs a pre-check via deletion-guard API.
 * If blocked → shows DeletionBlockedDialog (from hook).
 * If allowed → renders the SmartDialog for confirmation.
 */
export function DeleteContactDialog(props: DeleteContactDialogProps) {
  const { checkBeforeDelete, BlockedDialog, blocked, resetCheck: _resetCheck } = useDeletionGuard('contact');
  const checkedRef = useRef(false);

  // Run pre-check when dialog opens
  useEffect(() => {
    if (!props.open) {
      checkedRef.current = false;
      return;
    }

    // Only for single-contact delete (bulk delete skips pre-check — server guards apply)
    const contactId = props.contact?.id;
    if (!contactId || props.selectedContactIds?.length) return;
    if (checkedRef.current) return;

    checkedRef.current = true;
    checkBeforeDelete(contactId).then((allowed) => {
      if (!allowed) {
        // Close the smart dialog — BlockedDialog will show instead
        props.onOpenChange(false);
      }
    });
  }, [props.open, props.contact?.id]);

  return (
    <>
      {BlockedDialog}
      {createSmartDialog({
        entityType: 'contact',
        operationType: 'delete',
        props: {
          ...props,
          // Don't show while checking or if blocked
          open: props.open && !blocked,
          // 🔥 Perform actual Firestore deletion, then notify parent
          onSubmit: async () => {
            const ids = props.selectedContactIds?.length
              ? props.selectedContactIds
              : props.contact?.id ? [props.contact.id] : [];

            if (ids.length === 0) return;

            if (ids.length === 1) {
              await ContactsService.deleteContact(ids[0]);
            } else {
              await ContactsService.deleteMultipleContacts(ids);
            }

            props.onContactsDeleted?.();
          }
        }
      })}
    </>
  );
}
