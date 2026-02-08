'use client';

/**
 * =============================================================================
 * EmploymentRecordDialog — Dialog for editing worker insurance class
 * =============================================================================
 *
 * Allows assigning/changing the insurance class for a worker.
 * Uses Radix Select (ADR-001) for insurance class dropdown.
 *
 * @module components/projects/ika/components/EmploymentRecordDialog
 * @enterprise ADR-090 — IKA/EFKA Labor Compliance System (Phase 3)
 */

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useTypography } from '@/hooks/useTypography';
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
import { cn } from '@/lib/utils';
import type { LaborComplianceConfig, WorkerStampsSummary } from '../contracts';

interface EmploymentRecordDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback to close the dialog */
  onOpenChange: (open: boolean) => void;
  /** Worker being edited */
  worker: WorkerStampsSummary | null;
  /** Labor compliance config (insurance classes list) */
  config: LaborComplianceConfig;
  /** Callback when insurance class is saved */
  onSave: (contactId: string, classNumber: number, notes: string) => void;
}

export function EmploymentRecordDialog({
  open,
  onOpenChange,
  worker,
  config,
  onSave,
}: EmploymentRecordDialogProps) {
  const { t } = useTranslation('projects');
  const typography = useTypography();
  const spacing = useSpacingTokens();

  const [selectedClass, setSelectedClass] = useState<string>('');
  const [notes, setNotes] = useState('');

  // Reset form when worker changes
  useEffect(() => {
    if (worker) {
      setSelectedClass(
        worker.insuranceClassNumber !== null ? String(worker.insuranceClassNumber) : ''
      );
      setNotes('');
    }
  }, [worker]);

  function handleSave() {
    if (!worker || !selectedClass) return;
    onSave(worker.contactId, parseInt(selectedClass, 10), notes);
    onOpenChange(false);
  }

  if (!worker) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('ika.stampsTab.dialog.title')}</DialogTitle>
        </DialogHeader>

        <div className={cn('flex flex-col', spacing.gap.md)}>
          {/* Worker name (read-only) */}
          <div>
            <p className={typography.label.sm}>{t('ika.stampsTab.columns.worker')}</p>
            <p className={typography.body.sm}>{worker.workerName}</p>
          </div>

          {/* Insurance class selector */}
          <div>
            <p className={cn(typography.label.sm, spacing.margin.bottom.xs)}>
              {t('ika.stampsTab.dialog.selectClass')}
            </p>
            <Select value={selectedClass} onValueChange={setSelectedClass}>
              <SelectTrigger>
                <SelectValue placeholder={t('ika.stampsTab.dialog.selectClass')} />
              </SelectTrigger>
              <SelectContent>
                {config.insuranceClasses.map((ic) => (
                  <SelectItem key={ic.classNumber} value={String(ic.classNumber)}>
                    {t('ika.stampsTab.dialog.classLabel', {
                      number: ic.classNumber,
                      wage: ic.imputedDailyWage.toFixed(2),
                    })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Notes */}
          <div>
            <p className={cn(typography.label.sm, spacing.margin.bottom.xs)}>
              {t('ika.stampsTab.dialog.notes')}
            </p>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel', { defaultValue: 'Cancel' })}
          </Button>
          <Button onClick={handleSave} disabled={!selectedClass}>
            {t('ika.stampsTab.dialog.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
