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

import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import { useNotifications } from '@/providers/NotificationProvider';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('CalendarCreateDialog');

import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { DatePickerField } from '@/components/ui/date-picker-field';
import { EnumSelect } from '@/components/ui/enum-select';
import { TaskDialogShell } from '@/components/crm/shared/TaskDialogShell';
import { TaskFormField } from '@/components/crm/shared/TaskFormField';

import { addTask } from '@/services/tasks.service';
import { subscribeToContacts } from '@/services/contacts-query.service';
import { useProjectsList } from '@/hooks/useProjectsList';
import type { Contact } from '@/types/contacts/contracts';
import { getContactDisplayName } from '@/types/contacts/helpers';
import { SearchableCombobox } from '@/components/ui/searchable-combobox';
import type { ComboboxOption } from '@/components/ui/searchable-combobox';
import { VoiceMicButton } from '@/components/voice-input/VoiceMicButton';
import { useAuth } from '@/auth/contexts/AuthContext';
import { combineDateAndTime } from '@/lib/date-local';
import {
  CRM_TASK_TYPES,
  CRM_TASK_TYPE_CREATABLE_VALUES,
  type CrmTaskType,
} from '@/constants/crm-task-enums';
import '@/lib/design-system';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Πόσο πριν από το συμβάν χτυπά η υπενθύμιση, σε ms. Το `null` = καμία.
 * Οι επιλογές του dropdown παράγονται από τον ίδιο πίνακα με τους υπολογισμούς,
 * ώστε μια επιλογή χωρίς offset να μην μπορεί να υπάρξει.
 */
const REMINDER_OFFSET_MS = {
  none: null,
  '15min': 15 * 60 * 1000,
  '1hour': 60 * 60 * 1000,
  '1day': 24 * 60 * 60 * 1000,
} as const;

type ReminderOffset = keyof typeof REMINDER_OFFSET_MS;

const REMINDER_OFFSET_VALUES: readonly ReminderOffset[] = [
  'none',
  '15min',
  '1hour',
  '1day',
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
  const { t } = useTranslation(['crm', 'crm-inbox']);
  const { success, error: notifyError } = useNotifications();
  const { user } = useAuth();

  const [title, setTitle] = useState('');
  const [type, setType] = useState<CrmTaskType>(CRM_TASK_TYPES.MEETING);
  const [date, setDate] = useState<Date | undefined>(initialDate ?? new Date());
  const [time, setTime] = useState('09:00');
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [reminderOffset, setReminderOffset] = useState<ReminderOffset>('none');
  const [contactId, setContactId] = useState<string>('');
  const [projectId, setProjectId] = useState<string>('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const { projects, loading: projectsLoading } = useProjectsList({ enabled: open });

  useEffect(() => {
    if (!open) return;
    return subscribeToContacts(setContacts);
  }, [open]);

  const contactOptions = useMemo<ComboboxOption[]>(
    () => contacts.flatMap(c => c.id ? [{ value: c.id, label: getContactDisplayName(c) }] : []),
    [contacts]
  );

  const projectOptions = useMemo<ComboboxOption[]>(
    () => projects.map(p => ({ value: p.id, label: p.name })),
    [projects]
  );

  const resetForm = () => {
    setTitle('');
    setType(CRM_TASK_TYPES.MEETING);
    setDate(initialDate ?? new Date());
    setTime('09:00');
    setEndDate(undefined);
    setReminderOffset('none');
    setContactId('');
    setProjectId('');
    setDescription('');
  };

  // Sync date + reset form on EVERY dialog open (not just initialDate change)
  useEffect(() => {
    if (open) {
      resetForm();
      if (initialDate) {
        setDate(initialDate);
      }
    }
    // resetForm is stable within render -- intentionally omitted from deps
  }, [open, initialDate]);

  const handleSubmit = async () => {
    if (!title.trim() || !date) return;

    setSubmitting(true);

    try {
      const dueDate = combineDateAndTime(date, time);

      const offsetMs = REMINDER_OFFSET_MS[reminderOffset];
      const reminderDate =
        offsetMs === null
          ? null
          : new Date(dueDate.getTime() - offsetMs).toISOString();

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
    <TaskDialogShell
      open={open}
      onOpenChange={onOpenChange}
      icon={Plus}
      title={t('calendarPage.dialog.createTitle')}
      onSubmit={handleSubmit}
      submitting={submitting}
      submitDisabled={!title.trim()}
    >
      <TaskFormField
        htmlFor="event-title"
        label={t('calendarPage.dialog.fields.title')}
        required
      >
        <Input
          id="event-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          autoFocus
        />
      </TaskFormField>

      {/* Type — Radix Select per ADR-001 */}
      <TaskFormField htmlFor="event-type" label={t('calendarPage.dialog.fields.type')}>
        <EnumSelect
          id="event-type"
          value={type}
          onValueChange={setType}
          values={CRM_TASK_TYPE_CREATABLE_VALUES}
          getLabel={(et) => t(`calendarPage.eventTypes.${et}`)}
        />
      </TaskFormField>

      <TaskFormField htmlFor="event-date" label={t('calendarPage.dialog.fields.date')}>
        <DatePickerField
          id="event-date"
          value={date}
          onSelect={setDate}
          placeholder={t('calendarPage.dialog.fields.date')}
        />
      </TaskFormField>

      <TaskFormField htmlFor="event-time" label={t('calendarPage.dialog.fields.time')}>
        <Input
          id="event-time"
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
        />
      </TaskFormField>

      {/* End Date — optional for multi-day events */}
      <TaskFormField htmlFor="event-end-date" label={t('calendarPage.dialog.fields.endDate')}>
        <DatePickerField
          id="event-end-date"
          value={endDate}
          onSelect={setEndDate}
          placeholder={t('calendarPage.dialog.fields.endDatePlaceholder')}
        />
      </TaskFormField>

      <TaskFormField htmlFor="event-reminder" label={t('calendarPage.reminders.label')}>
        <EnumSelect
          id="event-reminder"
          value={reminderOffset}
          onValueChange={setReminderOffset}
          values={REMINDER_OFFSET_VALUES}
          getLabel={(offset) => t(`calendarPage.reminders.${offset}`)}
        />
      </TaskFormField>

      <TaskFormField label={t('calendarPage.dialog.fields.contact')}>
        <SearchableCombobox
          value={contactId}
          onValueChange={(v) => setContactId(v)}
          options={contactOptions}
          placeholder={t('calendarPage.dialog.fields.contactPlaceholder')}
        />
      </TaskFormField>

      <TaskFormField label={t('calendarPage.dialog.fields.project')}>
        <SearchableCombobox
          value={projectId}
          onValueChange={(v) => setProjectId(v)}
          options={projectOptions}
          isLoading={projectsLoading}
          placeholder={t('calendarPage.dialog.fields.projectPlaceholder')}
        />
      </TaskFormField>

      <TaskFormField
        htmlFor="event-description"
        label={t('calendarPage.dialog.fields.description')}
        action={
          <VoiceMicButton
            onResult={(text) =>
              setDescription((prev) => (prev ? `${prev}\n${text}` : text))
            }
            disabled={submitting}
          />
        }
      >
        <Textarea
          id="event-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
        />
      </TaskFormField>
    </TaskDialogShell>
  );
}
