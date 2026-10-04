'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { useSpacingTokens } from '@/hooks/useSpacingTokens';

import { GeneralProjectHeader } from '../GeneralProjectHeader';
import { BasicProjectInfoTab } from '../BasicProjectInfoTab';
import { PermitsTab } from '../PermitsTab';

import { useAutosave } from './hooks/useAutosave';
import type { GeneralProjectTabProps, ProjectFormData } from './types';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { ProjectUpdatePayload } from '@/services/projects-client.service';
import { createModuleLogger } from '@/lib/telemetry';
import { useVersionedSave } from '@/hooks/useVersionedSave';
import { NAVIGATION_ENTITIES } from '@/components/navigation/config';
import { EntityLinkCard } from '@/components/shared/EntityLinkCard';
import type { EntityLinkOption } from '@/components/shared/EntityLinkCard';
import { getAllCompaniesForSelect } from '@/services/companies.service';
import { useEntityLink } from '@/hooks/useEntityLink';
import { useCompanyId } from '@/hooks/useCompanyId';
import { useGuardedProjectMutation } from '@/hooks/useGuardedProjectMutation';
import { outcomeOrThrow } from '@/hooks/impact-guard/guard-result';
import { useProjectCreate } from '@/hooks/useProjectCreate';
import { updateProjectWithPolicy } from '@/services/projects/project-mutation-gateway';
import { PolicyErrorBanner } from '@/components/shared/PolicyErrorBanner';
import type { ProjectDraftAddresses } from '@/components/projects/draft/useProjectDraftAddresses';
import { createdProjectFields, type CreatedProjectFields } from './created-project';
import '@/lib/design-system';

const logger = createModuleLogger('GeneralProjectTab');

interface ExtendedGeneralProjectTabProps extends GeneralProjectTabProps {
  isEditing?: boolean;
  onSetEditing?: (editing: boolean) => void;
  registerSaveCallback?: (saveFn: () => void) => void;
  isCreateMode?: boolean;
  onProjectCreated?: (projectId: string, created?: CreatedProjectFields) => void;
  /**
   * 🏢 ADR-256 read-path: injected by `project-details.tsx` via `useProjectDetail`.
   * Called after a successful save so the hydrated Firestore document becomes
   * the post-save source of truth (covers server-computed fields like
   * normalized timestamps and any field the API layer mutates on write).
   */
  refetchProject?: () => Promise<void>;
  /** «Fill then Create» — οι διευθύνσεις του πρόχειρου, που φεύγουν μαζί με τη δημιουργία. */
  draftAddresses?: ProjectDraftAddresses;
}

function normalizeGuardValue(value: string | number | null | undefined): string {
  if (typeof value === 'number') return String(value);
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * **Οι τιμές της φόρμας από το έργο** — ΜΙΑ αντιστοίχιση για την αρχική κατάσταση ΚΑΙ τον συγχρονισμό
 * (N.18 / CHECK 3.28: ήταν γραμμένη δύο φορές, με ήδη αποκλίνουσα γραφή στο `description`).
 */
function projectFormValuesFrom(
  project: ExtendedGeneralProjectTabProps['project'],
  fallbackCompanyId: string,
): ProjectFormData {
  return {
    name: project.name,
    licenseTitle: project.title,
    description: project.description || '',
    buildingBlock: project.buildingBlock || '',
    protocolNumber: project.protocolNumber || '',
    licenseNumber: project.licenseNumber || '',
    issuingAuthority: project.issuingAuthority || '',
    issueDate: project.issueDate || '',
    // 🏢 Google-level create mode: no silent default. An empty status forces
    // the user to make an explicit choice, enforced by pre-flight validation
    // in `handleSave`. In edit mode, the existing `project.status` flows
    // through unchanged via the sync effect.
    status: project.status ?? '',
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
  };
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
  draftAddresses,
}: ExtendedGeneralProjectTabProps) {
  const { t } = useTranslation(['projects', 'projects-data', 'projects-ika']);
  const { createProject } = useProjectCreate();
  const spacing = useSpacingTokens();
  const fallbackCompanyId = useCompanyId()?.companyId ?? '';

  const [localIsEditing, setLocalIsEditing] = useState(false);
  const isEditing = externalIsEditing ?? localIsEditing;
  const setIsEditing = onSetEditing ?? setLocalIsEditing;

  const [projectData, setProjectData] = useState<ProjectFormData>(
    () => projectFormValuesFrom(project, fallbackCompanyId),
  );

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
      // Empty status only exists during the create-mode pre-flight — edit-path
      // saves never see `''` because the form is seeded from a real document.
      // Map to `undefined` so the API layer treats it as "unchanged".
      status: data.status || undefined,
      description: data.description,
      buildingBlock: data.buildingBlock,
      protocolNumber: data.protocolNumber,
      licenseNumber: data.licenseNumber,
      issuingAuthority: data.issuingAuthority,
      issueDate: data.issueDate,
      client: data.client,
      location: data.location,
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
    isEditing && !isCreateMode && !hasPendingImpactReview,
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
    // 🏢 ADR-256 v3: never reset form state from props while the user is
    // editing. Even with `useProjectDetail({ pauseRefetch: isEditing })`,
    // the summary coming from `useProjectsState` can still mutate mid-edit
    // (list-side PROJECT_UPDATED merges), and any such mutation would race
    // the user's keystrokes and clobber them. The form state is authoritative
    // during an edit session; sync only happens on entry/exit of editing or
    // on entity swap.
    //
    // 🏢 ADR-300 §Addendum: in create mode the `ProjectStatusPill` (rendered
    // in the header, outside this tab) streams status updates by mutating
    // `selectedProject` at the page level. That produces a new `project`
    // reference on every pill click — if we re-ran the full form sync we
    // would clobber every keystroke the user has typed into the other
    // fields. The create-mode branch therefore narrows the sync to `status`
    // only; all other fields are owned by local state and are already
    // seeded from the draft project at mount time (see `useState` above).
    if (isCreateMode) {
      setProjectData(prev => ({ ...prev, status: project.status ?? '' }));
      return;
    }
    if (isEditing) return;
    setProjectData(prev => ({ ...prev, ...projectFormValuesFrom(project, fallbackCompanyId) }));
  }, [fallbackCompanyId, project, isEditing, isCreateMode]);

  const handleSave = useCallback(async () => {
    try {
      setIsSaving(true);
      setSaveError(null);
      setSaveErrorCode(null);

      if (isCreateMode) {
        const companyPayload = companyLink.getPayload();
        const effectiveLinkedCompanyId = companyPayload.linkedCompanyId ?? null;

        // 🏢 Google-level create mode pre-flight validation. Every check
        // returns early with a user-visible error — we never silently fall
        // back to a placeholder value (previous `name || 'Νέο Έργο'` and
        // `status || 'planning'` defaults have been removed).

        const trimmedName = projectData.name.trim();
        if (!trimmedName) {
          setSaveError(t('createValidation.nameRequired'));
          setSaveErrorCode('VALIDATION_NAME_REQUIRED');
          return;
        }

        if (!projectData.status) {
          setSaveError(t('createValidation.statusRequired'));
          setSaveErrorCode('VALIDATION_STATUS_REQUIRED');
          return;
        }

        // 🏢 ADR-284 §3.0: Pre-flight company policy check — avoids API round-trip
        // and surfaces the same PolicyErrorBanner + recovery action immediately.
        if (!effectiveLinkedCompanyId) {
          setSaveError(t('createValidation.companyRequired'));
          setSaveErrorCode('POLICY_COMPANY_REQUIRED');
          return;
        }

        logger.info('Creating new project...', { data: projectData, linkedCompanyId: effectiveLinkedCompanyId });

        // 🏢 Google-level: the create payload is the same superset as the
        // edit payload so every field the user filled in on `GeneralProjectTab`
        // (permits card, classification, timeline, financials, description,
        // license title, …) reaches the server on the first save. Previously
        // this branch only forwarded 6 fields and silently dropped the rest,
        // leaving both the "Άδειες" container and the audit trail incomplete.
        const updatePayload = buildUpdatePayload(projectData);
        // 🏢 «Fill then Create»: ό,τι δήλωσε ο άνθρωπος στην καρτέλα «Διευθύνσεις» φεύγει ΜΑΖΙ με
        // τη δημιουργία, σε μία πράξη. Κενό πρόχειρο ⇒ το πεδίο λείπει (το σχήμα θέλει μία κύρια).
        const draftAddressList = draftAddresses?.get() ?? [];
        const result = await createProject({
          ...updatePayload,
          name: trimmedName,
          status: projectData.status,
          companyId: fallbackCompanyId,
          linkedCompanyId: effectiveLinkedCompanyId,
          ...(draftAddressList.length > 0 ? { addresses: draftAddressList } : {}),
        });

        if (!result.success) {
          // 🏢 ADR-284: surface raw server message + errorCode for <PolicyErrorBanner>
          setSaveError(result.error);
          setSaveErrorCode(result.errorCode ?? null);
          return;
        }

        logger.info('Project created successfully', { projectId: result.projectId });
        // Το πρόχειρο περνά στην πραγματική ταυτότητα με ό,τι ΕΓΡΑΨΕ ο διακομιστής (θέση λυμένη) —
        // ΠΡΙΝ ανακοινωθεί η δημιουργία, ώστε η «Διευθύνσεις» να το βρει όταν αλλάξει η ταυτότητα.
        draftAddresses?.commit(result.projectId, result.addresses ?? draftAddressList);
        setIsEditing(false);
        // Η φόρμα παραδίδει ό,τι ξέρει — και το ΟΝΟΜΑ της εταιρείας, από τις επιλογές του πεδίου:
        // η σελίδα δεν μένει με το άδειο πρόχειρο ως την ενυδάτωση (breadcrumb με ωμό `cont_…`).
        onProjectCreated?.(result.projectId, createdProjectFields(projectData, {
          id: effectiveLinkedCompanyId,
          name: companyLink.options.find((option) => option.id === effectiveLinkedCompanyId)?.name ?? '',
        }));
        return;
      }

      const payload = buildUpdatePayload(projectData);
      // ADR-777 §8.69.13 — `failed` (και μετά από `warn`, όπου χανόταν) ⇒ στο catch ⇒ `saveError`.
      outcomeOrThrow(await runExistingProjectUpdate(payload, async () => {
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
      }));
    } catch (error) {
      logger.error('Error saving project:', { error });
      setSaveError(error instanceof Error ? error.message : t('createValidation.saveFailed'));
      setSaveErrorCode(null);
    } finally {
      setIsSaving(false);
    }
  }, [
    buildUpdatePayload,
    companyLink,
    createProject,
    draftAddresses,
    fallbackCompanyId,
    isCreateMode,
    onProjectCreated,
    project.id,
    projectData,
    refetchProject,
    runExistingProjectUpdate,
    setIsEditing,
    t,
    versioned,
  ]);

  useEffect(() => {
    if (registerSaveCallback) {
      registerSaveCallback(handleSave);
    }
  }, [registerSaveCallback, handleSave]);

  return (
    <>
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
        // ADR-284: η ανάκαμψη «δημιούργησε εταιρεία» ισχύει ΜΟΝΟ σε άδεια λίστα — το πλήθος το
        // ξέρει το πεδίο. Όσο φορτώνει, δεν δηλώνεται: «κενή ακόμη» δεν είναι «δεν υπάρχουν».
        context={companyLink.optionsLoading ? undefined : { existingCompanyCount: companyLink.options.length }}
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

        <PermitsTab
          data={projectData}
          setData={setProjectData}
          isEditing={isEditing}
        />
      </section>
    </>
  );
}
