'use client';

/**
 * MilestoneDialog — Create/Edit dialog for building milestones
 *
 * Follows the same pattern as ConstructionPhaseDialog.
 * Uses Radix Select (ADR-001), FormGrid/FormField centralized components.
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
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
import { useTypography } from '@/hooks/useTypography';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { DIALOG_SIZES } from '@/styles/design-tokens';
import type {
  BuildingMilestone,
  MilestoneCreatePayload,
  MilestoneUpdatePayload,
  MilestoneStatus,
  MilestoneType,
} from '@/types/building/milestone';

// ─── Types ───────────────────────────────────────────────────────────────

interface MilestoneDialogProps {
  open: boolean;
  milestone?: BuildingMilestone;
  onClose: () => void;
  onSave: (payload: MilestoneCreatePayload) => Promise<boolean>;
  onUpdate: (id: string, payload: MilestoneUpdatePayload) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
}

// ─── Options ─────────────────────────────────────────────────────────────

const MILESTONE_STATUSES: MilestoneStatus[] = [
  'completed',
  'in-progress',
  'pending',
  'delayed',
];

const MILESTONE_TYPES: MilestoneType[] = [
  'start',
  'construction',
  'systems',
  'finishing',
  'delivery',
];

// ─── Component ───────────────────────────────────────────────────────────

export function MilestoneDialog({
  open,
  milestone,
  onClose,
  onSave,
  onUpdate,
  onDelete,
}: MilestoneDialogProps) {
  const { t } = useTranslation(['building', 'building-address', 'building-filters', 'building-storage', 'building-tabs', 'building-timeline']);
  const spacingTokens = useSpacingTokens();
  const typographyTokens = useTypography();
  const colors = useSemanticColors();

  const isEditMode = !!milestone;

  // ─── Form State ──────────────────────────────────────────────────────

  const [title, setTitle] = useState('');
  const [type, setType] = useState<MilestoneType>('construction');
  const [date, setDate] = useState('');
  const [status, setStatus] = useState<MilestoneStatus>('pending');
  const [progress, setProgress] = useState(0);
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // ─── Initialize Form ─────────────────────────────────────────────────

  useEffect(() => {
    if (!open) return;

    if (milestone) {
      setTitle(milestone.title);
      setType(milestone.type);
      setDate(milestone.date);
      setStatus(milestone.status);
      setProgress(milestone.progress);
      setDescription(milestone.description ?? '');
    } else {
      setTitle('');
      setType('construction');
      setDate('');
      setStatus('pending');
      setProgress(0);
      setDescription('');
    }
    setErrors({});
  }, [open, milestone]);

  // ─── Validation ──────────────────────────────────────────────────────

  const validate = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};

    if (!title.trim()) {
      newErrors.title = t('tabs.timeline.milestoneDialog.validation.titleRequired');
    }
    if (!date) {
      newErrors.date = t('tabs.timeline.milestoneDialog.validation.dateRequired');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [title, date, t]);

  // ─── Save Handler ────────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    if (!validate()) return;

    setSaving(true);
    try {
      let success = false;

      if (isEditMode && milestone) {
        success = await onUpdate(milestone.id, {
          title: title.trim(),
          type,
          date,
          status,
          progress,
          description: description.trim(),
        });
      } else {
        success = await onSave({
          title: title.trim(),
          type,
          date,
          status,
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
  }, [isEditMode, milestone, title, type, date, status, progress, description, validate, onSave, onUpdate, onClose]);

  // ─── Delete Handler ──────────────────────────────────────────────────

  const handleDelete = useCallback(async () => {
    if (!milestone) return;
    setDeleting(true);
    try {
      const success = await onDelete(milestone.id);
      if (success) {
        onClose();
      }
    } finally {
      setDeleting(false);
    }
  }, [milestone, onDelete, onClose]);

  // ─── Dialog Title ────────────────────────────────────────────────────

  const dialogTitle = useMemo(() => {
    return isEditMode
      ? t('tabs.timeline.milestoneDialog.editTitle')
      : t('tabs.timeline.milestoneDialog.addTitle');
  }, [isEditMode, t]);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className={DIALOG_SIZES.md}>
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
        </DialogHeader>

        <FormGrid>
          {/* Title */}
          <FormField
            label={t('tabs.timeline.milestoneDialog.fields.title')}
            htmlFor="milestone-title"
            required
          >
            <FormInput>
              <Input
                id="milestone-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t('tabs.timeline.milestoneDialog.fields.titlePlaceholder')}
                className={errors.title ? 'border-destructive' : ''}
              />
              {errors.title && (
                <p className={cn(typographyTokens.body.sm, colors.text.error, spacingTokens.margin.top.xs)}>
                  {errors.title}
                </p>
              )}
            </FormInput>
          </FormField>

          {/* Type */}
          <FormField
            label={t('tabs.timeline.milestoneDialog.fields.type')}
            htmlFor="milestone-type"
          >
            <FormInput>
              <Select value={type} onValueChange={(val) => setType(val as MilestoneType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MILESTONE_TYPES.map((mType) => (
                    <SelectItem key={mType} value={mType}>
                      {t(`tabs.timeline.milestoneDialog.types.${mType}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormInput>
          </FormField>

          {/* Date */}
          <FormField
            label={t('tabs.timeline.milestoneDialog.fields.date')}
            htmlFor="milestone-date"
            required
          >
            <FormInput>
              <Input
                id="milestone-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className={errors.date ? 'border-destructive' : ''}
              />
              {errors.date && (
                <p className={cn(typographyTokens.body.sm, colors.text.error, spacingTokens.margin.top.xs)}>
                  {errors.date}
                </p>
              )}
            </FormInput>
          </FormField>

          {/* Status */}
          <FormField
            label={t('tabs.timeline.milestoneDialog.fields.status')}
            htmlFor="milestone-status"
          >
            <FormInput>
              <Select value={status} onValueChange={(val) => setStatus(val as MilestoneStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MILESTONE_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {t(`tabs.timeline.status.${s === 'in-progress' ? 'inProgress' : s}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormInput>
          </FormField>

          {/* Progress */}
          <FormField
            label={`${t('tabs.timeline.milestoneDialog.fields.progress')}: ${progress}%`}
            htmlFor="milestone-progress"
          >
            <FormInput>
              <Slider
                id="milestone-progress"
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
            label={t('tabs.timeline.milestoneDialog.fields.description')}
            htmlFor="milestone-description"
          >
            <FormInput>
              <Textarea
                id="milestone-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t('tabs.timeline.milestoneDialog.fields.descriptionPlaceholder')}
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
