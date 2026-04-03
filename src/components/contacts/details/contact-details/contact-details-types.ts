import type { Contact } from '@/types/contacts';

export interface ContactDetailsProps {
  contact: Contact | null;
  onEditContact?: () => void;
  onDeleteContact?: () => void;
  onContactUpdated?: () => void;
  onNewContact?: () => void;
}
