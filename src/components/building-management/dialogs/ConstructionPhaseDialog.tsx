'use client';

/** ConstructionPhaseDialog — Create/Edit dialog for phases & tasks (ADR-034) */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { NameComboboxField } from './NameComboboxField';
import { SaveButton, CancelButton, DeleteButton } from '@/components/ui/form/ActionButtons';
import { FormGrid, FormField, FormInput } from '@/components/ui/form/FormComponents';
import { Textarea } from '@/components/ui/textarea';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { cn } from '@/lib/utils';
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
import { useTypography } from '@/hooks/useTypography';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { DIALOG_SIZES } from '@/styles/design-tokens';
import type { ConstructionPhaseStatus, ConstructionTaskStatus, DelayReason } from '@/types/building/construction';
import { usePhaseNameCombobox } from './usePhaseNameCombobox';
import { ResourceAssignmentSection } from './ResourceAssignmentSection';
import { DelayFieldsSection } from './DelayFieldsSection';
import { PHASE_STATUSES, TASK_STATUSES } from './construction-dialog.types';
import type { ConstructionPhaseDialogProps } from './construction-dialog.types';

// ─── Component ───────────────────────────────────────────────────────────

export function ConstructionPhaseDialog({
  open,
  mode,
  onClose,
  phase,
  task,
  phaseId,
  phases = [],
  onSavePhase,
  onUpdatePhase,
  onDeletePhase,
  onSaveTask,
  onUpdateTask,
  onDeleteTask,
  buildingId,
  workers = [],
}: ConstructionPhaseDialogProps) {
  const { t } = useTranslation(['building', 'building-address', 'building-filters', 'building-storage', 'building-tabs', 'building-timeline']);
  const spacingTokens = useSpacingTokens();
  const typographyTokens = useTypography();
  const colors = useSemanticColors();

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
  const [selectedPhaseId, setSelectedPhaseId] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [delayReason, setDelayReason] = useState<DelayReason | ''>('');
  const [delayNote, setDelayNote] = useState('');

  const showDelayFields = status === 'delayed' || status === 'blocked';

  // ─── Combobox (extracted to usePhaseNameCombobox hook) ──────────────

  const combobox = usePhaseNameCombobox({
    isPhaseMode,
    selectedPhaseId,
    phases,
    t,
    setName,
    setCode,
  });

  // Aliases for JSX readability
  const {
    popoverOpen: namePopoverOpen,
    searchQuery: nameSearchQuery,
    setSearchQuery: setNameSearchQuery,
    inputRef: comboboxInputRef,
    highlightedIndex,
    resultsRef,
    filteredOptions,
    handleSelectPredefined,
    handleUseCustomText,
    handleKeyDown: handleComboboxKeyDown,
    handleOpen: handleComboboxOpen,
  } = combobox;

  const comboboxReset = combobox.reset;

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
      setDelayReason(phase.delayReason ?? '');
      setDelayNote(phase.delayNote ?? '');
    } else if (mode === 'editTask' && task) {
      setName(task.name);
      setCode(task.code);
      setStatus(task.status);
      setPlannedStartDate(task.plannedStartDate);
      setPlannedEndDate(task.plannedEndDate);
      setProgress(task.progress);
      setDescription(task.description ?? '');
      setSelectedPhaseId(task.phaseId);
      setDelayReason(task.delayReason ?? '');
      setDelayNote(task.delayNote ?? '');
    } else {
      // Create mode: reset form
      setName('');
      setCode('');
      setStatus(isPhaseMode ? 'planning' : 'notStarted');
      setPlannedStartDate('');
      setPlannedEndDate('');
      setProgress(0);
      setDescription('');
      setDelayReason('');
      setDelayNote('');
      // Default to passed phaseId or first available phase
      setSelectedPhaseId(phaseId ?? phases[0]?.id ?? '');
    }
    setErrors({});
    comboboxReset();
  }, [open, mode, phase, task, isPhaseMode, phaseId, phases, comboboxReset]);

  const validate = useCallback((): boolean => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = t('tabs.timeline.gantt.validation.nameRequired');
    if (!plannedStartDate) e.plannedStartDate = t('tabs.timeline.gantt.validation.startDateRequired');
    if (!plannedEndDate) e.plannedEndDate = t('tabs.timeline.gantt.validation.endDateRequired');
    if (plannedStartDate && plannedEndDate && plannedStartDate > plannedEndDate) e.plannedEndDate = t('tabs.timeline.gantt.validation.endAfterStart');
    if (!isPhaseMode && !selectedPhaseId) e.selectedPhaseId = t('tabs.timeline.gantt.validation.phaseRequired');
    setErrors(e);
    return Object.keys(e).length === 0;
  }, [name, plannedStartDate, plannedEndDate, isPhaseMode, selectedPhaseId, t]);

  const handleSave = useCallback(async () => {
    if (!validate()) return;

    setSaving(true);

    try {
      let success = false;

      // Delay fields: include only when status is delayed/blocked, clear otherwise
      const delayFields = showDelayFields
        ? {
            delayReason: delayReason || null,
            delayNote: delayNote.trim() || null,
          }
        : { delayReason: null, delayNote: null };

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
          ...delayFields,
        });
      } else if (mode === 'createTask') {
        success = await onSaveTask({
          phaseId: selectedPhaseId,
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
          ...delayFields,
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
    delayReason, delayNote, showDelayFields,
    phase, task, selectedPhaseId, validate, onSavePhase, onUpdatePhase, onSaveTask, onUpdateTask, onClose,
  ]);

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

  const dialogTitle = useMemo(() => {
    switch (mode) {
      case 'createPhase': return t('tabs.timeline.gantt.dialog.createPhase');
      case 'editPhase': return t('tabs.timeline.gantt.dialog.editPhase');
      case 'createTask': return t('tabs.timeline.gantt.dialog.createTask');
      case 'editTask': return t('tabs.timeline.gantt.dialog.editTask');
      default: return '';
    }
  }, [mode, t]);

  const statusOptions = isPhaseMode ? PHASE_STATUSES : TASK_STATUSES;

  const handleOpenChange = useCallback((isOpen: boolean) => {
    if (!isOpen) onClose();
  }, [onClose]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className={DIALOG_SIZES.md}>
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
          <DialogDescription className="sr-only">
            {dialogTitle}
          </DialogDescription>
        </DialogHeader>

        <FormGrid>
          {/* Phase Selector — only for task modes */}
          {!isPhaseMode && phases.length > 0 && (
            <FormField
              label={t('tabs.timeline.gantt.dialog.phase')}
              htmlFor="construction-phase-select"
              required
            >
              <FormInput>
                <Select value={selectedPhaseId} onValueChange={setSelectedPhaseId}>
                  <SelectTrigger className={errors.selectedPhaseId ? 'border-destructive' : ''}>
                    <SelectValue placeholder={t('tabs.timeline.gantt.dialog.selectPhase')} />
                  </SelectTrigger>
                  <SelectContent>
                    {phases.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.code} — {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.selectedPhaseId && (
                  <p className={cn(typographyTokens.body.sm, colors.text.error, spacingTokens.margin.top.xs)}>{errors.selectedPhaseId}</p>
                )}
              </FormInput>
            </FormField>
          )}

          {/* Name — Combobox with predefined options + custom entry */}
          <NameComboboxField
            name={name}
            isPhaseMode={isPhaseMode}
            error={errors.name}
            popoverOpen={namePopoverOpen}
            searchQuery={nameSearchQuery}
            setSearchQuery={setNameSearchQuery}
            inputRef={comboboxInputRef}
            highlightedIndex={highlightedIndex}
            resultsRef={resultsRef}
            filteredOptions={filteredOptions}
            onSelectPredefined={handleSelectPredefined}
            onUseCustomText={handleUseCustomText}
            onKeyDown={handleComboboxKeyDown}
            onOpenChange={handleComboboxOpen}
            onHighlightChange={combobox.setHighlightedIndex}
            t={t}
          />

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

          {/* Delay fields — visible only when delayed/blocked (extracted ADR-266) */}
          {showDelayFields && (
            <DelayFieldsSection
              delayReason={delayReason}
              delayNote={delayNote}
              onDelayReasonChange={setDelayReason}
              onDelayNoteChange={setDelayNote}
            />
          )}

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
                <p className={cn(typographyTokens.body.sm, colors.text.error, spacingTokens.margin.top.xs)}>{errors.plannedStartDate}</p>
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
                <p className={cn(typographyTokens.body.sm, colors.text.error, spacingTokens.margin.top.xs)}>{errors.plannedEndDate}</p>
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

        {/* Resource Assignments — only in editTask mode (ADR-266 C4) */}
        {mode === 'editTask' && task && buildingId && (
          <ResourceAssignmentSection
            taskId={task.id}
            phaseId={task.phaseId}
            buildingId={buildingId}
            workers={workers}
          />
        )}

        <DialogFooter className="flex justify-between">
          <div>
            {isEditMode && (
              <DeleteButton
                loading={deleting}
                onClick={handleDelete}
              />
            )}
          </div>
          <div className={cn('flex', spacingTokens.gap.sm)}>
            <CancelButton onClick={onClose} disabled={saving || deleting} />
            <SaveButton loading={saving} onClick={handleSave} />
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
