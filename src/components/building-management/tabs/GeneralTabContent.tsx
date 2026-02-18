'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Header } from './GeneralTabContent/Header';
import { BasicInfoCard } from './GeneralTabContent/BasicInfoCard';
import { TechnicalSpecsCard } from './GeneralTabContent/TechnicalSpecsCard';
import { ProgressCard } from './GeneralTabContent/ProgressCard';
import { FilesCard } from './GeneralTabContent/FilesCard';
import { LegalInfoCard } from './GeneralTabContent/LegalInfoCard';
import { SettingsCard } from './GeneralTabContent/SettingsCard';
import { CompanySelectorCard } from './GeneralTabContent/CompanySelectorCard';
import { ProjectSelectorCard } from './GeneralTabContent/ProjectSelectorCard';
import { BuildingAddressesCard } from './GeneralTabContent/BuildingAddressesCard';
import type { Building } from '../BuildingsPageContent';
import { validateForm } from './GeneralTabContent/utils';
import { BuildingStats } from './BuildingStats';
import { BuildingUnitsTable } from './GeneralTabContent/BuildingUnitsTable';
// ENTERPRISE: Firestore persistence for building updates
import { updateBuilding } from '../building-services';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('GeneralTabContent');

/** Extract initial form data from building (reused for reset on cancel) */
function buildFormData(building: Building) {
  return {
    name: building.name,
    description: building.description || '',
    totalArea: building.totalArea,
    builtArea: building.builtArea ?? 0,
    floors: building.floors,
    units: building.units ?? 0,
    totalValue: building.totalValue ?? 0,
    startDate: building.startDate || '',
    completionDate: building.completionDate || '',
    address: building.address || '',
    city: building.city || ''
  };
}

interface GeneralTabContentProps {
  building: Building;
  /** External editing state (from parent header via globalProps) */
  isEditing?: boolean;
  /** Callback to notify parent of editing state changes */
  onEditingChange?: (editing: boolean) => void;
  /** Ref where this component registers its save function for parent delegation */
  onSaveRef?: React.MutableRefObject<(() => Promise<boolean>) | null>;
}

export function GeneralTabContent({
  building,
  isEditing: externalIsEditing,
  onEditingChange,
  onSaveRef
}: GeneralTabContentProps) {
  // Internal editing state (used when no parent controls editing)
  const [internalIsEditing, setInternalIsEditing] = useState(false);

  // Determine if parent controls editing
  const isParentControlled = onEditingChange !== undefined;
  const effectiveIsEditing = isParentControlled ? (externalIsEditing ?? false) : internalIsEditing;

  const setEffectiveEditing = useCallback((value: boolean) => {
    if (isParentControlled) {
      onEditingChange?.(value);
    } else {
      setInternalIsEditing(value);
    }
  }, [isParentControlled, onEditingChange]);

  const [autoSaving, setAutoSaving] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [formData, setFormData] = useState(() => buildFormData(building));
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Track cancel vs save transitions for form reset
  const didSaveRef = useRef(false);
  const prevEditingRef = useRef(effectiveIsEditing);

  // Reset form data on cancel (editing → not editing, without a save)
  useEffect(() => {
    const wasEditing = prevEditingRef.current;
    prevEditingRef.current = effectiveIsEditing;

    if (wasEditing && !effectiveIsEditing && !didSaveRef.current) {
      // Cancel: revert form to original building values
      setFormData(buildFormData(building));
      setSaveError(null);
      setErrors({});
    }
    didSaveRef.current = false;
  }, [effectiveIsEditing, building]);

  useEffect(() => {
    if (!effectiveIsEditing) return;

    const delayId = setTimeout(() => {
      setAutoSaving(true);
      const saveId = setTimeout(() => {
        setAutoSaving(false);
        setLastSaved(new Date());
        logger.info('Auto-saved', { formData });
      }, 1000);

      // Cleanup for the inner timeout
      return () => clearTimeout(saveId);
    }, 2000);

    // Cleanup for the outer timeout
    return () => clearTimeout(delayId);
  }, [formData, effectiveIsEditing]);

  /**
   * ENTERPRISE: Handle building save using Firestore
   * Returns true on success, false on failure
   */
  const handleSave = useCallback(async (): Promise<boolean> => {
    if (!validateForm(formData, setErrors)) {
      return false;
    }

    try {
      setIsSaving(true);
      setSaveError(null);
      logger.info('Saving building to Firestore', { formData });

      // ENTERPRISE: Call Firestore update function
      const result = await updateBuilding(String(building.id), {
        name: formData.name,
        description: formData.description,
        totalArea: formData.totalArea,
        builtArea: formData.builtArea,
        floors: formData.floors,
        units: formData.units,
        totalValue: formData.totalValue,
        startDate: formData.startDate,
        completionDate: formData.completionDate,
        address: formData.address,
        city: formData.city,
      });

      if (!result.success) {
        throw new Error(result.error || 'Failed to save building');
      }

      logger.info('Building saved successfully to Firestore');
      didSaveRef.current = true;
      setEffectiveEditing(false);
      setLastSaved(new Date());
      return true;

    } catch (error) {
      logger.error('Error saving building', { error });
      setSaveError(error instanceof Error ? error.message : 'Failed to save building');
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [building.id, formData, setEffectiveEditing]);

  // Register save function for parent header delegation
  useEffect(() => {
    if (onSaveRef) {
      onSaveRef.current = handleSave;
    }
    return () => {
      if (onSaveRef) {
        onSaveRef.current = null;
      }
    };
  }, [handleSave, onSaveRef]);

  const updateField = (field: string, value: string | number) => {
    setFormData(prev => {
        const newState = { ...prev, [field]: value };
        // ENTERPRISE: Safe numeric check for auto-calculation
        const numericValue = typeof value === 'number' ? value : parseFloat(String(value)) || 0;
        if (field === 'totalArea' && numericValue > 0 && prev.builtArea === 0) {
            return { ...newState, builtArea: Math.round(numericValue * 0.8) };
        }
        return newState;
    });

    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  return (
    <div className="space-y-6">
      <Header
        building={building}
        isEditing={effectiveIsEditing}
        autoSaving={autoSaving || isSaving}
        lastSaved={lastSaved}
        setIsEditing={setEffectiveEditing}
        handleSave={handleSave}
        hideEditControls={isParentControlled}
      />
      {/* ENTERPRISE: Show save error if any */}
      {saveError && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative dark:bg-red-900 dark:border-red-700 dark:text-red-300">
          <strong className="font-bold">Σφάλμα: </strong>
          <span>{saveError}</span>
        </div>
      )}
      <BuildingStats buildingId={String(building.id)} />
      <BasicInfoCard
        formData={formData}
        updateField={updateField}
        isEditing={effectiveIsEditing}
        errors={errors}
      />
      {/* ENTERPRISE: Company + Project selectors side-by-side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <CompanySelectorCard
          buildingId={String(building.id)}
          currentCompanyId={building.companyId}
          isEditing={effectiveIsEditing}
          onCompanyChanged={(newCompanyId, companyName) => {
            logger.info('Building linked to company', { buildingId: building.id, companyName, newCompanyId });
          }}
        />
        <ProjectSelectorCard
          buildingId={String(building.id)}
          currentProjectId={building.projectId}
          isEditing={effectiveIsEditing}
          onProjectChanged={(newProjectId) => {
            logger.info('Building linked to project', { buildingId: building.id, newProjectId });
          }}
        />
      </div>
      {/* ENTERPRISE: Multi-address management (ADR-167) */}
      <BuildingAddressesCard
        buildingId={String(building.id)}
        projectId={building.projectId}
        addresses={building.addresses}
        legacyAddress={building.address}
        legacyCity={building.city}
      />
      <TechnicalSpecsCard
        formData={formData}
        updateField={updateField}
        isEditing={effectiveIsEditing}
        errors={errors}
      />
      <ProgressCard progress={building.progress} />
      <BuildingUnitsTable buildingId={String(building.id)} />
      <FilesCard />
      <LegalInfoCard />
      <SettingsCard />
    </div>
  );
}
