import type { Contact } from '@/types/contacts';

export interface ContactDetailsProps {
  contact: Contact | null;
  onEditContact?: () => void;
  onDeleteContact?: () => void;
  onContactUpdated?: () => void;
  onNewContact?: () => void;
  /** When true, shows contact in read-only mode (e.g. trash view) */
  readOnly?: boolean;
}
