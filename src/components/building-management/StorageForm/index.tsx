
'use client';

import React from 'react';
import type { StorageUnit, StorageType } from '@/types/storage';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useStorageForm } from './useStorageForm';

import { StorageFormHeader } from './StorageFormHeader';
import { StorageFormBasicInfo } from './StorageFormBasicInfo';
import { StorageFormSpecs } from './StorageFormSpecs';
import { StorageFormFeatures } from './StorageFormFeatures';
import { StorageFormFooter } from './StorageFormFooter';

interface StorageFormProps {
  unit: StorageUnit | null;
  building: {
    id: string;
    name: string;
    project: string;
    company: string;
  };
  onSave: (unit: StorageUnit) => void;
  onCancel: () => void;
  formType: StorageType;
}

export function StorageForm({ unit, building, onSave, onCancel, formType }: StorageFormProps) {
  const colors = useSemanticColors();
  const { quick } = useBorderTokens();

  const {
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
  } = useStorageForm({
    unit,
    building,
    onSave,
    onCancel,
    formType,
  });
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className={`${colors.bg.primary} ${quick.card} shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col`}>
        <StorageFormHeader
          formType={formType}
          building={{ name: building.name, project: building.project }}
          formTitle={formTitle}
          onCancel={onCancel}
        />
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-6">
            <StorageFormBasicInfo
              formData={formData}
              errors={errors}
              updateField={updateField}
              generateAutoCode={handleGenerateAutoCode}
              formType={formType}
            />
            <StorageFormSpecs
              formData={formData}
              errors={errors}
              updateField={updateField}
              isCalculatingPrice={isCalculatingPrice}
              availableFloors={availableFloors}
            />
            <StorageFormFeatures
              features={formData.features || []}
              newFeature={newFeature}
              setNewFeature={setNewFeature}
              addFeature={addFeature}
              removeFeature={removeFeature}
              addCommonFeature={addCommonFeature}
              commonFeaturesForType={commonFeaturesForType}
            />
          </div>
          <StorageFormFooter onCancel={onCancel} unit={unit} />
        </form>
      </div>
    </div>
  );
}
