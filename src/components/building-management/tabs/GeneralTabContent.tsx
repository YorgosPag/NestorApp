'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './GeneralTabContent/Header';
import { BasicInfoCard } from './GeneralTabContent/BasicInfoCard';
import { TechnicalSpecsCard } from './GeneralTabContent/TechnicalSpecsCard';
// BuildingStats → moved to "Αναλυτικά" tab (AnalyticsTabContent)
// ProgressCard → moved to "Χρονοδιάγραμμα" tab (TimelineTabContent)
import type { Building } from '../BuildingsPageContent';
import { validateForm } from './GeneralTabContent/utils';
// ENTERPRISE: Firestore persistence for building CRUD
import { updateBuilding, createBuilding, getProjectsList } from '../building-services';
import { createModuleLogger } from '@/lib/telemetry';
// ENTERPRISE: Centralized EntityLinkCard (replaces CompanySelectorCard + ProjectSelectorCard)
import { Building2, FolderKanban } from 'lucide-react';
import { EntityLinkCard } from '@/components/shared/EntityLinkCard';
import type { EntityLinkOption } from '@/components/shared/EntityLinkCard';
import { getAllActiveCompanies } from '@/services/companies.service';
import { RealtimeService } from '@/services/realtime';
import { useTranslation } from '@/i18n/hooks/useTranslation';

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
  /** 🏢 ENTERPRISE: "Fill then Create" — building not yet in Firestore */
  isCreateMode?: boolean;
  /** Callback after successful creation — receives real Firestore building ID */
  onBuildingCreated?: (buildingId: string) => void;
}

export function GeneralTabContent({
  building,
  isEditing: externalIsEditing,
  onEditingChange,
  onSaveRef,
  isCreateMode,
  onBuildingCreated,
}: GeneralTabContentProps) {
  const { t } = useTranslation('building');

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
  const didSaveRef = React.useRef(false);
  const prevEditingRef = React.useRef(effectiveIsEditing);

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
   * Handle building save using Firestore
   * Supports both "Create" (POST) and "Update" (PATCH) modes
   * Returns true on success, false on failure
   */
  const handleSave = useCallback(async (): Promise<boolean> => {
    if (!validateForm(formData, setErrors)) {
      return false;
    }

    try {
      setIsSaving(true);
      setSaveError(null);

      const payload = {
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
      };

      if (isCreateMode) {
        logger.info('Creating new building in Firestore', { formData });
        const result = await createBuilding({
          ...payload,
          companyId: building.companyId || '',
          status: 'planning',
        });

        if (!result.success || !result.buildingId) {
          throw new Error(result.error || 'Failed to create building');
        }

        logger.info('Building created successfully', { buildingId: result.buildingId });
        didSaveRef.current = true;
        setEffectiveEditing(false);
        setLastSaved(new Date());
        onBuildingCreated?.(result.buildingId);
        return true;

      } else {
        logger.info('Updating building in Firestore', { buildingId: building.id });
        const result = await updateBuilding(String(building.id), payload);

        if (!result.success) {
          throw new Error(result.error || 'Failed to save building');
        }

        logger.info('Building updated successfully');
        didSaveRef.current = true;
        setEffectiveEditing(false);
        setLastSaved(new Date());
        return true;
      }

    } catch (error) {
      logger.error('Error saving building', { error });
      setSaveError(error instanceof Error ? error.message : 'Failed to save building');
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [building.id, building.companyId, formData, setEffectiveEditing, isCreateMode, onBuildingCreated]);

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

  // =========================================================================
  // EntityLinkCard callbacks — Company
  // =========================================================================

  const loadCompanies = useCallback(async (): Promise<EntityLinkOption[]> => {
    const companies = await getAllActiveCompanies();
    return companies
      .filter(c => c.id)
      .map(c => ({ id: c.id!, name: c.companyName || '' }));
  }, []);

  const saveCompany = useCallback(async (newId: string | null, name: string) => {
    try {
      const result = await updateBuilding(String(building.id), {
        companyId: newId,
        company: name || null,
      });
      if (result.success) {
        logger.info('Building linked to company', { buildingId: building.id, companyName: name });
        return { success: true };
      }
      return { success: false, error: result.error || 'Failed to update' };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to update' };
    }
  }, [building.id]);

  // =========================================================================
  // EntityLinkCard callbacks — Project
  // =========================================================================

  const loadProjects = useCallback(async (): Promise<EntityLinkOption[]> => {
    const projects = await getProjectsList();
    return projects.map(p => ({ id: p.id, name: p.name }));
  }, []);

  const saveProject = useCallback(async (newId: string | null) => {
    try {
      const result = await updateBuilding(String(building.id), {
        projectId: newId,
      });
      if (result.success) {
        logger.info('Building linked to project', { buildingId: building.id, projectId: newId });
        // Dispatch real-time event for Navigation updates
        RealtimeService.dispatchBuildingProjectLinked({
          buildingId: String(building.id),
          previousProjectId: building.projectId || null,
          newProjectId: newId,
          timestamp: Date.now(),
        });
        return { success: true };
      }
      return { success: false, error: result.error || 'Failed to update' };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to update' };
    }
  }, [building.id, building.projectId]);

  return (
    <section className="space-y-2">
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
        <aside className="bg-red-100 border border-red-400 text-red-700 px-2 py-2 rounded relative dark:bg-red-900 dark:border-red-700 dark:text-red-300">
          <strong className="font-bold">Σφάλμα: </strong>
          <span>{saveError}</span>
        </aside>
      )}
      <BasicInfoCard
        formData={formData}
        updateField={updateField}
        isEditing={effectiveIsEditing}
        errors={errors}
      />
      {/* ENTERPRISE: Company + Project linking — EntityLinkCard (centralized)
          Disabled in create mode (building must exist in Firestore before linking) */}
      {!isCreateMode && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <EntityLinkCard
            cardId="building-company-link"
            icon={Building2}
            currentValue={building.companyId}
            loadOptions={loadCompanies}
            onSave={saveCompany}
            isEditing={effectiveIsEditing}
            labels={{
              title: t('companySelector.title'),
              label: t('companySelector.label'),
              placeholder: t('companySelector.placeholder'),
              noSelection: t('companySelector.noCompany'),
              loading: t('companySelector.loading'),
              save: t('companySelector.save'),
              saving: t('companySelector.saving'),
              success: t('companySelector.success'),
              error: t('companySelector.error'),
              currentLabel: t('companySelector.currentCompany'),
            }}
          />
          <EntityLinkCard
            cardId="building-project-link"
            icon={FolderKanban}
            currentValue={building.projectId}
            loadOptions={loadProjects}
            onSave={saveProject}
            isEditing={effectiveIsEditing}
            labels={{
              title: t('projectSelector.title'),
              label: t('projectSelector.label'),
              placeholder: t('projectSelector.placeholder'),
              noSelection: t('projectSelector.noProject'),
              loading: t('projectSelector.loading'),
              save: t('projectSelector.save'),
              saving: t('projectSelector.saving'),
              success: t('projectSelector.success'),
              error: t('projectSelector.error'),
              currentLabel: t('projectSelector.currentProject'),
            }}
          />
        </div>
      )}
      <TechnicalSpecsCard
        formData={formData}
        updateField={updateField}
        isEditing={effectiveIsEditing}
        errors={errors}
      />
    </section>
  );
}
