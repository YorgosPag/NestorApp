import React from 'react';
import { User, Building2, Landmark } from 'lucide-react';
import type { ContactType } from '@/types/contacts';

export const getTypeIcon = (type: ContactType, iconSize: string = 'h-4 w-4') => {
  switch (type) {
    case 'individual': return React.createElement(User, { className: iconSize });
    case 'company': return React.createElement(Building2, { className: iconSize });
    case 'service': return React.createElement(Landmark, { className: iconSize });
    default: return React.createElement(User, { className: iconSize });
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