
'use client';

import { useState, useEffect } from 'react';
import type { StorageUnit, StorageType } from '@/types/storage';
import { calculatePrice } from './storageFormUtils';
import { useDebounce } from '@/hooks/useDebounce';

interface UseStorageFormStateProps {
  unit: StorageUnit | null;
  formType: StorageType;
  building: {
    id: string;
    name: string;
    project: string;
    company: string;
  };
}

export function useStorageFormState({ unit, formType, building }: UseStorageFormStateProps) {
  const defaultName = formType === 'parking' ? 'Θέση Στάθμευσης' : 'Αποθήκη';

  const [formData, setFormData] = useState<Partial<StorageUnit>>({
    name: defaultName,
    code: '',
    type: formType,
    floor: 'Υπόγειο',
    area: 0,
    price: 0,
    status: 'available',
    description: '',
    building: building.name,
    project: building.project,
    company: building.company,
    linkedProperty: null,
    coordinates: { x: 0, y: 0 },
    features: []
  });

  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [newFeature, setNewFeature] = useState('');
  const [isCalculatingPrice, setIsCalculatingPrice] = useState(false);

  // Debounce price-calculation inputs (500ms inactivity)
  const debouncedArea = useDebounce(formData.area, 500);
  const debouncedFloor = useDebounce(formData.floor, 500);
  const debouncedType = useDebounce(formData.type, 500);

  useEffect(() => {
    if (unit) {
      setFormData(unit);
    } else {
      setFormData(prev => ({
        ...prev,
        name: formType === 'parking' ? 'Θέση Στάθμευσης' : 'Αποθήκη',
        code: '', type: formType, floor: 'Υπόγειο', area: 0, price: 0,
        status: 'available', description: '', linkedProperty: null,
        coordinates: { x: 0, y: 0 }, features: []
      }));
    }
  }, [unit, formType]);

  useEffect(() => {
    if (debouncedArea && debouncedArea > 0 && !unit) {
      setIsCalculatingPrice(true);
      const calculatedPrice = calculatePrice(debouncedArea, debouncedFloor!, debouncedType!);
      setFormData(prev => ({ ...prev, price: calculatedPrice }));
      setIsCalculatingPrice(false);
    }
  }, [debouncedArea, debouncedFloor, debouncedType, unit]);


  // 🏢 ENTERPRISE: More flexible signature for component compatibility
  const updateField = (field: string, value: string | number | string[] | { x: number; y: number } | null) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  return {
    formData,
    setFormData,
    errors,
    setErrors,
    newFeature,
    setNewFeature,
    isCalculatingPrice,
    updateField
  };
}
