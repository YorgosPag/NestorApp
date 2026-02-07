'use client';

/**
 * ConstructionPhaseDialog — Create/Edit dialog for phases and tasks (ADR-034)
 *
 * Dual-mode dialog: creates or edits construction phases and tasks.
 * Follows the same pattern as AddBuildingDialog.
 *
 * Centralized Systems Used:
 * - Radix Select (ADR-001)
 * - FormGrid/FormField/FormInput
 * - SaveButton/CancelButton/DeleteButton
 * - useTranslation('building')
 * - Design tokens
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SaveButton, CancelButton, DeleteButton } from '@/components/ui/form/ActionButtons';
import { FormGrid, FormField, FormInput } from '@/components/ui/form/FormComponents';
import { Textarea } from '@/components/ui/textarea';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { cn } from '@/lib/utils';
import type {
  ConstructionPhase,
  ConstructionTask,
  ConstructionPhaseStatus,
  ConstructionTaskStatus,
} from '@/types/building/construction';

// ─── Types ───────────────────────────────────────────────────────────────

type DialogMode = 'createPhase' | 'editPhase' | 'createTask' | 'editTask';

interface ConstructionPhaseDialogProps {
  open: boolean;
  mode: DialogMode;
  onClose: () => void;
  // Phase data (edit mode)
  phase?: ConstructionPhase;
  // Task data (edit mode)
  task?: ConstructionTask;
  // Phase ID for creating task under
  phaseId?: string;
  // CRUD handlers
  onSavePhase: (data: PhaseFormData) => Promise<boolean>;
  onUpdatePhase: (phaseId: string, updates: Record<string, unknown>) => Promise<boolean>;
  onDeletePhase: (phaseId: string) => Promise<boolean>;
  onSaveTask: (data: TaskFormData) => Promise<boolean>;
  onUpdateTask: (taskId: string, updates: Record<string, unknown>) => Promise<boolean>;
  onDeleteTask: (taskId: string) => Promise<boolean>;
}

interface PhaseFormData {
  name: string;
  code: string;
  status: ConstructionPhaseStatus;
  plannedStartDate: string;
  plannedEndDate: string;
  progress: number;
  description: string;
}

interface TaskFormData {
  phaseId: string;
  name: string;
  code: string;
  status: ConstructionTaskStatus;
  plannedStartDate: string;
  plannedEndDate: string;
  progress: number;
  description: string;
}

// ─── Status Options ──────────────────────────────────────────────────────

const PHASE_STATUSES: ConstructionPhaseStatus[] = [
  'planning',
  'inProgress',
  'completed',
  'delayed',
  'blocked',
];

const TASK_STATUSES: ConstructionTaskStatus[] = [
  'notStarted',
  'inProgress',
  'completed',
  'delayed',
  'blocked',
];

// ─── Component ───────────────────────────────────────────────────────────

export function ConstructionPhaseDialog({
  open,
  mode,
  onClose,
  phase,
  task,
  phaseId,
  onSavePhase,
  onUpdatePhase,
  onDeletePhase,
  onSaveTask,
  onUpdateTask,
  onDeleteTask,
}: ConstructionPhaseDialogProps) {
  const { t } = useTranslation('building');

  const isPhaseMode = mode === 'createPhase' || mode === 'editPhase';
  const isEditMode = mode === 'editPhase' || mode === 'editTask';

  // ─── Form State ──────────────────────────────────────────────────────

  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [status, setStatus] = useState<string>(isPhaseMode ? 'planning' : 'notStarted');
  const [plannedStartDate, setPlannedStartDate] = useState('');
  const [plannedEndDate, setPlannedEndDate] = useState('');
  const [progress, setProgress] = useState(0);
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // ─── Initialize Form ─────────────────────────────────────────────────

  useEffect(() => {
    if (!open) return;

    if (mode === 'editPhase' && phase) {
      setName(phase.name);
      setCode(phase.code);
      setStatus(phase.status);
      setPlannedStartDate(phase.plannedStartDate);
      setPlannedEndDate(phase.plannedEndDate);
      setProgress(phase.progress);
      setDescription(phase.description ?? '');
    } else if (mode === 'editTask' && task) {
      setName(task.name);
      setCode(task.code);
      setStatus(task.status);
      setPlannedStartDate(task.plannedStartDate);
      setPlannedEndDate(task.plannedEndDate);
      setProgress(task.progress);
      setDescription(task.description ?? '');
    } else {
      // Create mode: reset form
      setName('');
      setCode('');
      setStatus(isPhaseMode ? 'planning' : 'notStarted');
      setPlannedStartDate('');
      setPlannedEndDate('');
      setProgress(0);
      setDescription('');
    }
    setErrors({});
  }, [open, mode, phase, task, isPhaseMode]);

  // ─── Validation ──────────────────────────────────────────────────────

  const validate = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = t('tabs.timeline.gantt.validation.nameRequired');
    }
    if (!plannedStartDate) {
      newErrors.plannedStartDate = t('tabs.timeline.gantt.validation.startDateRequired');
    }
    if (!plannedEndDate) {
      newErrors.plannedEndDate = t('tabs.timeline.gantt.validation.endDateRequired');
    }
    if (plannedStartDate && plannedEndDate && plannedStartDate > plannedEndDate) {
      newErrors.plannedEndDate = t('tabs.timeline.gantt.validation.endAfterStart');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [name, plannedStartDate, plannedEndDate, t]);

  // ─── Save Handler ────────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    if (!validate()) return;

    setSaving(true);

    try {
      let success = false;

      if (mode === 'createPhase') {
        success = await onSavePhase({
          name: name.trim(),
          code: code.trim(),
          status: status as ConstructionPhaseStatus,
          plannedStartDate,
          plannedEndDate,
          progress,
          description: description.trim(),
        });
      } else if (mode === 'editPhase' && phase) {
        success = await onUpdatePhase(phase.id, {
          name: name.trim(),
          code: code.trim(),
          status,
          plannedStartDate,
          plannedEndDate,
          progress,
          description: description.trim(),
        });
      } else if (mode === 'createTask') {
        const targetPhaseId = phaseId ?? '';
        success = await onSaveTask({
          phaseId: targetPhaseId,
          name: name.trim(),
          code: code.trim(),
          status: status as ConstructionTaskStatus,
          plannedStartDate,
          plannedEndDate,
          progress,
          description: description.trim(),
        });
      } else if (mode === 'editTask' && task) {
        success = await onUpdateTask(task.id, {
          name: name.trim(),
          code: code.trim(),
          status,
          plannedStartDate,
          plannedEndDate,
          progress,
          description: description.trim(),
        });
      }

      if (success) {
        onClose();
      }
    } finally {
      setSaving(false);
    }
  }, [
    mode, name, code, status, plannedStartDate, plannedEndDate, progress, description,
    phase, task, phaseId, validate, onSavePhase, onUpdatePhase, onSaveTask, onUpdateTask, onClose,
  ]);

  // ─── Delete Handler ──────────────────────────────────────────────────

  const handleDelete = useCallback(async () => {
    setDeleting(true);
    try {
      let success = false;

      if (mode === 'editPhase' && phase) {
        success = await onDeletePhase(phase.id);
      } else if (mode === 'editTask' && task) {
        success = await onDeleteTask(task.id);
      }

      if (success) {
        onClose();
      }
    } finally {
      setDeleting(false);
    }
  }, [mode, phase, task, onDeletePhase, onDeleteTask, onClose]);

  // ─── Dialog Title ────────────────────────────────────────────────────

  const dialogTitle = useMemo(() => {
    switch (mode) {
      case 'createPhase': return t('tabs.timeline.gantt.dialog.createPhase');
      case 'editPhase': return t('tabs.timeline.gantt.dialog.editPhase');
      case 'createTask': return t('tabs.timeline.gantt.dialog.createTask');
      case 'editTask': return t('tabs.timeline.gantt.dialog.editTask');
      default: return '';
    }
  }, [mode, t]);

  // ─── Status Options ──────────────────────────────────────────────────

  const statusOptions = isPhaseMode ? PHASE_STATUSES : TASK_STATUSES;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
        </DialogHeader>

        <FormGrid>
          {/* Name */}
          <FormField
            label={t('tabs.timeline.gantt.dialog.name')}
            htmlFor="construction-name"
            required
          >
            <FormInput>
              <Input
                id="construction-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={isPhaseMode
                  ? t('tabs.timeline.gantt.dialog.phaseNamePlaceholder')
                  : t('tabs.timeline.gantt.dialog.taskNamePlaceholder')
                }
                className={errors.name ? 'border-destructive' : ''}
              />
              {errors.name && (
                <p className="text-sm text-destructive mt-1">{errors.name}</p>
              )}
            </FormInput>
          </FormField>

          {/* Code */}
          <FormField
            label={t('tabs.timeline.gantt.dialog.code')}
            htmlFor="construction-code"
          >
            <FormInput>
              <Input
                id="construction-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder={isPhaseMode ? 'PH-001' : 'TSK-001'}
              />
            </FormInput>
          </FormField>

          {/* Status */}
          <FormField
            label={t('tabs.timeline.gantt.dialog.status')}
            htmlFor="construction-status"
          >
            <FormInput>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((s) => (
                    <SelectItem key={s} value={s}>
                      {t(`tabs.timeline.gantt.status.${s}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormInput>
          </FormField>

          {/* Start Date */}
          <FormField
            label={t('tabs.timeline.gantt.dialog.startDate')}
            htmlFor="construction-start-date"
            required
          >
            <FormInput>
              <Input
                id="construction-start-date"
                type="date"
                value={plannedStartDate}
                onChange={(e) => setPlannedStartDate(e.target.value)}
                className={errors.plannedStartDate ? 'border-destructive' : ''}
              />
              {errors.plannedStartDate && (
                <p className="text-sm text-destructive mt-1">{errors.plannedStartDate}</p>
              )}
            </FormInput>
          </FormField>

          {/* End Date */}
          <FormField
            label={t('tabs.timeline.gantt.dialog.endDate')}
            htmlFor="construction-end-date"
            required
          >
            <FormInput>
              <Input
                id="construction-end-date"
                type="date"
                value={plannedEndDate}
                onChange={(e) => setPlannedEndDate(e.target.value)}
                className={errors.plannedEndDate ? 'border-destructive' : ''}
              />
              {errors.plannedEndDate && (
                <p className="text-sm text-destructive mt-1">{errors.plannedEndDate}</p>
              )}
            </FormInput>
          </FormField>

          {/* Progress */}
          <FormField
            label={`${t('tabs.timeline.gantt.dialog.progress')}: ${progress}%`}
            htmlFor="construction-progress"
          >
            <FormInput>
              <Slider
                id="construction-progress"
                min={0}
                max={100}
                step={5}
                value={[progress]}
                onValueChange={(value) => setProgress(value[0])}
              />
            </FormInput>
          </FormField>

          {/* Description */}
          <FormField
            label={t('tabs.timeline.gantt.dialog.description')}
            htmlFor="construction-description"
          >
            <FormInput>
              <Textarea
                id="construction-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t('tabs.timeline.gantt.dialog.descriptionPlaceholder')}
                rows={3}
              />
            </FormInput>
          </FormField>
        </FormGrid>

        <DialogFooter className="flex justify-between">
          <div>
            {isEditMode && (
              <DeleteButton
                loading={deleting}
                onClick={handleDelete}
              />
            )}
          </div>
          <div className="flex gap-2">
            <CancelButton onClick={onClose} disabled={saving || deleting} />
            <SaveButton loading={saving} onClick={handleSave} />
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
