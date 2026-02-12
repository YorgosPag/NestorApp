"use client";

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getSpacingClass } from '@/lib/design-system';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { ObligationCostBinding, ObligationPhaseBinding } from '@/types/obligations';

export interface ObligationMetadataState {
  docNumber: string;
  revision: number;
  revisionNotes: string;
  dueDate: string;
  assigneeId: string;
  assigneeName: string;
  phaseBinding: ObligationPhaseBinding;
  costBinding: ObligationCostBinding;
}

export interface AssigneeOption {
  id: string;
  name: string;
}

export interface PhaseOption {
  id: string;
  name: string;
}

export interface MilestoneOption {
  id: string;
  name: string;
  phaseId: string;
}

interface MetadataPanelProps {
  value: ObligationMetadataState;
  onChange: (value: ObligationMetadataState) => void;
  assigneeOptions: AssigneeOption[];
  phaseOptions: PhaseOption[];
  milestoneOptions: MilestoneOption[];
  loadingAssignees: boolean;
  loadingConstructionData: boolean;
}

const NO_ASSIGNEE_VALUE = '__no_assignee__';
const NO_PHASE_VALUE = '__no_phase__';
const NO_MILESTONE_VALUE = '__no_milestone__';

export function MetadataPanel({
  value,
  onChange,
  assigneeOptions,
  phaseOptions,
  milestoneOptions,
  loadingAssignees,
  loadingConstructionData,
}: MetadataPanelProps) {
  const { t } = useTranslation('obligations');

  const update = <K extends keyof ObligationMetadataState>(key: K, nextValue: ObligationMetadataState[K]) => {
    onChange({ ...value, [key]: nextValue });
  };

  const resolvedAssigneeOptions = assigneeOptions.length > 0
    ? assigneeOptions
    : (value.assigneeId || value.assigneeName)
      ? [{ id: value.assigneeId || 'current-assignee', name: value.assigneeName || value.assigneeId }]
      : [];

  const resolvedPhaseOptions = phaseOptions.length > 0
    ? phaseOptions
    : value.phaseBinding.phaseId
      ? [{ id: value.phaseBinding.phaseId, name: value.phaseBinding.phaseName || value.phaseBinding.phaseId }]
      : [];

  const normalizedPhaseId = (value.phaseBinding.phaseId || '').trim();
  const filteredMilestoneOptions = milestoneOptions.filter((milestone) => (milestone.phaseId || '').trim() === normalizedPhaseId);
  const resolvedMilestoneOptions = filteredMilestoneOptions.length > 0
    ? filteredMilestoneOptions
    : milestoneOptions.length > 0
      ? milestoneOptions
      : value.phaseBinding.milestoneId
        ? [{
            id: value.phaseBinding.milestoneId,
            name: value.phaseBinding.milestoneId,
            phaseId: value.phaseBinding.phaseId || '',
          }]
        : [];

  return (
    <section className={`rounded-lg border ${getSpacingClass('p', 'md')} space-y-4`} aria-label={t('workspace.metadata.title')}>
      <header>
        <h2 className="text-base font-semibold">{t('workspace.metadata.title')}</h2>
        <p className="text-sm text-muted-foreground">{t('workspace.metadata.subtitle')}</p>
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <fieldset className="space-y-2">
          <Label htmlFor="docNumber">{t('workspace.metadata.docNumber')}</Label>
          <Input id="docNumber" value={value.docNumber} onChange={(event) => update('docNumber', event.target.value)} />
        </fieldset>
        <fieldset className="space-y-2">
          <Label htmlFor="revision">{t('workspace.metadata.revision')}</Label>
          <Input
            id="revision"
            type="number"
            min={1}
            value={String(value.revision)}
            onChange={(event) => update('revision', Number(event.target.value || 1))}
          />
        </fieldset>
        <fieldset className="space-y-2">
          <Label htmlFor="dueDate">{t('workspace.metadata.dueDate')}</Label>
          <Input id="dueDate" type="date" value={value.dueDate} onChange={(event) => update('dueDate', event.target.value)} />
        </fieldset>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <fieldset className="space-y-2">
          <Label>{t('workspace.metadata.assignee')}</Label>
          <Select
            value={value.assigneeId || undefined}
            onValueChange={(assigneeId) => {
              if (assigneeId === NO_ASSIGNEE_VALUE) {
                return;
              }
              const assignee = resolvedAssigneeOptions.find((option) => option.id === assigneeId);
              if (!assignee) {
                return;
              }
              onChange({
                ...value,
                assigneeId: assignee.id,
                assigneeName: assignee.name,
              });
            }}
            disabled={loadingAssignees}
          >
            <SelectTrigger>
              <SelectValue placeholder={t('workspace.metadata.assignee')} />
            </SelectTrigger>
            <SelectContent>
              {resolvedAssigneeOptions.length === 0 ? (
                <SelectItem value={NO_ASSIGNEE_VALUE}>No assignees available</SelectItem>
              ) : (
                resolvedAssigneeOptions.map((assignee) => (
                  <SelectItem key={assignee.id} value={assignee.id}>
                    {assignee.name}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </fieldset>
        <fieldset className="space-y-2">
          <Label htmlFor="revisionNotes">{t('workspace.metadata.revisionNotes')}</Label>
          <Input
            id="revisionNotes"
            value={value.revisionNotes}
            onChange={(event) => update('revisionNotes', event.target.value)}
          />
        </fieldset>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <fieldset className="space-y-2 rounded-md border p-3">
          <legend className="px-1 text-sm font-medium">{t('workspace.metadata.phaseBinding')}</legend>
          <Label>{t('workspace.metadata.phaseId')}</Label>
          <Select
            value={value.phaseBinding.phaseId || undefined}
            onValueChange={(phaseId) => {
              if (phaseId === NO_PHASE_VALUE) {
                return;
              }
              const phase = resolvedPhaseOptions.find((option) => option.id === phaseId);
              if (!phase) {
                return;
              }
              update('phaseBinding', {
                ...value.phaseBinding,
                phaseId: phase.id,
                phaseName: phase.name,
                milestoneId: '',
              });
            }}
            disabled={loadingConstructionData}
          >
            <SelectTrigger>
              <SelectValue placeholder={t('workspace.metadata.phaseId')} />
            </SelectTrigger>
            <SelectContent>
              {resolvedPhaseOptions.length === 0 ? (
                <SelectItem value={NO_PHASE_VALUE}>No phases available</SelectItem>
              ) : (
                resolvedPhaseOptions.map((phase) => (
                  <SelectItem key={phase.id} value={phase.id}>
                    {phase.name}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>

          <Label htmlFor="phaseName">{t('workspace.metadata.phaseName')}</Label>
          <Input id="phaseName" value={value.phaseBinding.phaseName} readOnly />

          <Label>{t('workspace.metadata.milestoneId')}</Label>
          <Select
            value={value.phaseBinding.milestoneId || undefined}
            onValueChange={(milestoneId) => {
              if (milestoneId === NO_MILESTONE_VALUE) {
                return;
              }
              update('phaseBinding', {
                ...value.phaseBinding,
                milestoneId,
              });
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder={t('workspace.metadata.milestoneId')} />
            </SelectTrigger>
            <SelectContent>
              {resolvedMilestoneOptions.length === 0 ? (
                <SelectItem value={NO_MILESTONE_VALUE}>No milestones available</SelectItem>
              ) : (
                resolvedMilestoneOptions.map((milestone) => (
                  <SelectItem key={milestone.id} value={milestone.id}>
                    {milestone.name}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>

          <Label htmlFor="acceptanceCriteria">{t('workspace.metadata.acceptanceCriteria')}</Label>
          <Input
            id="acceptanceCriteria"
            value={value.phaseBinding.acceptanceCriteria || ''}
            onChange={(event) =>
              update('phaseBinding', {
                ...value.phaseBinding,
                acceptanceCriteria: event.target.value,
              })
            }
          />
        </fieldset>

        <fieldset className="space-y-2 rounded-md border p-3">
          <legend className="px-1 text-sm font-medium">{t('workspace.metadata.costBinding')}</legend>
          <Label htmlFor="costCode">{t('workspace.metadata.costCode')}</Label>
          <Input
            id="costCode"
            value={value.costBinding.costCode}
            onChange={(event) =>
              update('costBinding', {
                ...value.costBinding,
                costCode: event.target.value,
              })
            }
          />
          <Label htmlFor="costLineName">{t('workspace.metadata.costLine')}</Label>
          <Input
            id="costLineName"
            value={value.costBinding.costLineName}
            onChange={(event) =>
              update('costBinding', {
                ...value.costBinding,
                costLineName: event.target.value,
              })
            }
          />
          <Label htmlFor="boqItemCode">{t('workspace.metadata.boqItem')}</Label>
          <Input
            id="boqItemCode"
            value={value.costBinding.boqItemCode || ''}
            onChange={(event) =>
              update('costBinding', {
                ...value.costBinding,
                boqItemCode: event.target.value,
              })
            }
          />
          <Label htmlFor="budgetAmount">{t('workspace.metadata.budgetAmount')}</Label>
          <Input
            id="budgetAmount"
            type="number"
            min={0}
            value={String(value.costBinding.budgetAmount || 0)}
            onChange={(event) =>
              update('costBinding', {
                ...value.costBinding,
                budgetAmount: Number(event.target.value || 0),
              })
            }
          />
        </fieldset>
      </div>
    </section>
  );
}
