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
import { updateProject } from '@/services/projects.service';
import { createProject } from '@/services/projects-client.service';
import { RealtimeService } from '@/services/realtime';
import { createModuleLogger } from '@/lib/telemetry';
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
    issuingAuthority: '',
    issueDate: '',
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

  const { autoSaving, lastSaved, setDirty } = useAutosave(projectData, isEditing);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setProjectData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    setDirty();
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
      const result = await updateProject(project.id, {
        linkedCompanyId: newId ?? null,
        linkedCompanyName: undefined, // Will be resolved by cascade if needed
      });
      if (result.success) {
        setProjectData(prev => ({
          ...prev,
          companyId: prev.companyId, // Keep tenant companyId unchanged
        }));
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
        // 🏢 ENTERPRISE: Standard update flow (PATCH)
        logger.info('Updating project...', { data: projectData });

        const updatePayload: Parameters<typeof updateProject>[1] = {
          name: projectData.name,
          title: projectData.licenseTitle,
          status: projectData.status,
          description: projectData.description,
          companyId: projectData.companyId || undefined,
          company: projectData.companyName || undefined,
          client: projectData.client || undefined,
          location: projectData.location || undefined,
          type: projectData.type || undefined,
          priority: projectData.priority || undefined,
          riskLevel: projectData.riskLevel || undefined,
          complexity: projectData.complexity || undefined,
          budget: typeof projectData.budget === 'number' ? projectData.budget : undefined,
          totalValue: typeof projectData.totalValue === 'number' ? projectData.totalValue : undefined,
          totalArea: typeof projectData.totalArea === 'number' ? projectData.totalArea : undefined,
          duration: typeof projectData.duration === 'number' ? projectData.duration : undefined,
          startDate: projectData.startDate || undefined,
          completionDate: projectData.completionDate || undefined,
        };

        const result = await updateProject(project.id, updatePayload);

        if (!result.success) {
          throw new Error(result.error || 'Failed to save project');
        }

        logger.info('Project updated successfully');
        setIsEditing(false);

        RealtimeService.dispatch('PROJECT_UPDATED', {
          projectId: project.id,
          updates: {
            name: projectData.name,
            title: projectData.licenseTitle,
            status: projectData.status,
          },
          timestamp: Date.now()
        });
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

  return (
    <>
      <GeneralProjectHeader
        autoSaving={autoSaving}
        lastSaved={lastSaved}
        projectCode={project.projectCode}
        projectId={project.id}
        isSaving={isSaving}
        saveError={saveError}
        isEditing={isEditing}
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
