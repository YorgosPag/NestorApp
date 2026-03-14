/**
 * =============================================================================
 * ENTERPRISE: TASK EDIT DIALOG
 * =============================================================================
 *
 * Inline edit dialog for CrmTask — opens from TasksTab "Edit" button.
 * All values from centralized design system hooks — zero hardcoded values.
 *
 * @module components/crm/dashboard/dialogs/TaskEditDialog
 */

'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { Calendar as CalendarIcon, Edit3 } from 'lucide-react';
import { useNotifications } from '@/providers/NotificationProvider';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('TaskEditDialog');

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { useIconSizes } from '@/hooks/useIconSizes';
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
import { useLayoutClasses } from '@/hooks/useLayoutClasses';

import { updateTask } from '@/services/tasks.service';
import type { CrmTask } from '@/types/crm';

// ============================================================================
// TYPES
// ============================================================================

type TaskType = CrmTask['type'];
type TaskStatus = CrmTask['status'];
type TaskPriority = CrmTask['priority'];

const TASK_TYPES: TaskType[] = [
  'meeting', 'call', 'viewing', 'follow_up', 'email', 'document', 'other',
];

const TASK_STATUSES: TaskStatus[] = [
  'pending', 'in_progress', 'completed', 'cancelled',
];

const TASK_PRIORITIES: TaskPriority[] = [
  'low', 'medium', 'high', 'urgent',
];

// ============================================================================
// PROPS
// ============================================================================

interface TaskEditDialogProps {
  task: CrmTask;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated?: () => void;
}

// ============================================================================
// HELPERS
// ============================================================================

function parseDueDate(dueDate: CrmTask['dueDate']): { date: Date; time: string } {
  if (!dueDate) return { date: new Date(), time: '09:00' };

  let d: Date;
  if (dueDate instanceof Date) {
    d = dueDate;
  } else if (typeof dueDate === 'string') {
    d = new Date(dueDate);
  } else if (typeof dueDate === 'object' && 'toDate' in dueDate && typeof dueDate.toDate === 'function') {
    d = dueDate.toDate();
  } else {
    d = new Date();
  }

  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return { date: d, time: `${hh}:${mm}` };
}

// ============================================================================
// COMPONENT
// ============================================================================

export function TaskEditDialog({
  task,
  open,
  onOpenChange,
  onUpdated,
}: TaskEditDialogProps) {
  const { t } = useTranslation('crm');
  const { success, error: notifyError } = useNotifications();
  const iconSizes = useIconSizes();
  const sp = useSpacingTokens();
  const layout = useLayoutClasses();

  const [title, setTitle] = useState('');
  const [type, setType] = useState<TaskType>('meeting');
  const [status, setStatus] = useState<TaskStatus>('pending');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [time, setTime] = useState('09:00');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Populate form when task changes
  useEffect(() => {
    if (!task) return;
    setTitle(task.title);
    setType(task.type);
    setStatus(task.status);
    setPriority(task.priority);
    setDescription(task.description ?? '');
    const parsed = parseDueDate(task.dueDate);
    setDate(parsed.date);
    setTime(parsed.time);
  }, [task]);

  const handleSubmit = async () => {
    if (!title.trim() || !date || !task.id) return;

    setSubmitting(true);

    try {
      const [hours, minutes] = time.split(':').map(Number);
      const dueDate = new Date(date);
      dueDate.setHours(hours, minutes, 0, 0);

      await updateTask(task.id, {
        title: title.trim(),
        type,
        status,
        priority,
        dueDate: dueDate.toISOString(),
        description: description.trim() || null,
      });

      success(t('tasks.messages.updated', { title: title.trim() }));
      onOpenChange(false);
      onUpdated?.();
    } catch (err) {
      logger.error('Error updating task', { error: err });
      notifyError(err instanceof Error ? err.message : t('tasks.messages.updateError'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className={layout.flexCenterGap2}>
            <Edit3 className={iconSizes.md} />
            {t('tasks.actions.edit')}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {t('tasks.actions.edit')}
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit();
          }}
          className={sp.spaceBetween.md}
        >
          {/* Title */}
          <fieldset className={sp.spaceBetween.sm}>
            <Label htmlFor="edit-task-title">
              {t('calendarPage.dialog.fields.title')} *
            </Label>
            <Input
              id="edit-task-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              autoFocus
            />
          </fieldset>

          {/* Type */}
          <fieldset className={sp.spaceBetween.sm}>
            <Label>{t('calendarPage.dialog.fields.type')}</Label>
            <Select value={type} onValueChange={(v) => setType(v as TaskType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TASK_TYPES.map((tt) => (
                  <SelectItem key={tt} value={tt}>
                    {t(`calendarPage.eventTypes.${tt}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </fieldset>

          {/* Status */}
          <fieldset className={sp.spaceBetween.sm}>
            <Label>{t('tasks.status.label')}</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as TaskStatus)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TASK_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {t(`tasks.status.${s}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </fieldset>

          {/* Priority */}
          <fieldset className={sp.spaceBetween.sm}>
            <Label>{t('tasks.priority.label')}</Label>
            <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TASK_PRIORITIES.map((p) => (
                  <SelectItem key={p} value={p}>
                    {t(`tasks.priority.${p}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </fieldset>

          {/* Date */}
          <fieldset className={sp.spaceBetween.sm}>
            <Label>{t('calendarPage.dialog.fields.date')}</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start text-left font-normal">
                  <CalendarIcon className={`${sp.margin.right.sm} ${iconSizes.sm}`} />
                  {date ? format(date, 'PPP') : t('calendarPage.dialog.fields.date')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className={`w-auto ${sp.padding.none}`}>
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={setDate}
                />
              </PopoverContent>
            </Popover>
          </fieldset>

          {/* Time */}
          <fieldset className={sp.spaceBetween.sm}>
            <Label htmlFor="edit-task-time">
              {t('calendarPage.dialog.fields.time')}
            </Label>
            <Input
              id="edit-task-time"
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          </fieldset>

          {/* Description */}
          <fieldset className={sp.spaceBetween.sm}>
            <Label htmlFor="edit-task-description">
              {t('calendarPage.dialog.fields.description')}
            </Label>
            <Textarea
              id="edit-task-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </fieldset>

          {/* Actions */}
          <footer className={`flex justify-end ${sp.gap.sm} ${sp.padding.top.sm}`}>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              {t('calendarPage.dialog.actions.cancel')}
            </Button>
            <Button type="submit" disabled={submitting || !title.trim()}>
              {submitting
                ? t('calendarPage.dialog.submitting')
                : t('calendarPage.dialog.actions.save')}
            </Button>
          </footer>
        </form>
      </DialogContent>
    </Dialog>
  );
}
