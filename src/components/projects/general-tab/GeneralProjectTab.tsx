'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { useSpacingTokens } from '@/hooks/useSpacingTokens';

import { GeneralProjectHeader } from '../GeneralProjectHeader';
import { BasicProjectInfoTab } from '../BasicProjectInfoTab';
import { PermitsAndStatusTab } from '../PermitsAndStatusTab';

import { useAutosave } from './hooks/useAutosave';
import type { GeneralProjectTabProps, ProjectFormData } from './types';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { ProjectUpdatePayload } from '@/services/projects-client.service';
import { createModuleLogger } from '@/lib/telemetry';
import { useVersionedSave } from '@/hooks/useVersionedSave';
import { ConflictDialog } from '@/components/shared/ConflictDialog';
import { useRouter } from 'next/navigation';
import { NAVIGATION_ENTITIES } from '@/components/navigation/config';
import { EntityLinkCard } from '@/components/shared/EntityLinkCard';
import type { EntityLinkOption } from '@/components/shared/EntityLinkCard';
import { getAllCompaniesForSelect } from '@/services/companies.service';
import { useEntityLink } from '@/hooks/useEntityLink';
import { useCompanyId } from '@/hooks/useCompanyId';
import { useGuardedProjectMutation } from '@/hooks/useGuardedProjectMutation';
import { createProjectWithPolicy, updateProjectWithPolicy } from '@/services/projects/project-mutation-gateway';
import { PolicyErrorBanner } from '@/components/shared/PolicyErrorBanner';
import '@/lib/design-system';

const logger = createModuleLogger('GeneralProjectTab');

interface ExtendedGeneralProjectTabProps extends GeneralProjectTabProps {
  isEditing?: boolean;
  onSetEditing?: (editing: boolean) => void;
  registerSaveCallback?: (saveFn: () => void) => void;
  isCreateMode?: boolean;
  onProjectCreated?: (projectId: string) => void;
  /**
   * 🏢 ADR-256 read-path: injected by `project-details.tsx` via `useProjectDetail`.
   * Called after a successful save so the hydrated Firestore document becomes
   * the post-save source of truth (covers server-computed fields like
   * normalized timestamps and any field the API layer mutates on write).
   */
  refetchProject?: () => Promise<void>;
}

function normalizeGuardValue(value: string | number | null | undefined): string {
  if (typeof value === 'number') return String(value);
  return typeof value === 'string' ? value.trim() : '';
}

function hasImpactTrackedChanges(
  project: ExtendedGeneralProjectTabProps['project'],
  projectData: ProjectFormData,
  linkedCompanyId: string | null,
): boolean {
  return (
    normalizeGuardValue(project.name) !== normalizeGuardValue(projectData.name) ||
    normalizeGuardValue(project.title) !== normalizeGuardValue(projectData.licenseTitle) ||
    normalizeGuardValue(project.description) !== normalizeGuardValue(projectData.description) ||
    normalizeGuardValue(project.buildingBlock) !== normalizeGuardValue(projectData.buildingBlock) ||
    normalizeGuardValue(project.protocolNumber) !== normalizeGuardValue(projectData.protocolNumber) ||
    normalizeGuardValue(project.licenseNumber) !== normalizeGuardValue(projectData.licenseNumber) ||
    normalizeGuardValue(project.issuingAuthority) !== normalizeGuardValue(projectData.issuingAuthority) ||
    normalizeGuardValue(project.issueDate) !== normalizeGuardValue(projectData.issueDate) ||
    normalizeGuardValue(project.status) !== normalizeGuardValue(projectData.status) ||
    normalizeGuardValue(project.linkedCompanyId) !== normalizeGuardValue(linkedCompanyId)
  );
}

export function GeneralProjectTab({
  project,
  isEditing: externalIsEditing,
  onSetEditing,
  registerSaveCallback,
  isCreateMode,
  onProjectCreated,
  refetchProject,
}: ExtendedGeneralProjectTabProps) {
  const { t } = useTranslation('projects');
  const spacing = useSpacingTokens();
  const fallbackCompanyId = useCompanyId()?.companyId ?? '';

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
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  // 🏢 ADR-284 §3.0: track policy error code for the shared <PolicyErrorBanner>
  const [saveErrorCode, setSaveErrorCode] = useState<string | null>(null);
  const { ImpactDialog, runExistingProjectUpdate } = useGuardedProjectMutation(project.id, {
    onBlockDismiss: () => {
      companyLink.reset();
    },
  });

  const loadCompanies = useCallback(async (): Promise<EntityLinkOption[]> => {
    const companies = await getAllCompaniesForSelect();
    return companies
      .filter(c => c.id)
      .map(c => ({ id: c.id!, name: c.companyName || '' }));
  }, []);

  const companyLink = useEntityLink({
    relation: 'project-company',
    entityId: project.id,
    initialParentId: project.linkedCompanyId || null,
    loadOptions: loadCompanies,
    saveMode: isCreateMode ? 'local' : 'form',
    hideCurrentLabel: true,
    icon: NAVIGATION_ENTITIES.company.icon,
    iconColor: NAVIGATION_ENTITIES.company.color,
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

  const buildUpdatePayload = useCallback((data: ProjectFormData, version?: number): ProjectUpdatePayload => {
    const companyPayload = companyLink.getPayload();
    return {
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
      linkedCompanyId: Object.prototype.hasOwnProperty.call(companyPayload, 'linkedCompanyId')
        ? companyPayload.linkedCompanyId
        : undefined,
      _v: version,
    };
  }, [companyLink]);

  const versionedSaveFn = useCallback(async (data: ProjectFormData & { _v?: number }) => {
    return updateProjectWithPolicy({
      projectId: project.id,
      updates: buildUpdatePayload(data, data._v),
    });
  }, [buildUpdatePayload, project.id]);

  const versioned = useVersionedSave<ProjectFormData>({
    initialVersion: (project as unknown as { _v?: number })._v,
    entityId: project.id,
    saveFn: versionedSaveFn,
    onConflict: (body) => {
      logger.warn('Version conflict detected', { projectId: project.id, conflict: body });
    },
  });

  const hasPendingImpactReview = useMemo(() => (
    hasImpactTrackedChanges(project, projectData, companyLink.linkedId)
  ), [companyLink.linkedId, project, projectData]);

  const autoSaveFn = useCallback(async (data: ProjectFormData) => {
    if (isCreateMode || hasPendingImpactReview) return;
    await versioned.save(data);
  }, [hasPendingImpactReview, isCreateMode, versioned]);

  const { autoSaving, lastSaved, status: autoSaveStatus, error: autoSaveError, retry: autoSaveRetry } = useAutosave(
    projectData,
    isEditing && !isCreateMode && !versioned.isConflicted && !hasPendingImpactReview,
    { saveFn: autoSaveFn }
  );

  // 🏢 ADR-284 §3.0: Clear the company-required policy error as soon as the
  // user links a company — no stale banner sticking around after the fix.
  useEffect(() => {
    if (saveErrorCode === 'POLICY_COMPANY_REQUIRED' && companyLink.linkedId) {
      setSaveError(null);
      setSaveErrorCode(null);
    }
  }, [companyLink.linkedId, saveErrorCode]);

  useEffect(() => {
    setProjectData(prev => ({
      ...prev,
      name: project.name,
      licenseTitle: project.title,
      status: project.status,
      companyName: project.companyName,
      companyId: project.companyId || fallbackCompanyId,
      // 🏢 ADR-256 read-path: use nullish coalescing (NOT `|| prev`). With
      // hydrate-on-select, cross-project leakage via `prev.description`
      // would show the previous project's text in a freshly-opened one
      // (especially visible in the "New project" dialog). Mid-edit typing
      // is protected by `useProjectDetail({ pauseRefetch: isEditing })` —
      // the project ref does not change while the user is editing, so this
      // effect does not run and cannot clobber unsaved input.
      description: project.description ?? '',
      buildingBlock: project.buildingBlock || '',
      protocolNumber: project.protocolNumber || '',
      licenseNumber: project.licenseNumber || '',
      issuingAuthority: project.issuingAuthority || '',
      issueDate: project.issueDate || '',
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
  }, [fallbackCompanyId, project]);

  const handleSave = useCallback(async () => {
    try {
      setIsSaving(true);
      setSaveError(null);
      setSaveErrorCode(null);

      if (isCreateMode) {
        const companyPayload = companyLink.getPayload();
        const effectiveLinkedCompanyId = companyPayload.linkedCompanyId ?? null;

        // 🏢 ADR-284 §3.0: Pre-flight company policy check — avoids API round-trip
        // and surfaces the same PolicyErrorBanner + recovery action immediately.
        if (!effectiveLinkedCompanyId) {
          setSaveError('Company (linkedCompanyId) is required — every project must belong to a company.');
          setSaveErrorCode('POLICY_COMPANY_REQUIRED');
          return;
        }

        logger.info('Creating new project...', { data: projectData, linkedCompanyId: effectiveLinkedCompanyId });

        const result = await createProjectWithPolicy({
          payload: {
          name: projectData.name || 'Νέο Έργο',
          title: projectData.licenseTitle,
          description: projectData.description,
          status: projectData.status || 'planning',
          companyId: fallbackCompanyId,
            linkedCompanyId: effectiveLinkedCompanyId,
          },
        });

        if (!result.success || !result.projectId) {
          // 🏢 ADR-284: surface raw server message + errorCode for <PolicyErrorBanner>
          setSaveError(result.error || 'Failed to create project');
          setSaveErrorCode(result.errorCode ?? null);
          return;
        }

        logger.info('Project created successfully', { projectId: result.projectId });
        setIsEditing(false);
        onProjectCreated?.(result.projectId);
        return;
      }

      const payload = buildUpdatePayload(projectData);
      await runExistingProjectUpdate(payload, async () => {
        setIsSaving(true);
        try {
          logger.info('Updating project...', { data: projectData, payload });
          await versioned.save(projectData);
          logger.info('Project updated successfully');
          setIsEditing(false);
          // 🏢 ADR-256 read-path: pull the canonical post-save Firestore doc
          // so server-computed fields (timestamps, normalized values) become
          // the source of truth. Non-blocking — the optimistic local state
          // keeps the form stable during the round-trip.
          void refetchProject?.();
        } finally {
          setIsSaving(false);
        }
      });
    } catch (error) {
      logger.error('Error saving project:', { error });
      setSaveError(error instanceof Error ? error.message : 'Failed to save project');
      setSaveErrorCode(null);
    } finally {
      setIsSaving(false);
    }
  }, [
    buildUpdatePayload,
    companyLink,
    fallbackCompanyId,
    isCreateMode,
    onProjectCreated,
    project.id,
    projectData,
    refetchProject,
    runExistingProjectUpdate,
    setIsEditing,
    versioned,
  ]);

  useEffect(() => {
    if (registerSaveCallback) {
      registerSaveCallback(handleSave);
    }
  }, [registerSaveCallback, handleSave]);

  const handleConflictReload = useCallback(() => {
    router.refresh();
  }, [router]);

  const handleConflictForceSave = useCallback(async () => {
    await versioned.forceSave(projectData);
  }, [projectData, versioned]);

  const handleConflictClose = useCallback(() => {
    versioned.resetConflict();
  }, [versioned]);

  return (
    <>
      <ConflictDialog
        open={versioned.isConflicted}
        conflict={versioned.conflictData}
        onReload={handleConflictReload}
        onForceSave={handleConflictForceSave}
        onClose={handleConflictClose}
      />

      {ImpactDialog}

      <GeneralProjectHeader
        autoSaving={autoSaving}
        lastSaved={lastSaved}
        projectCode={project.projectCode}
        projectId={project.id}
        isSaving={isSaving}
        isEditing={isEditing}
        autoSaveStatus={autoSaveStatus}
        autoSaveError={autoSaveError}
        onAutoSaveRetry={autoSaveRetry}
      />

      {/* 🏢 ADR-284: Shared policy banner — auto i18n + auto recovery action.
          If the recovery produced a new companyId (e.g. user created one on
          the fly), auto-wire it into the EntityLinkCard so the user doesn't
          have to pick it manually. */}
      <PolicyErrorBanner
        errorCode={saveErrorCode}
        rawMessage={saveError}
        onRecovered={(payload) => {
          const newCompanyId = typeof payload?.companyId === 'string' ? payload.companyId : null;
          if (newCompanyId) {
            companyLink.setLinkedId(newCompanyId);
          }
          setSaveError(null);
          setSaveErrorCode(null);
        }}
      />

      <section className={cn(spacing.spaceBetween.md, spacing.margin.top.md)}>
        {/* 🏢 ADR-291 Scenario 6b: hasError links the top-level PolicyErrorBanner
            with the exact field — red border + auto-scroll-into-view. User sees
            WHAT is wrong (banner) AND WHERE to fix it (inline). */}
        <EntityLinkCard
          key={companyLink.linkCardKey}
          {...companyLink.linkCardProps}
          hasError={saveErrorCode === 'POLICY_COMPANY_REQUIRED'}
        />

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
