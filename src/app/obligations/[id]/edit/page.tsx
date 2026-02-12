"use client";

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { PageLayout } from '@/components/app/page-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getSpacingClass } from '@/lib/design-system';
import type { ObligationDocument, ObligationStatus } from '@/types/obligations';
import { generateTableOfContents } from '@/types/obligations';
import { useObligation } from '@/hooks/useObligations';
import { obligationsService } from '@/services/obligations.service';
import StructureEditor from '@/components/obligations/structure-editor';
import LivePreview from '@/components/obligations/live-preview';
import {
  MetadataPanel,
  type AssigneeOption,
  type MilestoneOption,
  type ObligationMetadataState,
  type PhaseOption,
  WorkflowBar,
} from '@/components/obligations/workspace';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { ContactsService } from '@/services/contacts.service';
import { getConstructionData } from '@/components/building-management/construction-services';
import type { ConstructionPhase, ConstructionTask } from '@/types/building/construction';
import { getContactDisplayName, type Contact } from '@/types/contacts';
import { createModuleLogger } from '@/lib/telemetry';
import { apiClient } from '@/lib/api/enterprise-api-client';

const logger = createModuleLogger('EditObligationPage');

const toAssigneeOption = (contact: Contact): AssigneeOption | null => {
  const displayName = getContactDisplayName(contact).trim();
  const fallbackId = displayName ? 'fallback-assignee-' + displayName.toLowerCase().split(' ').join('-') : '';
  const id = contact.id || fallbackId;

  if (!id || !displayName) {
    return null;
  }

  return {
    id,
    name: displayName,
  };
};

const toPhaseOption = (phase: ConstructionPhase): PhaseOption => ({
  id: phase.id,
  name: `${phase.code} - ${phase.name}`,
});

const toMilestoneOption = (task: ConstructionTask): MilestoneOption => ({
  id: String(task.id).trim(),
  phaseId: String(task.phaseId).trim(),
  name: `${task.code} - ${task.name}`,
});

const buildMetadataState = (obligation: ObligationDocument): ObligationMetadataState => ({
  docNumber: obligation.docNumber || '',
  revision: obligation.revision || 1,
  revisionNotes: obligation.revisionNotes || '',
  dueDate: obligation.dueDate ? obligation.dueDate.toISOString().slice(0, 10) : '',
  assigneeId: obligation.assigneeId || '',
  assigneeName: obligation.assigneeName || '',
  phaseBinding: obligation.phaseBinding || {
    phaseId: '',
    phaseName: '',
    milestoneId: '',
    acceptanceCriteria: '',
  },
  costBinding: obligation.costBinding || {
    costCode: '',
    costLineName: '',
    boqItemCode: '',
    budgetAmount: 0,
  },
});

export default function EditObligationPage() {
  const { t, isNamespaceReady } = useTranslation('obligations');
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const obligationId = typeof params.id === 'string' ? params.id : '';

  const { obligation, loading, error } = useObligation(obligationId);

  const [draft, setDraft] = useState<ObligationDocument | null>(null);
  const [metadata, setMetadata] = useState<ObligationMetadataState | null>(null);
  const [saving, setSaving] = useState(false);
  const [assigneeOptions, setAssigneeOptions] = useState<AssigneeOption[]>([]);
  const [phaseOptions, setPhaseOptions] = useState<PhaseOption[]>([]);
  const [milestoneOptions, setMilestoneOptions] = useState<MilestoneOption[]>([]);
  const [loadingAssignees, setLoadingAssignees] = useState(false);
  const [loadingConstructionData, setLoadingConstructionData] = useState(false);

  useEffect(() => {
    if (obligation) {
      setDraft(obligation);
      setMetadata(buildMetadataState(obligation));
    }
  }, [obligation]);

  useEffect(() => {
    const loadAssignees = async (attempt: number = 0) => {
      setLoadingAssignees(true);
      try {
        const result = await ContactsService.getAllContacts({
          includeArchived: false,
        });

        const options = result.contacts
          .map(toAssigneeOption)
          .filter((option): option is AssigneeOption => option !== null)
          .sort((left, right) => left.name.localeCompare(right.name));

        setAssigneeOptions(options);

        if (options.length === 0 && attempt < 2) {
          setTimeout(() => {
            void loadAssignees(attempt + 1);
          }, 700);
        }
      } catch (loadError) {
        logger.error('Error loading assignees', { loadError, attempt });
        if (attempt < 2) {
          setTimeout(() => {
            void loadAssignees(attempt + 1);
          }, 700);
        } else {
          setAssigneeOptions([]);
        }
      } finally {
        setLoadingAssignees(false);
      }
    };

    void loadAssignees();
  }, []);
  useEffect(() => {
    const loadConstructionBindings = async () => {
      setLoadingConstructionData(true);
      try {
        let resolvedBuildingId = draft?.buildingId || '';

        if (!resolvedBuildingId) {
          interface BuildingsResponse {
            buildings?: Array<{ id: string }>;
          }

          const query = draft?.projectId ? `?projectId=${encodeURIComponent(String(draft.projectId))}` : '';
          const scopedResponse = await apiClient.get<BuildingsResponse>(`/api/buildings${query}`);
          const scopedBuildings = scopedResponse?.buildings || [];

          if (scopedBuildings.length > 0) {
            resolvedBuildingId = scopedBuildings[0].id;
          } else {
            const allResponse = await apiClient.get<BuildingsResponse>('/api/buildings');
            const allBuildings = allResponse?.buildings || [];
            if (allBuildings.length > 0) {
              resolvedBuildingId = allBuildings[0].id;
            }
          }
        }

        if (!resolvedBuildingId) {
          setPhaseOptions([]);
          setMilestoneOptions([]);
          return;
        }

        const constructionData = await getConstructionData(resolvedBuildingId);

        const nextPhases = constructionData.phases
          .slice()
          .sort((left, right) => left.order - right.order)
          .map(toPhaseOption);

        const nextMilestones = constructionData.tasks
          .slice()
          .sort((left, right) => left.order - right.order)
          .map(toMilestoneOption);

        setPhaseOptions(nextPhases);
        setMilestoneOptions(nextMilestones);
      } catch (loadError) {
        logger.error('Error loading construction bindings', { loadError });
        setPhaseOptions([]);
        setMilestoneOptions([]);
      } finally {
        setLoadingConstructionData(false);
      }
    };

    loadConstructionBindings();
  }, [draft?.buildingId, draft?.projectId]);

  useEffect(() => {
    if (!metadata) {
      return;
    }

    let changed = false;
    const nextMetadata: ObligationMetadataState = {
      ...metadata,
      phaseBinding: {
        ...metadata.phaseBinding,
      },
    };

    if (!nextMetadata.assigneeId && nextMetadata.assigneeName && assigneeOptions.length > 0) {
      const matchingAssignee = assigneeOptions.find((option) => option.name === nextMetadata.assigneeName);
      if (matchingAssignee) {
        nextMetadata.assigneeId = matchingAssignee.id;
        changed = true;
      }
    }

    if (nextMetadata.phaseBinding.phaseId && phaseOptions.length > 0) {
      const phase = phaseOptions.find((option) => option.id === nextMetadata.phaseBinding.phaseId);
      if (phase && phase.name !== nextMetadata.phaseBinding.phaseName) {
        nextMetadata.phaseBinding.phaseName = phase.name;
        changed = true;
      }
    }

    if (nextMetadata.phaseBinding.milestoneId) {
      const isValidMilestone = milestoneOptions.some(
        (milestone) =>
          milestone.id === nextMetadata.phaseBinding.milestoneId &&
          milestone.phaseId === nextMetadata.phaseBinding.phaseId
      );

      if (!isValidMilestone) {
        nextMetadata.phaseBinding.milestoneId = '';
        changed = true;
      }
    }

    if (changed) {
      setMetadata(nextMetadata);
    }
  }, [metadata, assigneeOptions, phaseOptions, milestoneOptions]);

  const tableOfContents = useMemo(() => {
    if (!draft) {
      return [];
    }
    return generateTableOfContents(draft);
  }, [draft]);

  const handleTransition = async (status: ObligationStatus) => {
    if (!draft) {
      return;
    }

    const success = await obligationsService.updateStatus(draft.id, status, {
      changedBy: 'ui-user',
      reason: 'Transition from edit workspace',
    });

    if (!success) {
      return;
    }

    setDraft({ ...draft, status });
  };

  const handleSave = async () => {
    if (!draft || !metadata) {
      return;
    }

    setSaving(true);
    const dueDate = metadata.dueDate ? new Date(metadata.dueDate) : undefined;

    const updated = await obligationsService.update(draft.id, {
      ...draft,
      docNumber: metadata.docNumber,
      revision: metadata.revision,
      revisionNotes: metadata.revisionNotes,
      dueDate,
      assigneeId: metadata.assigneeId || undefined,
      assigneeName: metadata.assigneeName,
      phaseBinding: metadata.phaseBinding,
      costBinding: metadata.costBinding,
      tableOfContents,
    });

    if (updated) {
      setDraft(updated);
      setMetadata(buildMetadataState(updated));
    }

    setSaving(false);
  };

  if (!isNamespaceReady) {
    return (
      <PageLayout>
        <main className={`max-w-full mx-auto ${getSpacingClass('p', 'md')} md:p-6 lg:p-8`}>
          <section className="rounded-lg border p-6 text-sm text-muted-foreground">...</section>
        </main>
      </PageLayout>
    );
  }

  if (loading) {
    return (
      <PageLayout>
        <main className={`max-w-full mx-auto ${getSpacingClass('p', 'md')} md:p-6 lg:p-8`}>
          <section className="rounded-lg border p-6 text-sm text-muted-foreground">{t('workspace.edit.loading')}</section>
        </main>
      </PageLayout>
    );
  }

  if (error || !draft || !metadata) {
    return (
      <PageLayout>
        <main className={`max-w-full mx-auto ${getSpacingClass('p', 'md')} md:p-6 lg:p-8 space-y-4`}>
          <section className="rounded-lg border border-destructive/40 p-6 text-sm text-destructive">
            {t('workspace.edit.loadError')}
          </section>
          <Button variant="outline" onClick={() => router.push('/obligations')}>
            {t('workspace.edit.back')}
          </Button>
        </main>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <main className={`max-w-full mx-auto ${getSpacingClass('p', 'md')} md:p-6 lg:p-8 space-y-6`}>
        <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-sm text-muted-foreground">{draft.docNumber || draft.id}</div>
            <h1 className="text-2xl font-bold">{t('workspace.edit.title')}</h1>
            <p className="text-sm text-muted-foreground">{t('workspace.edit.subtitle')}</p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/obligations">
              <Button variant="outline">{t('workspace.edit.register')}</Button>
            </Link>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? t('workspace.edit.saving') : t('workspace.edit.save')}
            </Button>
          </div>
        </header>

        <section className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>{t('workspace.edit.basics')}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <fieldset className="space-y-2 md:col-span-2">
                <Label htmlFor="obligation-title">{t('workspace.edit.fields.title')}</Label>
                <Input
                  id="obligation-title"
                  value={draft.title}
                  onChange={(event) => setDraft({ ...draft, title: event.target.value })}
                />
              </fieldset>
              <fieldset className="space-y-2">
                <Label htmlFor="obligation-project">{t('workspace.edit.fields.project')}</Label>
                <Input
                  id="obligation-project"
                  value={draft.projectName}
                  onChange={(event) => setDraft({ ...draft, projectName: event.target.value })}
                />
              </fieldset>
              <fieldset className="space-y-2">
                <Label htmlFor="obligation-contractor">{t('workspace.edit.fields.contractor')}</Label>
                <Input
                  id="obligation-contractor"
                  value={draft.contractorCompany}
                  onChange={(event) => setDraft({ ...draft, contractorCompany: event.target.value })}
                />
              </fieldset>
            </CardContent>
          </Card>

          <WorkflowBar status={draft.status} onTransition={handleTransition} disabled={saving} />
        </section>

        <MetadataPanel
          value={metadata}
          onChange={setMetadata}
          assigneeOptions={assigneeOptions}
          phaseOptions={phaseOptions}
          milestoneOptions={milestoneOptions}
          loadingAssignees={loadingAssignees}
          loadingConstructionData={loadingConstructionData}
        />

        <section className="grid gap-6 xl:grid-cols-2" aria-label={t('workspace.edit.title')}>
          <Card>
            <CardHeader>
              <CardTitle>{t('workspace.edit.structure')}</CardTitle>
            </CardHeader>
            <CardContent>
              <StructureEditor
                sections={draft.sections}
                onSectionsChange={(sections) => setDraft({ ...draft, sections })}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('workspace.edit.preview')}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="h-[780px] overflow-y-auto">
                <LivePreview
                  className="border-0"
                  document={{
                    ...draft,
                    tableOfContents,
                  }}
                  viewMode="preview"
                />
              </div>
            </CardContent>
          </Card>
        </section>
      </main>
    </PageLayout>
  );
}

