
import type { StorageUnit } from '@/types/storage';

export const mockStorageUnits: StorageUnit[] = [
    {
      id: 'A_A2_1',
      code: 'A_A2_1',
      type: 'storage',
      floor: 'Υπόγειο',
      area: 4.08,
      price: 1590.00,
      status: 'available',
      description: 'ΜΑΥΡΑΚΗ ΑΙΚΑΤΕΡΙΝΗ',
      building: 'ΚΤΙΡΙΟ Α',
      project: 'Παλαιολόγου',
      company: 'Ν.Χ.Γ. ΠΑΓΩΝΗΣ & ΣΙΑ Ο.Ε.',
      linkedProperty: null,
      coordinates: { x: 10, y: 15 },
      features: ['Ηλεκτρικό ρεύμα', 'Αεροθαλάμος']
    },
    {
      id: 'A_A2_2',
      code: 'A_A2_2', 
      type: 'storage',
      floor: 'Υπόγειο',
      area: 4.09,
      price: 1590.00,
      status: 'sold',
      description: 'ΜΑΥΡΑΚΗ ΑΙΚΑΤΕΡΙΝΗ',
      building: 'ΚΤΙΡΙΟ Α',
      project: 'Παλαιολόγου',
      company: 'Ν.Χ.Γ. ΠΑΓΩΝΗΣ & ΣΙΑ Ο.Ε.',
      linkedProperty: 'Δ2.1',
      coordinates: { x: 20, y: 15 },
      features: ['Ηλεκτρικό ρεύμα']
    },
    {
      id: 'A_A4_7',
      code: 'A_A4_7',
      type: 'storage',
      floor: 'Υπόγειο',
      area: 3.76,
      price: 1490.00,
      status: 'available',
      description: 'ΑΣΛΑΝΙΔΗΣ ΑΝΑΣΤΑΣΙΟΣ',
      building: 'ΚΤΙΡΙΟ Α',
      project: 'Παλαιολόγου',
      company: 'Ν.Χ.Γ. ΠΑΓΩΝΗΣ & ΣΙΑ Ο.Ε.',
      linkedProperty: null,
      coordinates: { x: 30, y: 10 },
      features: ['Φυσικός φωτισμός']
    },
    {
      id: 'P_1',
      code: 'P_1',
      type: 'parking',
      floor: 'Υπόγειο',
      area: 12.5,
      price: 10000,
      status: 'available',
      description: 'Standard parking space',
      building: 'ΚΤΙΡΙΟ Α',
      project: 'Παλαιολόγου',
      company: 'Ν.Χ.Γ. ΠΑΓΩΝΗΣ & ΣΙΑ Ο.Ε.',
      linkedProperty: null,
      coordinates: { x: 50, y: 50 },
      features: ['Πρίζα φόρτισης EV']
    }
  ];
  