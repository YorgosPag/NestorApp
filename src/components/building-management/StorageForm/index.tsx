'use client';

import React from 'react';
import { createPortal } from 'react-dom';
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
    formType,
  });
  
  // 🏢 FIX (2026-02-15): Portal rendering — ensures modal overlays the ENTIRE viewport.
  // Without portal, ancestor elements with `transform`, `will-change`, or `contain`
  // create a new containing block, causing `position: fixed` to be relative to that
  // ancestor instead of the viewport. This caused the modal header to hide behind
  // the building details header bar.
  const modalContent = (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center p-4"
      style={{ zIndex: 9999 }}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
      role="dialog"
      aria-modal="true"
    >
      <div className={`${colors.bg.primary} ${quick.card} shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col`}>
        {/* Header — fixed at top, never shrinks */}
        <StorageFormHeader
          formType={formType}
          building={{ name: building.name, project: building.project }}
          formTitle={formTitle}
          onCancel={onCancel}
        />

        {/* Form — flex column fills remaining space */}
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden min-h-0">
          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
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

          {/* Footer — pinned at bottom, never shrinks */}
          <StorageFormFooter onCancel={onCancel} unit={unit} />
        </form>
      </div>
    </div>
  );

  // Render into document.body to escape any ancestor stacking context
  if (typeof document !== 'undefined') {
    return createPortal(modalContent, document.body);
  }
  return modalContent;
}
