
'use client';

import { useState, useEffect } from 'react';
import type { StorageUnit, StorageType } from '@/types/storage';
import { calculatePrice } from './storageFormUtils';

interface UseStorageFormStateProps {
  unit: StorageUnit | null;
  formType: StorageType;
  building: {
    id: number;
    name: string;
    project: string;
    company: string;
  };
}

export function useStorageFormState({ unit, formType, building }: UseStorageFormStateProps) {
  const [formData, setFormData] = useState<Partial<StorageUnit>>({
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

  useEffect(() => {
    if (unit) {
      setFormData(unit);
    } else {
      setFormData(prev => ({
        ...prev,
        code: '', type: formType, floor: 'Υπόγειο', area: 0, price: 0,
        status: 'available', description: '', linkedProperty: null,
        coordinates: { x: 0, y: 0 }, features: []
      }));
    }
  }, [unit, formType]);
  
  useEffect(() => {
    if (formData.area && formData.area > 0 && !unit) { // only for new units
      setIsCalculatingPrice(true);
      const timeout = setTimeout(() => {
        const calculatedPrice = calculatePrice(formData.area!, formData.floor!, formData.type!);
        setFormData(prev => ({ ...prev, price: calculatedPrice }));
        setIsCalculatingPrice(false);
      }, 500); // reduced delay
      return () => clearTimeout(timeout);
    }
  }, [formData.area, formData.floor, formData.type, unit]);


  const updateField = (field: string, value: any) => {
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
