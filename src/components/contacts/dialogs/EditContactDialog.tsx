'use client';

import React, { useState } from 'react';
import { TabbedAddNewContactDialog } from './TabbedAddNewContactDialog';
import type { Contact } from '@/types/contacts';

interface EditContactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact: Contact | null;
  onContactUpdated: () => void;
  onLiveChange?: (updatedContact: Contact) => void;
}

export function EditContactDialog({ open, onOpenChange, contact, onContactUpdated, onLiveChange }: EditContactDialogProps) {
  return (
    <TabbedAddNewContactDialog
      open={open}
      onOpenChange={onOpenChange}
      onContactAdded={onContactUpdated}
      editContact={contact}
      onLiveChange={onLiveChange}
    />
  );
}