/**
 * =============================================================================
 * ENTERPRISE: CALENDAR CREATE EVENT DIALOG
 * =============================================================================
 *
 * Dialog for creating a new calendar event (creates a CrmTask via TasksService).
 * Uses Radix Dialog + Radix Select (per ADR-001).
 * All values from centralized design system hooks — zero hardcoded values.
 *
 * @module components/crm/calendar/CalendarCreateDialog
 */

'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { Calendar as CalendarIcon, Plus } from 'lucide-react';
import { useNotifications } from '@/providers/NotificationProvider';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('CalendarCreateDialog');

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

import { addTask } from '@/services/tasks.service';
import { useAuth } from '@/auth/contexts/AuthContext';
import type { CrmTask } from '@/types/crm';

// ============================================================================
// TYPES
// ============================================================================

type TaskType = CrmTask['type'];

const EVENT_TYPES: TaskType[] = [
  'meeting',
  'call',
  'viewing',
  'follow_up',
  'email',
  'document',
  'other',
];

// ============================================================================
// PROPS
// ============================================================================

interface CalendarCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-selected date (from clicking a calendar slot) */
  initialDate?: Date;
  /** Callback after successful creation */
  onCreated?: () => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function CalendarCreateDialog({
  open,
  onOpenChange,
  initialDate,
  onCreated,
}: CalendarCreateDialogProps) {
  const { t } = useTranslation('crm');
  const { success, error: notifyError } = useNotifications();
  const { user } = useAuth();
  const iconSizes = useIconSizes();
  const sp = useSpacingTokens();
  const layout = useLayoutClasses();

  const [title, setTitle] = useState('');
  const [type, setType] = useState<TaskType>('meeting');
  const [date, setDate] = useState<Date | undefined>(initialDate ?? new Date());
  const [time, setTime] = useState('09:00');
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [reminderOffset, setReminderOffset] = useState<string>('none');
  const [contactId, setContactId] = useState<string>('');
  const [projectId, setProjectId] = useState<string>('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const resetForm = () => {
    setTitle('');
    setType('meeting');
    setDate(initialDate ?? new Date());
    setTime('09:00');
    setEndDate(undefined);
    setReminderOffset('none');
    setContactId('');
    setProjectId('');
    setDescription('');
  };

  const handleSubmit = async () => {
    if (!title.trim() || !date) return;

    setSubmitting(true);

    try {
      const [hours, minutes] = time.split(':').map(Number);
      const dueDate = new Date(date);
      dueDate.setHours(hours, minutes, 0, 0);

      // Compute reminderDate from offset
      let reminderDate: string | null = null;
      if (reminderOffset !== 'none') {
        const offsets: Record<string, number> = {
          '15min': 15 * 60 * 1000,
          '1hour': 60 * 60 * 1000,
          '1day': 24 * 60 * 60 * 1000,
        };
        const offset = offsets[reminderOffset];
        if (offset) {
          reminderDate = new Date(dueDate.getTime() - offset).toISOString();
        }
      }

      await addTask({
        title: title.trim(),
        type,
        dueDate: dueDate.toISOString(),
        endDate: endDate ? endDate.toISOString() : null,
        description: description.trim() || null,
        status: 'pending',
        priority: 'medium',
        assignedTo: user?.uid ?? '',
        contactId: contactId || null,
        projectId: projectId || null,
        reminderDate,
      });

      success(t('calendarPage.dialog.actions.save'));
      resetForm();
      onOpenChange(false);
      onCreated?.();
    } catch (err) {
      logger.error('Error creating event', { error: err });
      notifyError(err instanceof Error ? err.message : t('calendarPage.dialog.createError'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className={layout.flexCenterGap2}>
            <Plus className={iconSizes.md} />
            {t('calendarPage.dialog.createTitle')}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {t('calendarPage.dialog.createTitle')}
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
            <Label htmlFor="event-title">
              {t('calendarPage.dialog.fields.title')} *
            </Label>
            <Input
              id="event-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              autoFocus
            />
          </fieldset>

          {/* Type — Radix Select per ADR-001 */}
          <fieldset className={sp.spaceBetween.sm}>
            <Label>{t('calendarPage.dialog.fields.type')}</Label>
            <Select value={type} onValueChange={(v) => setType(v as TaskType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EVENT_TYPES.map((et) => (
                  <SelectItem key={et} value={et}>
                    {t(`calendarPage.eventTypes.${et}`)}
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
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </fieldset>

          {/* Time */}
          <fieldset className={sp.spaceBetween.sm}>
            <Label htmlFor="event-time">
              {t('calendarPage.dialog.fields.time')}
            </Label>
            <Input
              id="event-time"
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          </fieldset>

          {/* End Date — optional for multi-day events */}
          <fieldset className={sp.spaceBetween.sm}>
            <Label>{t('calendarPage.dialog.fields.endDate')}</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start text-left font-normal">
                  <CalendarIcon className={`${sp.margin.right.sm} ${iconSizes.sm}`} />
                  {endDate ? format(endDate, 'PPP') : t('calendarPage.dialog.fields.endDatePlaceholder')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className={`w-auto ${sp.padding.none}`}>
                <Calendar
                  mode="single"
                  selected={endDate}
                  onSelect={setEndDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </fieldset>

          {/* Reminder */}
          <fieldset className={sp.spaceBetween.sm}>
            <Label>{t('calendarPage.reminders.label')}</Label>
            <Select value={reminderOffset} onValueChange={setReminderOffset}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t('calendarPage.reminders.none')}</SelectItem>
                <SelectItem value="15min">{t('calendarPage.reminders.15min')}</SelectItem>
                <SelectItem value="1hour">{t('calendarPage.reminders.1hour')}</SelectItem>
                <SelectItem value="1day">{t('calendarPage.reminders.1day')}</SelectItem>
              </SelectContent>
            </Select>
          </fieldset>

          {/* Contact */}
          <fieldset className={sp.spaceBetween.sm}>
            <Label htmlFor="event-contact">{t('calendarPage.dialog.fields.contact')}</Label>
            <Input
              id="event-contact"
              value={contactId}
              onChange={(e) => setContactId(e.target.value)}
              placeholder={t('calendarPage.dialog.fields.contactPlaceholder')}
            />
          </fieldset>

          {/* Project */}
          <fieldset className={sp.spaceBetween.sm}>
            <Label htmlFor="event-project">{t('calendarPage.dialog.fields.project')}</Label>
            <Input
              id="event-project"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              placeholder={t('calendarPage.dialog.fields.projectPlaceholder')}
            />
          </fieldset>

          {/* Description */}
          <fieldset className={sp.spaceBetween.sm}>
            <Label htmlFor="event-description">
              {t('calendarPage.dialog.fields.description')}
            </Label>
            <Textarea
              id="event-description"
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
              {submitting ? t('calendarPage.dialog.submitting') : t('calendarPage.dialog.actions.save')}
            </Button>
          </footer>
        </form>
      </DialogContent>
    </Dialog>
  );
}
