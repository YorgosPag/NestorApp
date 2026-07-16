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
import { useTranslation } from 'react-i18next';
import { Edit3 } from 'lucide-react';
import { useNotifications } from '@/providers/NotificationProvider';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('TaskEditDialog');

import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { DatePickerField } from '@/components/ui/date-picker-field';
import { EnumSelect } from '@/components/ui/enum-select';
import { TaskDialogShell } from '@/components/crm/shared/TaskDialogShell';
import { TaskFormField } from '@/components/crm/shared/TaskFormField';

import { updateTaskWithPolicy } from '@/services/crm/crm-mutation-gateway';
import { combineDateAndTime, splitDateAndTime } from '@/lib/date-local';
import {
  CRM_TASK_TYPES,
  CRM_TASK_TYPE_VALUES,
  CRM_TASK_STATUSES,
  CRM_TASK_STATUS_VALUES,
  CRM_TASK_PRIORITIES,
  CRM_TASK_PRIORITY_VALUES,
  type CrmTaskType,
  type CrmTaskStatus,
  type CrmTaskPriority,
} from '@/constants/crm-task-enums';
import type { CrmTask } from '@/types/crm';
import '@/lib/design-system';

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
// COMPONENT
// ============================================================================

export function TaskEditDialog({
  task,
  open,
  onOpenChange,
  onUpdated,
}: TaskEditDialogProps) {
  const { t } = useTranslation(['crm', 'crm-inbox']);
  const { success, error: notifyError } = useNotifications();

  const [title, setTitle] = useState('');
  const [type, setType] = useState<CrmTaskType>(CRM_TASK_TYPES.MEETING);
  const [status, setStatus] = useState<CrmTaskStatus>(CRM_TASK_STATUSES.PENDING);
  const [priority, setPriority] = useState<CrmTaskPriority>(CRM_TASK_PRIORITIES.MEDIUM);
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
    const parsed = splitDateAndTime(task.dueDate);
    setDate(parsed.date);
    setTime(parsed.time);
  }, [task]);

  const handleSubmit = async () => {
    if (!title.trim() || !date || !task.id) return;

    setSubmitting(true);

    try {
      const dueDate = combineDateAndTime(date, time);

      await updateTaskWithPolicy({
        taskId: task.id,
        updates: {
          title: title.trim(),
          type,
          status,
          priority,
          dueDate: dueDate.toISOString(),
          description: description.trim() || null,
        },
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
    <TaskDialogShell
      open={open}
      onOpenChange={onOpenChange}
      icon={Edit3}
      title={t('tasks.actions.edit')}
      onSubmit={handleSubmit}
      submitting={submitting}
      submitDisabled={!title.trim()}
    >
      <TaskFormField
        htmlFor="edit-task-title"
        label={t('calendarPage.dialog.fields.title')}
        required
      >
        <Input
          id="edit-task-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          autoFocus
        />
      </TaskFormField>

      {/* Type — το πλήρες set, ώστε ένα system-generated task (π.χ. complaint)
          να ανοίγει με τον τύπο του ορατό αντί για κενό dropdown. */}
      <TaskFormField htmlFor="edit-task-type" label={t('calendarPage.dialog.fields.type')}>
        <EnumSelect
          id="edit-task-type"
          value={type}
          onValueChange={setType}
          values={CRM_TASK_TYPE_VALUES}
          getLabel={(tt) => t(`calendarPage.eventTypes.${tt}`)}
        />
      </TaskFormField>

      <TaskFormField htmlFor="edit-task-status" label={t('tasks.status.label')}>
        <EnumSelect
          id="edit-task-status"
          value={status}
          onValueChange={setStatus}
          values={CRM_TASK_STATUS_VALUES}
          getLabel={(s) => t(`tasks.status.${s}`)}
        />
      </TaskFormField>

      <TaskFormField htmlFor="edit-task-priority" label={t('tasks.priority.label')}>
        <EnumSelect
          id="edit-task-priority"
          value={priority}
          onValueChange={setPriority}
          values={CRM_TASK_PRIORITY_VALUES}
          getLabel={(p) => t(`tasks.priority.${p}`)}
        />
      </TaskFormField>

      <TaskFormField htmlFor="edit-task-date" label={t('calendarPage.dialog.fields.date')}>
        <DatePickerField
          id="edit-task-date"
          value={date}
          onSelect={setDate}
          placeholder={t('calendarPage.dialog.fields.date')}
        />
      </TaskFormField>

      <TaskFormField htmlFor="edit-task-time" label={t('calendarPage.dialog.fields.time')}>
        <Input
          id="edit-task-time"
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
        />
      </TaskFormField>

      <TaskFormField
        htmlFor="edit-task-description"
        label={t('calendarPage.dialog.fields.description')}
      >
        <Textarea
          id="edit-task-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
        />
      </TaskFormField>
    </TaskDialogShell>
  );
}
