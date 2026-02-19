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

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { SaveButton, CancelButton, DeleteButton } from '@/components/ui/form/ActionButtons';
import { FormGrid, FormField, FormInput } from '@/components/ui/form/FormComponents';
import { Textarea } from '@/components/ui/textarea';
import { ChevronDown, Search, Check, PenLine } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { cn } from '@/lib/utils';
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTypography } from '@/hooks/useTypography';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { INTERACTIVE_PATTERNS, TRANSITION_PRESETS } from '@/components/ui/effects';
import { DIALOG_SIZES } from '@/styles/design-tokens';
import {
  CONSTRUCTION_PHASES,
  getPredefinedTasksForPhase,
  findPhaseKeyByTranslatedName,
} from '@/config/construction-templates';
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
  // Phase ID for creating task under (default selection)
  phaseId?: string;
  // Available phases for task creation phase selector
  phases?: ConstructionPhase[];
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
  phases = [],
  onSavePhase,
  onUpdatePhase,
  onDeletePhase,
  onSaveTask,
  onUpdateTask,
  onDeleteTask,
}: ConstructionPhaseDialogProps) {
  const { t } = useTranslation('building');
  const spacingTokens = useSpacingTokens();
  const iconSizes = useIconSizes();
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

  // ─── Combobox State ────────────────────────────────────────────────────

  const [namePopoverOpen, setNamePopoverOpen] = useState(false);
  const [nameSearchQuery, setNameSearchQuery] = useState('');
  const comboboxInputRef = useRef<HTMLInputElement>(null);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const resultsRef = useRef<HTMLDivElement>(null);

  // ─── Combobox: Filtered Predefined Options ──────────────────────────

  const filteredOptions = useMemo(() => {
    const query = nameSearchQuery.trim().toLowerCase();

    if (isPhaseMode) {
      // Phase mode: show predefined phases
      const allPhases = CONSTRUCTION_PHASES.map((p) => ({
        key: p.key,
        code: p.code,
        label: t(`tabs.timeline.gantt.templates.phases.${p.key}`),
      }));
      if (!query) return allPhases;
      return allPhases.filter(
        (p) => p.label.toLowerCase().includes(query) || p.code.toLowerCase().includes(query)
      );
    }

    // Task mode: show predefined tasks for the selected phase (or all)
    const selectedPhase = phases.find((p) => p.id === selectedPhaseId);
    const phaseKey = selectedPhase
      ? findPhaseKeyByTranslatedName(selectedPhase.name, t)
      : undefined;

    const taskSources = phaseKey
      ? getPredefinedTasksForPhase(phaseKey)
      : CONSTRUCTION_PHASES.flatMap((p) => p.tasks);

    // Need the parent phase key to build i18n path for tasks
    const allTasks = taskSources.map((task) => {
      // Find which phase this task belongs to
      const parentPhase = CONSTRUCTION_PHASES.find((p) =>
        p.tasks.some((pt) => pt.key === task.key && pt.code === task.code)
      );
      const parentKey = parentPhase?.key ?? '';
      return {
        key: task.key,
        code: task.code,
        label: t(`tabs.timeline.gantt.templates.tasks.${parentKey}.${task.key}`),
      };
    });

    if (!query) return allTasks;
    return allTasks.filter(
      (task) => task.label.toLowerCase().includes(query) || task.code.toLowerCase().includes(query)
    );
  }, [isPhaseMode, nameSearchQuery, selectedPhaseId, phases, t]);

  // ─── Combobox: Select Predefined Option ─────────────────────────────

  const handleSelectPredefined = useCallback((option: { key: string; code: string; label: string }) => {
    setName(option.label);
    setCode(option.code);
    setNamePopoverOpen(false);
    setNameSearchQuery('');
    setHighlightedIndex(-1);
  }, []);

  // ─── Combobox: Use Custom Text ──────────────────────────────────────

  const handleUseCustomText = useCallback(() => {
    const trimmed = nameSearchQuery.trim();
    if (trimmed) {
      setName(trimmed);
      setNamePopoverOpen(false);
      setNameSearchQuery('');
      setHighlightedIndex(-1);
    }
  }, [nameSearchQuery]);

  // ─── Combobox: Keyboard Navigation ──────────────────────────────────

  const handleComboboxKeyDown = useCallback((e: React.KeyboardEvent) => {
    // +1 for the "custom" option at the end
    const totalItems = filteredOptions.length + (nameSearchQuery.trim() ? 1 : 0);
    if (totalItems === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => {
        const next = prev < totalItems - 1 ? prev + 1 : 0;
        setTimeout(() => {
          resultsRef.current?.querySelector(`[data-option-index="${next}"]`)
            ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }, 0);
        return next;
      });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => {
        const next = prev > 0 ? prev - 1 : totalItems - 1;
        setTimeout(() => {
          resultsRef.current?.querySelector(`[data-option-index="${next}"]`)
            ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }, 0);
        return next;
      });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
        handleSelectPredefined(filteredOptions[highlightedIndex]);
      } else if (highlightedIndex === filteredOptions.length && nameSearchQuery.trim()) {
        handleUseCustomText();
      } else if (nameSearchQuery.trim()) {
        handleUseCustomText();
      }
    } else if (e.key === 'Escape') {
      setNamePopoverOpen(false);
    }
  }, [filteredOptions, highlightedIndex, nameSearchQuery, handleSelectPredefined, handleUseCustomText]);

  // ─── Combobox: Open Handler ─────────────────────────────────────────

  const handleComboboxOpen = useCallback((isOpen: boolean) => {
    setNamePopoverOpen(isOpen);
    if (isOpen) {
      setNameSearchQuery('');
      setHighlightedIndex(-1);
      requestAnimationFrame(() => comboboxInputRef.current?.focus());
    }
  }, []);

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
      setSelectedPhaseId(task.phaseId);
    } else {
      // Create mode: reset form
      setName('');
      setCode('');
      setStatus(isPhaseMode ? 'planning' : 'notStarted');
      setPlannedStartDate('');
      setPlannedEndDate('');
      setProgress(0);
      setDescription('');
      // Default to passed phaseId or first available phase
      setSelectedPhaseId(phaseId ?? phases[0]?.id ?? '');
    }
    setErrors({});
    // Reset combobox state
    setNamePopoverOpen(false);
    setNameSearchQuery('');
    setHighlightedIndex(-1);
  }, [open, mode, phase, task, isPhaseMode, phaseId, phases]);

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
    // Validate phase selection for task creation/edit
    if (!isPhaseMode && !selectedPhaseId) {
      newErrors.selectedPhaseId = t('tabs.timeline.gantt.validation.phaseRequired');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [name, plannedStartDate, plannedEndDate, isPhaseMode, selectedPhaseId, t]);

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
    phase, task, selectedPhaseId, validate, onSavePhase, onUpdatePhase, onSaveTask, onUpdateTask, onClose,
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
      <DialogContent className={DIALOG_SIZES.md}>
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
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
          <FormField
            label={t('tabs.timeline.gantt.dialog.name')}
            htmlFor="construction-name"
            required
          >
            <FormInput>
              <Popover open={namePopoverOpen} onOpenChange={handleComboboxOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    type="button"
                    role="combobox"
                    aria-expanded={namePopoverOpen}
                    className={cn(
                      'w-full justify-between h-10 px-2 py-2',
                      typographyTokens.body.sm,
                      errors.name ? 'border-destructive' : 'border-input',
                      INTERACTIVE_PATTERNS.ACCENT_HOVER,
                      'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2'
                    )}
                  >
                    <span className={name ? 'text-foreground truncate' : colors.text.muted}>
                      {name || (isPhaseMode
                        ? t('tabs.timeline.gantt.dialog.phaseNamePlaceholder')
                        : t('tabs.timeline.gantt.dialog.taskNamePlaceholder')
                      )}
                    </span>
                    <ChevronDown className={cn(
                      iconSizes.sm,
                      TRANSITION_PRESETS.STANDARD_TRANSFORM,
                      namePopoverOpen ? 'rotate-180' : ''
                    )} />
                  </Button>
                </PopoverTrigger>

                <PopoverContent
                  className="w-[var(--radix-popover-trigger-width)] p-0"
                  align="start"
                  sideOffset={4}
                  onKeyDown={handleComboboxKeyDown}
                >
                  {/* Search Input */}
                  <section className={cn('border-b border-border', spacingTokens.padding.sm)}>
                    <div className="relative">
                      <Search className={cn('absolute left-2 top-2.5', iconSizes.sm, colors.text.muted)} />
                      <Input
                        ref={comboboxInputRef}
                        value={nameSearchQuery}
                        onChange={(e) => {
                          setNameSearchQuery(e.target.value);
                          setHighlightedIndex(-1);
                        }}
                        placeholder={isPhaseMode
                          ? t('tabs.timeline.gantt.templates.combobox.searchPhase')
                          : t('tabs.timeline.gantt.templates.combobox.searchTask')
                        }
                        className="pl-8"
                      />
                    </div>
                  </section>

                  {/* Results — onWheel fixes scroll inside Dialog modal */}
                  <div
                    ref={resultsRef}
                    className="max-h-[250px] overflow-y-auto"
                    role="listbox"
                    onWheel={(e) => {
                      const el = e.currentTarget;
                      const hasScroll = el.scrollHeight > el.clientHeight;
                      if (hasScroll) {
                        e.stopPropagation();
                        el.scrollTop += e.deltaY;
                      }
                    }}
                  >
                    {/* Predefined Section Header */}
                    {filteredOptions.length > 0 && (
                      <p className={cn(
                        typographyTokens.label.sm,
                        colors.text.muted,
                        spacingTokens.padding.x.sm,
                        spacingTokens.padding.y.xs,
                        'border-b border-border bg-muted/30'
                      )}>
                        {t('tabs.timeline.gantt.templates.combobox.predefined')}
                      </p>
                    )}

                    {/* Predefined Options */}
                    {filteredOptions.map((option, index) => {
                      const isSelected = name === option.label;
                      const isHighlighted = index === highlightedIndex;
                      return (
                        <div
                          key={`${option.code}-${option.key}`}
                          data-option-index={index}
                          role="option"
                          aria-selected={isHighlighted}
                          className={cn(
                            'flex items-center justify-between cursor-pointer',
                            spacingTokens.padding.x.sm,
                            spacingTokens.padding.y.xs,
                            'border-b border-border last:border-b-0',
                            TRANSITION_PRESETS.STANDARD_COLORS,
                            isHighlighted
                              ? 'bg-accent text-accent-foreground'
                              : INTERACTIVE_PATTERNS.ACCENT_HOVER
                          )}
                          onClick={() => handleSelectPredefined(option)}
                          onMouseEnter={() => setHighlightedIndex(index)}
                        >
                          <span className={cn('flex items-center', spacingTokens.gap.sm)}>
                            <span className={cn(typographyTokens.body.sm, colors.text.muted)}>
                              {option.code}
                            </span>
                            <span className={typographyTokens.body.sm}>
                              {option.label}
                            </span>
                          </span>
                          {isSelected && (
                            <Check className={cn(iconSizes.sm, 'text-primary')} />
                          )}
                        </div>
                      );
                    })}

                    {/* Custom Entry Option */}
                    {nameSearchQuery.trim() && (
                      <div
                        data-option-index={filteredOptions.length}
                        role="option"
                        aria-selected={highlightedIndex === filteredOptions.length}
                        className={cn(
                          'flex items-center cursor-pointer',
                          spacingTokens.padding.x.sm,
                          spacingTokens.padding.y.xs,
                          'border-t border-border',
                          TRANSITION_PRESETS.STANDARD_COLORS,
                          highlightedIndex === filteredOptions.length
                            ? 'bg-accent text-accent-foreground'
                            : INTERACTIVE_PATTERNS.ACCENT_HOVER
                        )}
                        onClick={handleUseCustomText}
                        onMouseEnter={() => setHighlightedIndex(filteredOptions.length)}
                      >
                        <PenLine className={cn(iconSizes.sm, colors.text.muted, spacingTokens.margin.right.sm)} />
                        <span className={typographyTokens.body.sm}>
                          {t('tabs.timeline.gantt.templates.combobox.custom', { value: nameSearchQuery.trim() })}
                        </span>
                      </div>
                    )}

                    {/* No Results */}
                    {filteredOptions.length === 0 && !nameSearchQuery.trim() && (
                      <p className={cn(
                        typographyTokens.body.sm,
                        colors.text.muted,
                        'text-center',
                        spacingTokens.padding.md
                      )}>
                        {t('tabs.timeline.gantt.templates.combobox.noResults')}
                      </p>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
              {errors.name && (
                <p className={cn(typographyTokens.body.sm, colors.text.error, spacingTokens.margin.top.xs)}>{errors.name}</p>
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
