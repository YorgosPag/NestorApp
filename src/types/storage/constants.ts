import type { StorageUnit, StorageType, StorageStatus } from './contracts';

// Export default storage unit template
export const defaultStorageUnit: Partial<StorageUnit> = {
  type: 'storage',
  status: 'available',
  floor: 'Υπόγειο',
  area: 0,
  price: 0,
  linkedProperty: null,
  coordinates: { x: 0, y: 0 },
  features: [],
  description: '',
  notes: ''
};

// Common storage features by type
export const commonStorageFeatures: Record<StorageType, string[]> = {
  storage: [
    'Ηλεκτρικό ρεύμα',
    'Φυσικός φωτισμός',
    'Τεχνητός φωτισμός',
    'Αεροθαλάμος',
    'Ασφάλεια',
    'Πρόσβαση ανελκυστήρα',
    'Υδραυλικές εγκαταστάσεις',
    'Κλιματισμός',
    'Συναγερμός'
  ],
  parking: [
    'Πρίζα φόρτισης EV',
    'Κλειστό',
    'Φωτισμός',
    'Ασφάλεια',
    'Εύκολη πρόσβαση'
  ]
};

// Status labels in Greek
export const statusLabels: Record<StorageStatus, string> = {
  available: 'Διαθέσιμο',
  sold: 'Πωλήθηκε',
  reserved: 'Κρατημένο',
  maintenance: 'Συντήρηση'
};

// Type labels in Greek
export const typeLabels: Record<StorageType, string> = {
  storage: 'Αποθήκη',
  parking: 'Θέση Στάθμευσης'
};

// Standard floor names
export const standardFloors: string[] = [
  'Υπόγειο 3',
  'Υπόγειο 2',
  'Υπόγειο 1',
  'Υπόγειο',
  'Ισόγειο',
  '1ος Όροφος',
  '2ος Όροφος',
  '3ος Όροφος',
  '4ος Όροφος',
  '5ος Όροφος',
  '6ος Όροφος',
  '7ος Όροφος',
  '8ος Όροφος',
  '9ος Όροφος'
];
