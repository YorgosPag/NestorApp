/**
 * @module components/reports/builder/SaveReportDialog
 * @enterprise ADR-268 Phase 7 — Save Report Configuration Dialog
 *
 * Modal for saving/save-as report configurations.
 * Pattern: AlertDialog (same as ExportDialog) + QuickBooks simplicity (<3s save).
 */

'use client';

import '@/lib/design-system';
import { useState, useEffect, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  SAVED_REPORT_CATEGORIES,
  type SavedReport,
  type SavedReportConfig,
  type SavedReportCategory,
  type SavedReportVisibility,
  type CreateSavedReportInput,
  type UpdateSavedReportInput,
} from '@/types/reports/saved-report';

// ============================================================================
// Types
// ============================================================================

interface SaveReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'save' | 'saveAs';
  existingReport: SavedReport | null;
  currentConfig: SavedReportConfig;
  onSave: (input: CreateSavedReportInput) => Promise<SavedReport>;
  onUpdate: (id: string, input: UpdateSavedReportInput) => Promise<SavedReport>;
}

// ============================================================================
// Component
// ============================================================================

export function SaveReportDialog({
  open,
  onOpenChange,
  mode,
  existingReport,
  currentConfig,
  onSave,
  onUpdate,
}: SaveReportDialogProps) {
  const { t } = useTranslation('saved-reports');
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<SavedReportCategory>('general');
  const [visibility, setVisibility] = useState<SavedReportVisibility>('personal');

  // Reset form when dialog opens
  useEffect(() => {
    if (!open) return;
    if (mode === 'saveAs' && existingReport) {
      setName(existingReport.name + t('messages.duplicateSuffix'));
      setDescription(existingReport.description ?? '');
      setCategory(existingReport.category);
      setVisibility(existingReport.visibility);
    } else if (mode === 'save' && existingReport) {
      setName(existingReport.name);
      setDescription(existingReport.description ?? '');
      setCategory(existingReport.category);
      setVisibility(existingReport.visibility);
    } else {
      setName('');
      setDescription('');
      setCategory('general');
      setVisibility('personal');
    }
  }, [open, mode, existingReport, t]);

  const isValid = name.trim().length >= 2;

  const handleSubmit = useCallback(async () => {
    if (!isValid || saving) return;
    setSaving(true);
    try {
      if (mode === 'save' && existingReport) {
        await onUpdate(existingReport.id, {
          name: name.trim(),
          description: description.trim() || null,
          category,
          visibility,
          config: currentConfig,
        });
      } else {
        await onSave({
          name: name.trim(),
          description: description.trim() || undefined,
          category,
          visibility,
          config: currentConfig,
        });
      }
      onOpenChange(false);
    } catch {
      // Error handled by parent hook (toast)
    } finally {
      setSaving(false);
    }
  }, [isValid, saving, mode, existingReport, name, description, category, visibility, currentConfig, onUpdate, onSave, onOpenChange]);

  const dialogTitle = mode === 'saveAs' ? t('dialog.saveAsTitle') : t('dialog.saveTitle');

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{dialogTitle}</AlertDialogTitle>
          <AlertDialogDescription>{t('description')}</AlertDialogDescription>
        </AlertDialogHeader>

        <form
          className="space-y-4 py-2"
          onSubmit={e => { e.preventDefault(); void handleSubmit(); }}
        >
          {/* Name */}
          <fieldset className="space-y-2">
            <Label htmlFor="report-name">{t('dialog.nameLabel')}</Label>
            <Input
              id="report-name"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder={t('dialog.namePlaceholder')}
              autoFocus
              required
              minLength={2}
            />
          </fieldset>

          {/* Description */}
          <fieldset className="space-y-2">
            <Label htmlFor="report-description">{t('dialog.descriptionLabel')}</Label>
            <Input
              id="report-description"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder={t('dialog.descriptionPlaceholder')}
            />
          </fieldset>

          {/* Category */}
          <fieldset className="space-y-2">
            <Label>{t('dialog.categoryLabel')}</Label>
            <Select value={category} onValueChange={v => setCategory(v as SavedReportCategory)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SAVED_REPORT_CATEGORIES.map(cat => (
                  <SelectItem key={cat} value={cat}>
                    {t(`categories.${cat}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </fieldset>

          {/* Visibility */}
          <fieldset className="space-y-2">
            <Label>{t('dialog.visibilityLabel')}</Label>
            <Select value={visibility} onValueChange={v => setVisibility(v as SavedReportVisibility)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="personal">{t('visibility.personal')}</SelectItem>
                <SelectItem value="shared">{t('visibility.shared')}</SelectItem>
              </SelectContent>
            </Select>
          </fieldset>
        </form>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={saving}>{t('dialog.cancel')}</AlertDialogCancel>
          <Button onClick={() => void handleSubmit()} disabled={!isValid || saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('dialog.save')}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
