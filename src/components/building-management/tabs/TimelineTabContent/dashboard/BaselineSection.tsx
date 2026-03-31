'use client';

/**
 * @module BaselineSection
 * @enterprise ADR-266 Phase C, Sub-phase 3 — Baseline Snapshots
 *
 * Manages baseline snapshots: save, list, compare toggle, delete.
 * Primavera P6 / MS Project pattern — manual save, max 10 per building.
 */

import { useState, useCallback } from 'react';
import { Save, Trash2, GitCompare, X, Clock, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ReportSection } from '@/components/reports/core/ReportSection';
import { ReportEmptyState } from '@/components/reports/core/ReportEmptyState';
import { useSemanticColors } from '@/hooks/useSemanticColors';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatDateShort } from '@/lib/intl-utils';
import { cn } from '@/lib/utils';
import '@/lib/design-system';
import type { UseBaselineComparisonReturn } from './useBaselineComparison';

// ─── Props ───────────────────────────────────────────────────────────────

interface BaselineSectionProps {
  baseline: UseBaselineComparisonReturn;
  loading?: boolean;
}

// ─── Constants ──────────────────────────────────────────────────────────

const MAX_BASELINES = 10;

// ─── Component ──────────────────────────────────────────────────────────

export function BaselineSection({ baseline, loading }: BaselineSectionProps) {
  const { t } = useTranslation('building');
  const colors = useSemanticColors();
  const iconSizes = useIconSizes();

  // Save dialog state
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [saveDescription, setSaveDescription] = useState('');
  const [saving, setSaving] = useState(false);

  // Delete confirmation state
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const tBase = 'tabs.timeline.dashboard.baseline';

  // ── Save handler ────────────────────────────────────────────────────
  const openSaveDialog = useCallback(() => {
    const nextVersion = (baseline.baselines.length > 0
      ? Math.max(...baseline.baselines.map(b => b.version)) + 1
      : 1);
    const today = new Date().toISOString().slice(0, 10);
    setSaveName(`Baseline ${nextVersion} - ${today}`);
    setSaveDescription('');
    setSaveDialogOpen(true);
  }, [baseline.baselines]);

  const handleSave = useCallback(async () => {
    if (!saveName.trim()) return;
    setSaving(true);
    try {
      await baseline.saveBaseline({
        name: saveName.trim(),
        description: saveDescription.trim() || undefined,
      });
      setSaveDialogOpen(false);
    } finally {
      setSaving(false);
    }
  }, [saveName, saveDescription, baseline]);

  // ── Delete handler ──────────────────────────────────────────────────
  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await baseline.removeBaseline(deleteTarget.id);
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  }, [deleteTarget, baseline]);

  const isMaxReached = baseline.baselines.length >= MAX_BASELINES;

  return (
    <ReportSection
      title={t(`${tBase}.title`)}
      tooltip={t('tabs.timeline.dashboard.tooltips.baselineTitle')}
      id="schedule-baselines"
    >
      {/* Header: Save button */}
      <div className="flex items-center justify-between mb-3">
        <p className={cn('text-xs', colors.text.muted)}>
          {baseline.baselines.length}/{MAX_BASELINES}
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={openSaveDialog}
          disabled={loading || isMaxReached || baseline.listLoading}
        >
          <Save className={cn(iconSizes.sm, 'mr-1.5')} />
          {t(`${tBase}.saveBaseline`)}
        </Button>
      </div>

      {isMaxReached && (
        <p className="text-xs text-amber-600 dark:text-amber-400 mb-3">
          {t(`${tBase}.saveDialog.maxReached`)}
        </p>
      )}

      {/* Baseline list */}
      {baseline.baselines.length === 0 ? (
        <ReportEmptyState
          title={t(`${tBase}.list.empty`)}
          description={t(`${tBase}.list.emptyDesc`)}
        />
      ) : (
        <ul className="space-y-2">
          {baseline.baselines.map(b => {
            const isSelected = baseline.selectedBaselineId === b.id;
            return (
              <li
                key={b.id}
                className={cn(
                  'flex items-center justify-between rounded-md border px-3 py-2 transition-colors',
                  isSelected && 'border-primary bg-primary/5',
                )}
              >
                <div className="flex items-center gap-3 min-w-0">
                  {/* Version badge */}
                  <span className={cn(
                    'shrink-0 rounded-full px-2 py-0.5 text-xs font-medium',
                    isSelected
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground',
                  )}>
                    v{b.version}
                  </span>

                  {/* Name + meta */}
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{b.name}</p>
                    <div className={cn('flex items-center gap-2 text-xs', colors.text.muted)}>
                      <Clock className="h-3 w-3 shrink-0" />
                      <span>{formatDateShort(b.createdAt)}</span>
                      <Layers className="h-3 w-3 shrink-0 ml-1" />
                      <span>
                        {t(`${tBase}.list.phases`, { count: b.phaseCount })} / {t(`${tBase}.list.tasks`, { count: b.taskCount })}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0 ml-2">
                  <Button
                    variant={isSelected ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => baseline.setSelectedBaselineId(isSelected ? null : b.id)}
                    disabled={baseline.detailLoading && !isSelected}
                  >
                    {isSelected ? (
                      <>
                        <X className={cn(iconSizes.sm, 'mr-1')} />
                        {t(`${tBase}.list.stopComparing`)}
                      </>
                    ) : (
                      <>
                        <GitCompare className={cn(iconSizes.sm, 'mr-1')} />
                        {t(`${tBase}.list.compare`)}
                      </>
                    )}
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDeleteTarget({ id: b.id, name: b.name })}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className={iconSizes.sm} />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* ── Save Baseline Dialog ──────────────────────────────────────── */}
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t(`${tBase}.saveDialog.title`)}</DialogTitle>
            <DialogDescription>
              {t(`${tBase}.saveDialog.description`)}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="baseline-name">{t(`${tBase}.saveDialog.nameLabel`)}</Label>
              <Input
                id="baseline-name"
                value={saveName}
                onChange={e => setSaveName(e.target.value)}
                placeholder={t(`${tBase}.saveDialog.namePlaceholder`)}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="baseline-desc">{t(`${tBase}.saveDialog.descriptionLabel`)}</Label>
              <Textarea
                id="baseline-desc"
                value={saveDescription}
                onChange={e => setSaveDescription(e.target.value)}
                placeholder={t(`${tBase}.saveDialog.descriptionPlaceholder`)}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setSaveDialogOpen(false)}>
              {t(`${tBase}.saveDialog.cancel`)}
            </Button>
            <Button onClick={handleSave} disabled={saving || !saveName.trim()}>
              {saving ? t(`${tBase}.saveDialog.saving`) : t(`${tBase}.saveDialog.save`)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation ───────────────────────────────────────── */}
      <AlertDialog open={deleteTarget !== null} onOpenChange={open => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t(`${tBase}.list.delete`)}</AlertDialogTitle>
            <AlertDialogDescription>
              {t(`${tBase}.list.deleteConfirm`, { name: deleteTarget?.name ?? '' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t(`${tBase}.saveDialog.cancel`)}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting}>
              {t(`${tBase}.list.delete`)}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ReportSection>
  );
}
