'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { useSpacingTokens } from '@/hooks/useSpacingTokens';

import { GeneralProjectHeader } from '../GeneralProjectHeader';
import { BasicProjectInfoTab } from '../BasicProjectInfoTab';
import { PermitsAndStatusTab } from '../PermitsAndStatusTab';

import { useAutosave } from './hooks/useAutosave';
import type { GeneralProjectTabProps, ProjectFormData } from './types';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { updateProjectClient, createProject } from '@/services/projects-client.service';
import { RealtimeService } from '@/services/realtime';
import { createModuleLogger } from '@/lib/telemetry';
// 🏢 SPEC-256A: Optimistic versioning — conflict detection
import { useVersionedSave } from '@/hooks/useVersionedSave';
import { ConflictDialog } from '@/components/shared/ConflictDialog';
import { useRouter } from 'next/navigation';
// 🏢 ENTERPRISE: Company linking via EntityLinkCard (ADR-200)
import { Building2 } from 'lucide-react';
import { EntityLinkCard } from '@/components/shared/EntityLinkCard';
import type { EntityLinkOption } from '@/components/shared/EntityLinkCard';
import { getAllCompaniesForSelect } from '@/services/companies.service';
import { useEntityLink } from '@/hooks/useEntityLink';
import { useCompanyId } from '@/hooks/useCompanyId';
const logger = createModuleLogger('GeneralProjectTab');

interface ExtendedGeneralProjectTabProps extends GeneralProjectTabProps {
  /** Lifted edit state from ProjectDetails header */
  isEditing?: boolean;
  /** Callback to update lifted edit state */
  onSetEditing?: (editing: boolean) => void;
  /** Register save callback with parent for header Save button */
  registerSaveCallback?: (saveFn: () => void) => void;
  /** 🏢 ENTERPRISE: "Fill then Create" — project not yet in Firestore */
  isCreateMode?: boolean;
  /** Callback after successful creation — receives real Firestore project ID */
  onProjectCreated?: (projectId: string) => void;
}

export function GeneralProjectTab({
  project,
  isEditing: externalIsEditing,
  onSetEditing,
  registerSaveCallback,
  isCreateMode,
  onProjectCreated,
}: ExtendedGeneralProjectTabProps) {
  const { t } = useTranslation('projects');
  const spacing = useSpacingTokens();
  // 🏢 ADR-201: Centralized companyId fallback (project → user)
  const fallbackCompanyId = useCompanyId()?.companyId ?? '';

  // Use lifted state if available, otherwise fallback to local state
  const [localIsEditing, setLocalIsEditing] = useState(false);
  const isEditing = externalIsEditing ?? localIsEditing;
  const setIsEditing = onSetEditing ?? setLocalIsEditing;

  const [projectData, setProjectData] = useState<ProjectFormData>({
    name: project.name,
    licenseTitle: project.title,
    description: project.description || '',
    buildingBlock: project.buildingBlock || '',
    protocolNumber: project.protocolNumber || '',
    licenseNumber: project.licenseNumber || '',
    issuingAuthority: project.issuingAuthority || '',
    issueDate: project.issueDate || '',
    status: project.status,
    companyName: project.companyName,
    companyId: project.companyId || fallbackCompanyId,
    type: project.type || '',
    priority: project.priority || '',
    riskLevel: project.riskLevel || '',
    complexity: project.complexity || '',
    budget: project.budget || '',
    totalValue: project.totalValue || '',
    totalArea: project.totalArea || '',
    duration: project.duration || '',
    startDate: project.startDate || '',
    completionDate: project.completionDate || '',
    client: project.client || '',
    location: project.location || '',
  });

  const router = useRouter();

  // 🏢 SPEC-256A: Versioned save function (sends _v to API, returns new _v)
  const versionedSaveFn = useCallback(async (data: ProjectFormData & { _v?: number }) => {
    const result = await updateProjectClient(project.id, {
      name: data.name,
      title: data.licenseTitle,
      status: data.status,
      description: data.description,
      buildingBlock: data.buildingBlock || undefined,
      protocolNumber: data.protocolNumber || undefined,
      licenseNumber: data.licenseNumber || undefined,
      issuingAuthority: data.issuingAuthority || undefined,
      issueDate: data.issueDate || undefined,
      client: data.client || undefined,
      location: data.location || undefined,
      type: data.type || undefined,
      priority: data.priority || undefined,
      riskLevel: data.riskLevel || undefined,
      complexity: data.complexity || undefined,
      budget: typeof data.budget === 'number' ? data.budget : undefined,
      totalValue: typeof data.totalValue === 'number' ? data.totalValue : undefined,
      totalArea: typeof data.totalArea === 'number' ? data.totalArea : undefined,
      duration: typeof data.duration === 'number' ? data.duration : undefined,
      startDate: data.startDate || undefined,
      completionDate: data.completionDate || undefined,
      _v: data._v,
    });
    return result;
  }, [project.id]);

  const versioned = useVersionedSave<ProjectFormData>({
    initialVersion: (project._v as number | undefined),
    saveFn: versionedSaveFn,
    onConflict: (body) => {
      logger.warn('Version conflict detected', { projectId: project.id, conflict: body });
    },
  });

  // 🏢 ADR-248: Centralized auto-save with versioned persistence
  const autoSaveFn = useCallback(async (data: ProjectFormData) => {
    if (isCreateMode) return;
    await versioned.save(data);
  }, [isCreateMode, versioned]);

  const { autoSaving, lastSaved, status: autoSaveStatus, error: autoSaveError, retry: autoSaveRetry } = useAutosave(
    projectData,
    isEditing && !isCreateMode && !versioned.isConflicted,
    { saveFn: autoSaveFn }
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setProjectData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  useEffect(() => {
    setProjectData(prev => ({
      ...prev,
      name: project.name,
      licenseTitle: project.title,
      status: project.status,
      companyName: project.companyName,
      companyId: project.companyId || fallbackCompanyId,
      description: project.description || prev.description,
      type: project.type || '',
      priority: project.priority || '',
      riskLevel: project.riskLevel || '',
      complexity: project.complexity || '',
      budget: project.budget || '',
      totalValue: project.totalValue || '',
      totalArea: project.totalArea || '',
      duration: project.duration || '',
      startDate: project.startDate || '',
      completionDate: project.completionDate || '',
      client: project.client || '',
      location: project.location || '',
    }));
  }, [project]);

  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // =========================================================================
  // ADR-200: Centralized entity linking — Company
  // (must be declared before handleSave which references companyLink)
  // =========================================================================

  const loadCompanies = useCallback(async (): Promise<EntityLinkOption[]> => {
    const companies = await getAllCompaniesForSelect();
    return companies
      .filter(c => c.id)
      .map(c => ({ id: c.id!, name: c.companyName || '' }));
  }, []);

  const saveCompanyLink = useCallback(async (newId: string | null) => {
    try {
      // 🏢 ADR-232: Save to linkedCompanyId (NOT companyId — that's tenant isolation)
      const result = await updateProjectClient(project.id, {
        linkedCompanyId: newId ?? null,
      });
      if (result.success) {
        // NOTE: Do NOT setProjectData here — it triggers auto-save which
        // overwrites other fields (e.g., description) with stale form state
        RealtimeService.dispatch('PROJECT_UPDATED', {
          projectId: project.id,
          updates: { linkedCompanyId: newId ?? undefined },
          timestamp: Date.now(),
        });
        return { success: true };
      }
      return { success: false, error: result.error || 'Failed to update' };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to update' };
    }
  }, [project.id]);

  const companyLink = useEntityLink({
    relation: 'project-company',
    entityId: project.id,
    initialParentId: project.linkedCompanyId || null,
    loadOptions: loadCompanies,
    saveMode: isCreateMode ? 'local' : 'immediate',
    onSave: isCreateMode ? undefined : saveCompanyLink,
    hideCurrentLabel: true,
    icon: Building2,
    cardId: 'project-company-link',
    labels: {
      title: t('basicInfo.companyLink.title'),
      label: t('basicInfo.companyLink.label'),
      placeholder: t('basicInfo.companyLink.placeholder'),
      noSelection: t('basicInfo.companyLink.noSelection'),
      loading: t('basicInfo.companyLink.loading'),
      save: t('basicInfo.companyLink.save'),
      saving: t('basicInfo.companyLink.saving'),
      success: t('basicInfo.companyLink.success'),
      error: t('basicInfo.companyLink.error'),
      currentLabel: t('basicInfo.companyLink.currentLabel'),
    },
  }, isEditing);

  const handleSave = useCallback(async () => {
    try {
      setIsSaving(true);
      setSaveError(null);

      if (isCreateMode) {
        // ADR-232: linkedCompanyId from entity link hook, companyId from auth context
        const companyPayload = companyLink.getPayload();
        const effectiveLinkedCompanyId = companyPayload.linkedCompanyId ?? null;
        logger.info('Creating new project...', { data: projectData, linkedCompanyId: effectiveLinkedCompanyId });

        const result = await createProject({
          name: projectData.name || 'Νέο Έργο',
          title: projectData.licenseTitle,
          description: projectData.description,
          status: projectData.status || 'planning',
          companyId: fallbackCompanyId, // Tenant isolation — always from auth
          linkedCompanyId: effectiveLinkedCompanyId, // Business link — from user selection
        });

        if (!result.success || !result.projectId) {
          throw new Error(result.error || 'Failed to create project');
        }

        logger.info('Project created successfully', { projectId: result.projectId });
        setIsEditing(false);
        onProjectCreated?.(result.projectId);

      } else {
        // 🏢 ENTERPRISE: Standard update flow via versioned save
        logger.info('Updating project...', { data: projectData });
        // SPEC-256A: Use versioned.save for conflict detection on manual save too
        await versioned.save(projectData);

        logger.info('Project updated successfully');
        setIsEditing(false);
      }

    } catch (error) {
      logger.error('Error saving project:', { error: error });
      setSaveError(error instanceof Error ? error.message : 'Failed to save project');
    } finally {
      setIsSaving(false);
    }
  }, [projectData, project.id, project.companyId, setIsEditing, isCreateMode, onProjectCreated, companyLink]);

  // Register save callback with parent so header Save button works
  useEffect(() => {
    if (registerSaveCallback) {
      registerSaveCallback(handleSave);
    }
  }, [registerSaveCallback, handleSave]);

  // 🏢 SPEC-256A: ConflictDialog handlers
  const handleConflictReload = useCallback(() => {
    router.refresh();
  }, [router]);

  const handleConflictForceSave = useCallback(async () => {
    await versioned.forceSave(projectData);
  }, [versioned, projectData]);

  const handleConflictClose = useCallback(() => {
    versioned.resetConflict();
  }, [versioned]);

  return (
    <>
      {/* 🏢 SPEC-256A: Version conflict dialog */}
      <ConflictDialog
        open={versioned.isConflicted}
        conflict={versioned.conflictData}
        onReload={handleConflictReload}
        onForceSave={handleConflictForceSave}
        onClose={handleConflictClose}
      />
      <GeneralProjectHeader
        autoSaving={autoSaving}
        lastSaved={lastSaved}
        projectCode={project.projectCode}
        projectId={project.id}
        isSaving={isSaving}
        saveError={saveError}
        isEditing={isEditing}
        autoSaveStatus={autoSaveStatus}
        autoSaveError={autoSaveError}
        onAutoSaveRetry={autoSaveRetry}
      />

      <section className={cn(spacing.spaceBetween.md, spacing.margin.top.md)}>
        {/* ADR-200: Company linking via centralized useEntityLink hook */}
        <EntityLinkCard key={companyLink.linkCardKey} {...companyLink.linkCardProps} />

        <BasicProjectInfoTab
          data={projectData}
          setData={setProjectData}
          isEditing={isEditing}
          projectId={project.id}
        />

        <PermitsAndStatusTab
          data={projectData}
          setData={setProjectData}
          isEditing={isEditing}
        />

      </section>
    </>
  );
}
