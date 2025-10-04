
'use client';
import { Home, Building } from "lucide-react";

export const PROPERTY_STATUS_CONFIG: Record<string, { label: string, color: string }> = {
    'for-sale': {
        label: 'Προς Πώληση',
        color: 'bg-green-100 text-green-800 border-green-200',
    },
    'for-rent': {
        label: 'Προς Ενοικίαση',
        color: 'bg-blue-100 text-blue-800 border-blue-200',
    },
    'sold': {
        label: 'Πουλημένο',
        color: 'bg-red-100 text-red-800 border-red-200',
    },
    'rented': {
        label: 'Ενοικιασμένο',
        color: 'bg-orange-100 text-orange-800 border-orange-200',
    },
    'reserved': {
        label: 'Δεσμευμένο',
        color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    },
    default: { label: 'Άγνωστο', color: 'bg-gray-100 text-gray-800 border-gray-200' },
};


export const PROPERTY_TYPE_ICONS: { [key: string]: React.ElementType } = {
  'Στούντιο': Home,
  'Γκαρσονιέρα': Home,
  'Διαμέρισμα 2Δ': Home,
  'Διαμέρισμα 3Δ': Home,
  'Μεζονέτα': Building,
  'Κατάστημα': Building,
  'Αποθήκη': Building,
  'default': Home,
};
