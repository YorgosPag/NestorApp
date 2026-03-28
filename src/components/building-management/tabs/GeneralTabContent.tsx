'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './GeneralTabContent/Header';
import { BasicInfoCard } from './GeneralTabContent/BasicInfoCard';
// BuildingStats → moved to "Αναλυτικά" tab (AnalyticsTabContent)
// ProgressCard → moved to "Χρονοδιάγραμμα" tab (TimelineTabContent)
import type { Building } from '../BuildingsPageContent';
// ENTERPRISE: Firestore persistence for building CRUD
import { updateBuilding, createBuilding, getProjectsList } from '../building-services';
import { createModuleLogger } from '@/lib/telemetry';
// ENTERPRISE: Centralized EntityLinkCard (replaces ProjectSelectorCard)
import { FolderKanban } from 'lucide-react';
import { EntityLinkCard } from '@/components/shared/EntityLinkCard';
import type { EntityLinkOption } from '@/components/shared/EntityLinkCard';
import { RealtimeService } from '@/services/realtime';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useEntityLink } from '@/hooks/useEntityLink';
import { useCompanyId } from '@/hooks/useCompanyId';
// 🏢 ADR-248: Centralized auto-save system
import { useAutoSave } from '@/hooks/useAutoSave';
import { AutoSaveStatusIndicator } from '@/components/shared/AutoSaveStatusIndicator';
// 🏢 SPEC-256A: Optimistic versioning — conflict detection
import { useVersionedSave } from '@/hooks/useVersionedSave';
import { ConflictDialog } from '@/components/shared/ConflictDialog';
import { useRouter } from 'next/navigation';
import '@/lib/design-system';

const logger = createModuleLogger('GeneralTabContent');

/** Extract initial form data from building (reused for reset on cancel) */
function buildFormData(building: Building) {
  return {
    name: building.name,
    description: building.description || '',
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
  const router = useRouter();
  // 🏢 ADR-201: Centralized companyId resolution (building → user fallback)
  const resolvedCompanyId = useCompanyId({ building })?.companyId ?? '';

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

  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [formData, setFormData] = useState(() => buildFormData(building));
  const [errors, setErrors] = useState<Record<string, string>>({});

  // =========================================================================
  // ADR-200: Centralized entity linking — Project
  // =========================================================================

  const loadProjects = useCallback(async (): Promise<EntityLinkOption[]> => {
    const projects = await getProjectsList();
    return projects.map(p => ({
      id: p.id,
      name: p.name,
      currentLabel: p.licenseTitle || undefined,
    }));
  }, []);

  const saveProject = useCallback(async (newId: string | null) => {
    try {
      const result = await updateBuilding(String(building.id), { projectId: newId });
      if (result.success) {
        logger.info('Building linked to project', { buildingId: building.id, projectId: newId });
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

  const projectLink = useEntityLink({
    relation: 'building-project',
    entityId: String(building.id),
    initialParentId: building.projectId || null,
    loadOptions: loadProjects,
    saveMode: isCreateMode ? 'local' : 'immediate',
    onSave: isCreateMode ? undefined : saveProject,
    icon: FolderKanban,
    cardId: 'building-project-link',
    labels: {
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
    },
  }, effectiveIsEditing);

  // Sync formData when user selects a different building
  // OR when server data arrives after creation (name was '' in temp, now populated)
  const prevBuildingIdRef = React.useRef(building.id);
  const prevBuildingNameRef = React.useRef(building.name);
  useEffect(() => {
    const idChanged = prevBuildingIdRef.current !== building.id;
    const namePopulated = prevBuildingNameRef.current !== building.name;

    prevBuildingIdRef.current = building.id;
    prevBuildingNameRef.current = building.name;

    // Reset form when building switches OR when server populates data (post-create sync)
    if (idChanged || (namePopulated && !effectiveIsEditing)) {
      setFormData(buildFormData(building));
      setSaveError(null);
      setErrors({});
    }
  }, [building, effectiveIsEditing]);

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

  // 🏢 SPEC-256A: Optimistic versioning — wraps updateBuilding with _v tracking
  const versionedSaveFn = useCallback(async (data: ReturnType<typeof buildFormData> & { _v?: number }) => {
    const result = await updateBuilding(String(building.id), {
      name: data.name,
      description: data.description,
      startDate: data.startDate,
      completionDate: data.completionDate,
      address: data.address,
      city: data.city,
      _v: data._v,
    });
    return result;
  }, [building.id]);

  const versioned = useVersionedSave<ReturnType<typeof buildFormData>>({
    initialVersion: (building._v as number | undefined),
    saveFn: versionedSaveFn,
    onConflict: (body) => {
      logger.warn('Version conflict detected', { buildingId: building.id, conflict: body });
    },
  });

  // 🏢 ADR-248: Centralized auto-save with actual Firestore persistence
  const autoSaveFn = useCallback(async (data: ReturnType<typeof buildFormData>) => {
    if (isCreateMode) return;
    await versioned.save(data);
  }, [isCreateMode, versioned]);

  const {
    status: autoSaveStatus,
    lastSaved,
    error: autoSaveError,
    retry: autoSaveRetry,
  } = useAutoSave(formData, {
    saveFn: autoSaveFn,
    enabled: effectiveIsEditing && !isCreateMode && !versioned.isConflicted,
  });

  /**
   * Handle building save using Firestore
   * Supports both "Create" (POST) and "Update" (PATCH) modes
   * Returns true on success, false on failure
   */
  const handleSave = useCallback(async (): Promise<boolean> => {
    // Validation: only name is required
    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) {
      newErrors.name = t('validation.nameRequired', { defaultValue: 'Name is required' });
    }
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return false;
    }

    try {
      setIsSaving(true);
      setSaveError(null);

      const payload = {
        name: formData.name,
        description: formData.description,
        startDate: formData.startDate,
        completionDate: formData.completionDate,
        address: formData.address,
        city: formData.city,
      };

      if (isCreateMode) {
        const projectPayload = projectLink.getPayload();
        logger.info('Creating new building in Firestore', { formData, projectId: projectPayload.projectId ?? null });
        const result = await createBuilding({
          ...payload,
          companyId: resolvedCompanyId,
          status: 'planning',
          // ADR-200: Include projectId from centralized hook
          ...projectPayload,
        });

        if (!result.success || !result.buildingId) {
          throw new Error(result.error || 'Failed to create building');
        }

        logger.info('Building created successfully', { buildingId: result.buildingId });
        didSaveRef.current = true;
        setEffectiveEditing(false);
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
        return true;
      }

    } catch (error) {
      logger.error('Error saving building', { error });
      setSaveError(error instanceof Error ? error.message : 'Failed to save building');
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [building.id, building.companyId, formData, setEffectiveEditing, isCreateMode, onBuildingCreated, projectLink, t]);

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
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  // 🏢 SPEC-256A: ConflictDialog handlers
  const handleConflictReload = useCallback(() => {
    router.refresh();
  }, [router]);

  const handleConflictForceSave = useCallback(async () => {
    await versioned.forceSave(formData);
  }, [versioned, formData]);

  const handleConflictClose = useCallback(() => {
    versioned.resetConflict();
  }, [versioned]);

  return (
    <section className="space-y-2">
      {/* 🏢 SPEC-256A: Version conflict dialog */}
      <ConflictDialog
        open={versioned.isConflicted}
        conflict={versioned.conflictData}
        onReload={handleConflictReload}
        onForceSave={handleConflictForceSave}
        onClose={handleConflictClose}
      />
      <Header
        building={building}
        isEditing={effectiveIsEditing}
        autoSaving={autoSaveStatus === 'saving' || isSaving}
        lastSaved={lastSaved}
        setIsEditing={setEffectiveEditing}
        handleSave={handleSave}
        hideEditControls={isParentControlled}
      />
      {/* 🏢 ADR-248: Centralized auto-save status indicator */}
      {effectiveIsEditing && !isCreateMode && (
        <AutoSaveStatusIndicator
          status={autoSaveStatus}
          lastSaved={lastSaved}
          error={autoSaveError}
          variant="inline"
          onRetry={autoSaveRetry}
        />
      )}
      {/* ENTERPRISE: Show save error if any */}
      {saveError && (
        // eslint-disable-next-line design-system/enforce-semantic-colors
        <aside className="bg-red-100 border border-red-400 text-red-700 px-2 py-2 rounded relative dark:bg-red-900 dark:border-red-700 dark:text-red-300">
          <strong className="font-bold">{t('tabs.general.errorLabel')}</strong>
          <span>{saveError}</span>
        </aside>
      )}
      {/* ADR-200: Building → Project linking via centralized useEntityLink hook */}
      <EntityLinkCard key={projectLink.linkCardKey} {...projectLink.linkCardProps} />
      <BasicInfoCard
        formData={formData}
        updateField={updateField}
        isEditing={effectiveIsEditing}
        errors={errors}
      />
    </section>
  );
}
