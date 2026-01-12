
'use client';

import { useCallback } from 'react';
import type { StorageUnit } from '@/types/storage';

interface UseFeatureLogicProps {
  formData: Partial<StorageUnit>;
  newFeature: string;
  setNewFeature: (value: string) => void;
  updateField: (field: string, value: string[] | string | number) => void;
}

export function useFeatureLogic({ formData, newFeature, setNewFeature, updateField }: UseFeatureLogicProps) {
  
  const addFeature = useCallback(() => {
    if (newFeature.trim() && !formData.features?.includes(newFeature.trim())) {
      updateField('features', [...(formData.features || []), newFeature.trim()]);
      setNewFeature('');
    }
  }, [newFeature, formData.features, updateField, setNewFeature]);

  const removeFeature = useCallback((featureToRemove: string) => {
    updateField('features', formData.features?.filter(f => f !== featureToRemove) || []);
  }, [formData.features, updateField]);
  
  const addCommonFeature = useCallback((feature: string) => {
    if (!formData.features?.includes(feature)) {
      updateField('features', [...(formData.features || []), feature]);
    }
  }, [formData.features, updateField]);

  return {
    addFeature,
    removeFeature,
    addCommonFeature,
  };
}
