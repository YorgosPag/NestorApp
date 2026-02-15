'use client';

import { useStorageFormState } from './useStorageFormState';
import { useFeatureLogic } from './useFeatureLogic';
import { useStorageFormHandlers } from './useStorageFormHandlers';
import { storageFormConfig } from './storageFormConfig';
import type { StorageUnit, StorageType } from '@/types/storage';
import { useTranslation } from '@/i18n/hooks/useTranslation';

interface UseStorageFormProps {
  unit: StorageUnit | null;
  building: {
    id: string;
    name: string;
    project: string;
    company: string;
  };
  onSave: (unit: StorageUnit) => void;
  formType: StorageType;
}

export function useStorageForm({ unit, building, onSave, formType }: UseStorageFormProps) {
  const { t } = useTranslation('building');

  const {
    formData,
    setFormData,
    newFeature,
    setNewFeature,
    updateField,
    errors,
    setErrors,
    isCalculatingPrice,
  } = useStorageFormState({ unit, formType, building });

  const {
    addFeature,
    removeFeature,
    addCommonFeature
  } = useFeatureLogic({ formData, newFeature, setNewFeature, updateField });

  const {
    formTitle,
    handleGenerateAutoCode,
    handleSubmit
  } = useStorageFormHandlers({
      unit,
      formData,
      formType,
      setErrors,
      onSave,
      updateField,
      t,
  });

  const { availableFloors, commonFeaturesForType } = storageFormConfig(formType, t);

  return {
    formData,
    errors,
    newFeature,
    isCalculatingPrice,
    formTitle,
    availableFloors,
    commonFeaturesForType,
    setNewFeature,
    handleSubmit,
    updateField,
    handleGenerateAutoCode,
    addFeature,
    removeFeature,
    addCommonFeature,
  };
}
