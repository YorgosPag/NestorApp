import React from 'react';
import { User, Building2, Landmark } from 'lucide-react';
import type { ContactType } from '@/types/contacts';

/**
 * Get the appropriate icon component for a contact type
 * @param type Contact type
 * @param className CSS classes for the icon (defaults to h-4 w-4 for backward compatibility)
 */
export const getTypeIcon = (type: ContactType, className: string = "h-4 w-4") => {
  const props = { className };

  switch (type) {
    case 'individual': return React.createElement(User, props);
    case 'company': return React.createElement(Building2, props);
    case 'service': return React.createElement(Landmark, props);
    default: return React.createElement(User, props);
  }
};

export const getTypeLabel = (type: ContactType) => {
  switch (type) {
    case 'individual': return 'Φυσικό Πρόσωπο';
    case 'company': return 'Εταιρεία';
    case 'service': return 'Δημόσια Υπηρεσία';
    default: return 'Επαφή';
  }
};