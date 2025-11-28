'use client';

import { AddNewContactDialog } from './AddNewContactDialog';
import type { Contact } from '@/types/contacts';

interface EditContactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact: Contact | null;
  onContactUpdated: () => void;
}

export function EditContactDialog({ open, onOpenChange, contact, onContactUpdated }: EditContactDialogProps) {
  return (
    <AddNewContactDialog
      open={open}
      onOpenChange={onOpenChange}
      onContactAdded={onContactUpdated}
      editContact={contact}
    />
  );
}