import type { FilterPanelConfig } from '../types';
import { GEOGRAPHIC_CONFIG } from '@/config/geo-constants';

// Storage Filter State Type
export interface StorageFilterState {
  searchTerm?: string;
  status?: string[];
  type?: string[];
  building?: string[];
  floor?: string[];
  project?: string[];
  ranges?: {
    areaRange?: { min?: number; max?: number };
    priceRange?: { min?: number; max?: number };
    dateRange?: { start?: Date; end?: Date };
  };
}

// Default Storage Filters
export const defaultStorageFilters: StorageFilterState = {
  searchTerm: '',
  status: [],
  type: [],
  building: [],
  floor: [],
  project: [],
  ranges: {
    areaRange: { min: undefined, max: undefined },
    priceRange: { min: undefined, max: undefined },
    dateRange: { start: undefined, end: undefined }
  }
};

// Storage Filters Configuration
export const storageFiltersConfig: FilterPanelConfig = {
  title: 'Φίλτρα Αποθηκών',
  searchPlaceholder: 'Όνομα, περιγραφή, κτίριο...',
  rows: [
    {
      id: 'storage-basic',
      fields: [
        {
          id: 'searchTerm',
          type: 'search',
          label: 'Αναζήτηση',
          placeholder: 'Όνομα, περιγραφή, κτίριο...',
          ariaLabel: 'Αναζήτηση αποθηκών',
          width: 2
        },
        {
          id: 'status',
          type: 'select',
          label: 'Κατάσταση',
          placeholder: 'Επιλέξτε κατάσταση',
          ariaLabel: 'Φίλτρο κατάστασης αποθήκης',
          width: 1,
          options: [
            { value: 'all', label: 'Όλες' },
            { value: 'available', label: 'Διαθέσιμες' },
            { value: 'occupied', label: 'Κατειλημμένες' },
            { value: 'maintenance', label: 'Συντήρηση' },
            { value: 'reserved', label: 'Κρατημένες' }
          ]
        },
        {
          id: 'type',
          type: 'select',
          label: 'Τύπος',
          placeholder: 'Επιλέξτε τύπο',
          ariaLabel: 'Φίλτρο τύπου αποθήκης',
          width: 1,
          options: [
            { value: 'all', label: 'Όλες' },
            { value: 'large', label: 'Μεγάλες' },
            { value: 'small', label: 'Μικρές' },
            { value: 'basement', label: 'Υπόγειες' },
            { value: 'ground', label: 'Ισόγειες' },
            { value: 'special', label: 'Ειδικές' }
          ]
        }
      ]
    },
    {
      id: 'storage-location',
      fields: [
        {
          id: 'building',
          type: 'select',
          label: 'Κτίριο',
          placeholder: 'Επιλέξτε κτίριο',
          ariaLabel: 'Φίλτρο κτιρίου',
          width: 1,
          options: [
            { value: 'all', label: 'Όλα' },
            { value: 'building-a', label: 'Κτίριο Α' },
            { value: 'building-b', label: 'Κτίριο Β' },
            { value: 'building-c', label: 'Κτίριο Γ' },
            { value: 'building-d', label: 'Κτίριο Δ' },
            { value: 'building-e', label: 'Κτίριο Ε' }
          ]
        },
        {
          id: 'floor',
          type: 'select',
          label: 'Όροφος',
          placeholder: 'Επιλέξτε όροφο',
          ariaLabel: 'Φίλτρο ορόφου',
          width: 1,
          options: [
            { value: 'all', label: 'Όλοι' },
            { value: 'basement-2', label: 'Υπόγειο -2' },
            { value: 'basement-1', label: 'Υπόγειο -1' },
            { value: 'ground', label: 'Ισόγειο' },
            { value: 'first', label: '1ος Όροφος' },
            { value: 'second', label: '2ος Όροφος' },
            { value: 'other', label: 'Λοιπά' }
          ]
        },
        {
          id: 'project',
          type: 'select',
          label: 'Έργο',
          placeholder: 'Επιλέξτε έργο',
          ariaLabel: 'Φίλτρο έργου',
          width: 1,
          options: [
            { value: 'all', label: 'Όλα' },
            { value: 'project1', label: process.env.NEXT_PUBLIC_SAMPLE_PROJECT_1_NAME || 'Έργο Α' },
            { value: 'project2', label: process.env.NEXT_PUBLIC_SAMPLE_PROJECT_2_NAME || 'Έργο Β' },
            { value: 'project3', label: process.env.NEXT_PUBLIC_SAMPLE_PROJECT_3_NAME || 'Έργο Γ' }
          ]
        }
      ]
    },
    {
      id: 'storage-ranges',
      fields: [
        {
          id: 'ranges.areaRange',
          type: 'range',
          label: 'Εμβαδόν (m²)',
          placeholder: { min: 'Από', max: 'Έως' },
          ariaLabel: 'Φίλτρο εμβαδού',
          width: 1,
          range: { min: 0, max: 200, step: 5 }
        },
        {
          id: 'ranges.priceRange',
          type: 'range',
          label: 'Τιμή (€)',
          placeholder: { min: 'Από', max: 'Έως' },
          ariaLabel: 'Φίλτρο τιμής',
          width: 1,
          range: { min: 0, max: 100000, step: 1000 }
        },
        {
          id: 'ranges.dateRange',
          type: 'dateRange',
          label: 'Ημερομηνία Ενημέρωσης',
          placeholder: { start: 'Από', end: 'Έως' },
          ariaLabel: 'Φίλτρο ημερομηνίας',
          width: 1
        }
      ]
    }
  ]
};