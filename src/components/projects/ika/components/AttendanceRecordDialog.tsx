'use client';

/**
 * =============================================================================
 * AttendanceRecordDialog — Manual attendance event entry
 * =============================================================================
 *
 * Dialog for siteManager to manually record attendance events.
 * Supports all 7 event types with worker selection and optional notes.
 *
 * @module components/projects/ika/components/AttendanceRecordDialog
 * @enterprise ADR-090 — IKA/EFKA Labor Compliance System (Phase 2)
 * @compliance ADR-001 — Uses Radix Select (canonical dropdown)
 */

import React, { useState, useCallback } from 'react';
import { ClipboardEdit, Loader2 } from 'lucide-react';
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
import { Label } from '@/components/ui/label';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
import { cn } from '@/lib/utils';
import type { ProjectWorker, AttendanceEventType } from '../contracts';
import type { CreateAttendanceEventParams } from '../hooks/useAttendanceEvents';

/** All available event types for manual recording */
const EVENT_TYPES: AttendanceEventType[] = [
  'check_in',
  'check_out',
  'break_start',
  'break_end',
  'left_site',
  'returned',
  'exit_permission',
];

interface AttendanceRecordDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback to toggle open state */
  onOpenChange: (open: boolean) => void;
  /** Project ID */
  projectId: string;
  /** Available workers for selection */
  workers: ProjectWorker[];
  /** Pre-selected worker contact ID (for inline record buttons) */
  preSelectedWorkerId?: string;
  /** Current user ID (for recordedBy) */
  currentUserId: string;
  /** Callback after successful event creation */
  onRecorded: () => void;
  /** The addEvent function from useAttendanceEvents */
  addEvent: (params: CreateAttendanceEventParams) => Promise<boolean>;
}

export function AttendanceRecordDialog({
  open,
  onOpenChange,
  projectId,
  workers,
  preSelectedWorkerId,
  currentUserId,
  onRecorded,
  addEvent,
}: AttendanceRecordDialogProps) {
  const { t } = useTranslation('projects');
  const iconSizes = useIconSizes();
  const spacing = useSpacingTokens();

  const [selectedWorker, setSelectedWorker] = useState<string>(preSelectedWorkerId ?? '');
  const [selectedEventType, setSelectedEventType] = useState<AttendanceEventType | ''>('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset form when dialog opens
  const handleOpenChange = useCallback((isOpen: boolean) => {
    if (isOpen) {
      setSelectedWorker(preSelectedWorkerId ?? '');
      setSelectedEventType('');
      setNotes('');
    }
    onOpenChange(isOpen);
  }, [preSelectedWorkerId, onOpenChange]);

  const handleSubmit = useCallback(async () => {
    if (!selectedWorker || !selectedEventType) return;

    setIsSubmitting(true);

    try {
      const success = await addEvent({
        projectId,
        contactId: selectedWorker,
        eventType: selectedEventType,
        method: 'manual',
        recordedBy: currentUserId,
        notes: notes.trim() || undefined,
      });

      if (success) {
        onRecorded();
        onOpenChange(false);
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [selectedWorker, selectedEventType, projectId, currentUserId, notes, addEvent, onRecorded, onOpenChange]);

  const isValid = selectedWorker !== '' && selectedEventType !== '';

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardEdit className={iconSizes.md} />
            {t('ika.timesheetTab.dialog.title')}
          </DialogTitle>
        </DialogHeader>

        <div className={cn('space-y-4', spacing.padding.y.sm)}>
          {/* Worker selector */}
          <div className="space-y-2">
            <Label>{t('ika.timesheetTab.dialog.selectWorker')}</Label>
            <Select value={selectedWorker} onValueChange={setSelectedWorker}>
              <SelectTrigger>
                <SelectValue placeholder={t('ika.timesheetTab.dialog.selectWorker')} />
              </SelectTrigger>
              <SelectContent>
                {workers.map((worker) => (
                  <SelectItem key={worker.contactId} value={worker.contactId}>
                    {worker.name}
                    {worker.company ? ` (${worker.company})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Event type selector */}
          <div className="space-y-2">
            <Label>{t('ika.timesheetTab.dialog.selectEventType')}</Label>
            <Select
              value={selectedEventType}
              onValueChange={(v) => setSelectedEventType(v as AttendanceEventType)}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('ika.timesheetTab.dialog.selectEventType')} />
              </SelectTrigger>
              <SelectContent>
                {EVENT_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {t(`ika.timesheetTab.eventTypes.${type}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Notes (optional) */}
          <div className="space-y-2">
            <Label>{t('ika.timesheetTab.dialog.notes')}</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t('ika.timesheetTab.dialog.notesPlaceholder')}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            {t('common.cancel', 'Ακύρωση')}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!isValid || isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className={cn(iconSizes.sm, spacing.margin.right.sm, 'animate-spin')} />
                {t('ika.timesheetTab.dialog.submitting')}
              </>
            ) : (
              t('ika.timesheetTab.dialog.submit')
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
