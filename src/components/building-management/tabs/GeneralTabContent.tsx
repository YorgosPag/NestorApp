'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './GeneralTabContent/Header';
import { BasicInfoCard } from './GeneralTabContent/BasicInfoCard';
// BuildingStats → moved to "Αναλυτικά" tab (AnalyticsTabContent)
// ProgressCard → moved to "Χρονοδιάγραμμα" tab (TimelineTabContent)
import type { Building } from '../BuildingsPageContent';
// ENTERPRISE: Firestore persistence for building CRUD
import { getProjectsList, getBuildingCodesByProject } from '../building-services';
import { suggestNextBuildingCode } from '@/config/entity-code-config';
import { createModuleLogger } from '@/lib/telemetry';
// ENTERPRISE: Centralized EntityLinkCard (replaces ProjectSelectorCard)
import { FolderKanban } from 'lucide-react';
import { EntityLinkCard } from '@/components/shared/EntityLinkCard';
import type { EntityLinkOption } from '@/components/shared/EntityLinkCard';
import { NoProjectsEmptyState } from '@/components/shared/empty-states/NoProjectsEmptyState';
import { ProjectQuickCreateSheet } from '@/components/projects/dialogs/ProjectQuickCreateSheet';
import { useProjectQuickCreate } from './hooks/useProjectQuickCreate';
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
import { createBuildingWithPolicy, updateBuildingWithPolicy } from '@/services/building/building-mutation-gateway';
import { PolicyErrorBanner } from '@/components/shared/PolicyErrorBanner';
import '@/lib/design-system';

const logger = createModuleLogger('GeneralTabContent');

/** Extract initial form data from building (reused for reset on cancel) */
function buildFormData(building: Building) {
  return {
    // 🏢 ADR-233 §3.4: locked building identifier (e.g. "Κτήριο Α")
    code: building.code || '',
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
  // 🏢 ADR-284 §3.0.5: Recovery context — when the server returns an actionable
  // policy error code, we surface the matching inline recovery UI (e.g. link
  // orphan project → company) right next to the banner.
  const [saveErrorCode, setSaveErrorCode] = useState<string | null>(null);
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
      const result = await updateBuildingWithPolicy({
        buildingId: String(building.id),
        updates: { projectId: newId },
      });
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
      setSaveErrorCode(null);
      setErrors({});
    }
  }, [building, effectiveIsEditing]);

  // 🏢 ADR-233 §3.4: Auto-suggest next building `code` in create mode whenever
  // user picks/changes the parent project. Preview appears in the read-only
  // code field (BasicInfoCard) so the user sees what will be assigned.
  useEffect(() => {
    if (!isCreateMode) return;
    const projectId = projectLink.linkedId;
    if (!projectId || projectId.trim().length === 0) {
      setFormData((prev) => ({ ...prev, code: '' }));
      return;
    }

    let cancelled = false;
    getBuildingCodesByProject(projectId).then((existingCodes) => {
      if (cancelled) return;
      const next = suggestNextBuildingCode(existingCodes);
      setFormData((prev) => ({ ...prev, code: next }));
    });

    return () => {
      cancelled = true;
    };
  }, [isCreateMode, projectLink.linkedId]);

  // 🔐 ADR-284 §3.0.5: Clear projectId validation error when user selects a project
  useEffect(() => {
    if (projectLink.linkedId && projectLink.linkedId.trim().length > 0) {
      setErrors((prev) => {
        if (!prev.projectId) return prev;
        const { projectId: _dropped, ...rest } = prev;
        return rest;
      });
      setSaveError((prev) =>
        prev && prev === t('validation.projectRequired')
          ? null
          : prev,
      );
    }
  }, [projectLink.linkedId, t]);

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
      setSaveErrorCode(null);
      setErrors({});
    }
    didSaveRef.current = false;
  }, [effectiveIsEditing, building]);

  // 🏢 SPEC-256A: Optimistic versioning — wraps updateBuilding with _v tracking
  const versionedSaveFn = useCallback(async (data: ReturnType<typeof buildFormData> & { _v?: number }) => {
    const result = await updateBuildingWithPolicy({
      buildingId: String(building.id),
      updates: {
        name: data.name,
        description: data.description,
        startDate: data.startDate,
        completionDate: data.completionDate,
        address: data.address,
        city: data.city,
        _v: data._v,
      },
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
    // Validation: name always required; projectId required in create mode (ADR-284 §3.0.5)
    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) {
      newErrors.name = t('validation.nameRequired');
    }
    if (isCreateMode) {
      const projectPayloadForValidation = projectLink.getPayload();
      const projectIdValue = projectPayloadForValidation.projectId;
      if (typeof projectIdValue !== 'string' || projectIdValue.trim().length === 0) {
        newErrors.projectId = t('validation.projectRequired');
      }
    }
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      // Surface the first error as saveError banner (Google Docs draft pattern)
      const firstError =
        newErrors.projectId ?? newErrors.name ?? Object.values(newErrors)[0];
      setSaveError(firstError ?? null);
      setSaveErrorCode(null);
      return false;
    }

    try {
      setIsSaving(true);
      setSaveError(null);
      setSaveErrorCode(null);

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
        // ADR-233 §3.4 / ADR-290: prefer the reactively-suggested code already
        // shown in the UI (formData.code). Re-fetch only as a safety net — e.g.
        // if the user opened the form without selecting a project, then picks
        // one and immediately clicks Save before the preview effect resolves.
        let nextCode = formData.code?.trim() ?? '';
        if (!nextCode) {
          const projectIdForCode = String(projectPayload.projectId ?? '');
          const existingCodes = projectIdForCode
            ? await getBuildingCodesByProject(projectIdForCode)
            : [];
          nextCode = suggestNextBuildingCode(existingCodes);
        }
        logger.info('Creating new building in Firestore', { formData, projectId: projectPayload.projectId ?? null, code: nextCode });
        const result = await createBuildingWithPolicy({
          payload: {
            ...payload,
            code: nextCode,
            companyId: resolvedCompanyId,
            status: 'planning',
            // ADR-200: Include projectId from centralized hook
            ...projectPayload,
          },
        });

        if (!result.success || !result.buildingId) {
          // 🏢 ADR-284 §3.0.5: Store raw server message + errorCode — the
          // <PolicyErrorBanner> handles i18n translation AND renders any
          // matching inline recovery action (self-healing error pattern).
          setSaveError(result.error || 'Failed to create building');
          setSaveErrorCode(result.errorCode ?? null);
          return false;
        }

        logger.info('Building created successfully', { buildingId: result.buildingId });
        didSaveRef.current = true;
        setEffectiveEditing(false);
        onBuildingCreated?.(result.buildingId);
        return true;

      } else {
        logger.info('Updating building in Firestore', { buildingId: building.id });
        const result = await updateBuildingWithPolicy({
          buildingId: String(building.id),
          updates: payload,
        });

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
      setSaveErrorCode(null);
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

  // 🏢 SSoT: "No projects yet" empty state + slide-out create (mirror of
  // properties flow). After creating a new project, auto-select it on the
  // EntityLinkCard so the user can continue.
  const handleNewProjectSelected = useCallback(
    (newProjectId: string) => {
      projectLink.setLinkedId(newProjectId);
    },
    [projectLink],
  );
  const { projectsCount, fetchFailed, showSheet, setShowSheet, handleProjectCreated } =
    useProjectQuickCreate(handleNewProjectSelected);

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
      {/* 🏢 ADR-284 §3.0.5: Shared PolicyErrorBanner handles i18n + any
          registered inline recovery action (e.g. link orphan project →
          company) without domain-specific logic leaking into this tab. */}
      <PolicyErrorBanner
        errorCode={saveErrorCode}
        rawMessage={saveError}
        context={{ projectId: projectLink.linkedId ?? '' }}
        onRecovered={() => {
          setSaveError(null);
          setSaveErrorCode(null);
        }}
      />
      {/* 🏢 SSoT: "No projects yet" empty state — visible only in edit/create
          mode when the system has zero projects OR when the fetch failed
          (so the "Create Project" CTA is always reachable). */}
      {(projectsCount === 0 || fetchFailed) && effectiveIsEditing && (
        <NoProjectsEmptyState
          context="forBuilding"
          onCreateProject={() => setShowSheet(true)}
        />
      )}
      {/* ADR-200: Building → Project linking via centralized useEntityLink hook */}
      <EntityLinkCard key={projectLink.linkCardKey} {...projectLink.linkCardProps} />
      <ProjectQuickCreateSheet
        open={showSheet}
        onOpenChange={setShowSheet}
        onProjectCreated={handleProjectCreated}
      />
      <BasicInfoCard
        formData={formData}
        updateField={updateField}
        isEditing={effectiveIsEditing}
        errors={errors}
      />
    </section>
  );
}
