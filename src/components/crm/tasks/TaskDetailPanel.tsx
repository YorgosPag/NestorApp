'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { Clock, Calendar, User, MapPin, CalendarIcon, Plus, type LucideIcon } from 'lucide-react';
import { format } from 'date-fns';
import { el } from 'date-fns/locale';
import { EntityDetailsHeader, createEntityAction, type EntityHeaderAction } from '@/core/entity-headers';
import { DetailsContainer } from '@/core/containers';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar as CalendarPicker } from '@/components/ui/calendar';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import { TimePickerPopover } from './TimePickerPopover';
import { EnumSelect } from '@/components/ui/enum-select';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useNotifications } from '@/providers/NotificationProvider';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useAuth } from '@/auth/contexts/AuthContext';
import {
  completeTaskWithPolicy, createTaskWithPolicy, deleteTaskWithPolicy, updateTaskWithPolicy,
} from '@/services/crm/crm-mutation-gateway';
import {
  TASK_TYPE_ICONS,
  type ActivityItem,
} from '@/components/crm/dashboard/TasksTab';
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
import type { Opportunity, CrmTask } from '@/types/crm';

// ── Constants ──────────────────────────────────────────────────────────────────

function parseFlexibleDate(raw: string): Date | undefined {
  const s = raw.trim();
  if (!s) return undefined;
  const parts = s.split(/[\/\-\.\s]+/);
  if (parts.length !== 3) return undefined;
  const [dayStr, monthStr, yearStr] = parts;
  const day = parseInt(dayStr, 10);
  const month = parseInt(monthStr, 10);
  let year = parseInt(yearStr, 10);
  if (isNaN(day) || isNaN(month) || isNaN(year)) return undefined;
  if (day < 1 || day > 31 || month < 1 || month > 12) return undefined;
  if (year >= 0 && year < 100) year += 2000;
  if (year < 1900 || year > 2100) return undefined;
  const d = new Date(year, month - 1, day);
  if (d.getDate() !== day || d.getMonth() !== month - 1) return undefined;
  return d;
}

// ── Props ──────────────────────────────────────────────────────────────────────

interface TaskDetailPanelProps {
  activity: ActivityItem | null;
  leads?: Opportunity[];
  onActionCompleted?: () => void;
  onCreateTask?: () => void;
  isCreating?: boolean;
  onCreateCancel?: () => void;
}

// ── Component ──────────────────────────────────────────────────────────────────

export function TaskDetailPanel({
  activity, leads = [], onActionCompleted, onCreateTask,
  isCreating = false, onCreateCancel,
}: TaskDetailPanelProps) {
  const { t } = useTranslation(['crm']);
  const colors = useSemanticColors();
  const sp = useSpacingTokens();
  const { success, error: notifyError } = useNotifications();
  const { confirm, dialogProps } = useConfirmDialog();
  const { user } = useAuth();

  const [isEditing, setIsEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editType, setEditType] = useState<CrmTaskType>(CRM_TASK_TYPES.MEETING);
  const [editStatus, setEditStatus] = useState<CrmTaskStatus>(CRM_TASK_STATUSES.PENDING);
  const [editPriority, setEditPriority] = useState<CrmTaskPriority>(CRM_TASK_PRIORITIES.MEDIUM);
  const [editDate, setEditDate] = useState<Date | undefined>(new Date());
  const [editTime, setEditTime] = useState('09:00');
  const [editDescription, setEditDescription] = useState('');
  const [dateInputValue, setDateInputValue] = useState(format(new Date(), 'dd/MM/yyyy'));
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [timePickerOpen, setTimePickerOpen] = useState(false);
  const dateAnchorRef = React.useRef<HTMLDivElement>(null);

  const populateFromTask = useCallback((task: CrmTask) => {
    const parsed = splitDateAndTime(task.dueDate);
    setEditTitle(task.title);
    setEditType(task.type);
    setEditStatus(task.status);
    setEditPriority(task.priority);
    setEditDate(parsed.date);
    setEditTime(parsed.time);
    setEditDescription(task.description ?? '');
    setDateInputValue(format(parsed.date, 'dd/MM/yyyy'));
  }, []);

  // Reset to empty defaults when entering create mode
  useEffect(() => {
    if (!isCreating) return;
    const now = new Date();
    setEditTitle('');
    setEditType(CRM_TASK_TYPES.MEETING);
    setEditStatus(CRM_TASK_STATUSES.PENDING);
    setEditPriority(CRM_TASK_PRIORITIES.MEDIUM);
    setEditDate(now);
    setEditTime('09:00');
    setEditDescription('');
    setDateInputValue(format(now, 'dd/MM/yyyy'));
    setCalendarOpen(false);
    setTimePickerOpen(false);
  }, [isCreating]);

  // Populate from task when activity changes (skip during create mode)
  useEffect(() => {
    if (isCreating) return;
    setIsEditing(false);
    if (activity?.kind === 'task') populateFromTask(activity.task);
  }, [activity, populateFromTask, isCreating]);

  const getLeadName = useCallback(
    (leadId?: string) => leads.find(l => l.id === leadId)?.fullName ?? null,
    [leads]
  );

  const handleComplete = useCallback(async (task: CrmTask) => {
    try {
      await completeTaskWithPolicy({ taskId: task.id! });
      success(t('tasks.messages.completed', { title: task.title }));
      onActionCompleted?.();
    } catch { notifyError(t('tasks.messages.completeError')); }
  }, [t, success, notifyError, onActionCompleted]);

  const handleDelete = useCallback(async (task: CrmTask) => {
    const confirmed = await confirm({
      title: t('tasks.messages.deleteConfirm', { title: task.title }),
      description: t('tasks.messages.deleteConfirm', { title: task.title }),
      variant: 'destructive',
    });
    if (!confirmed) return;
    try {
      await deleteTaskWithPolicy({ taskId: task.id! });
      success(t('tasks.messages.deleted', { title: task.title }));
      onActionCompleted?.();
    } catch { notifyError(t('tasks.messages.deleteError')); }
  }, [t, confirm, success, notifyError, onActionCompleted]);

  const handleCancelEdit = useCallback((task: CrmTask) => {
    populateFromTask(task);
    setIsEditing(false);
  }, [populateFromTask]);

  const handleCalendarSelect = useCallback((date: Date | undefined) => {
    setEditDate(date);
    setDateInputValue(date ? format(date, 'dd/MM/yyyy') : '');
    setCalendarOpen(false);
  }, []);

  const handleSaveEdit = useCallback(async (taskId: string) => {
    if (!editTitle.trim() || !editDate) return;
    setSubmitting(true);
    try {
      const due = combineDateAndTime(editDate, editTime);
      await updateTaskWithPolicy({
        taskId,
        updates: {
          title: editTitle.trim(), type: editType, status: editStatus,
          priority: editPriority, dueDate: due.toISOString(),
          description: editDescription.trim() || null,
        },
      });
      success(t('tasks.messages.updated', { title: editTitle.trim() }));
      setIsEditing(false);
      onActionCompleted?.();
    } catch (err) {
      notifyError(err instanceof Error ? err.message : t('tasks.messages.updateError'));
    } finally { setSubmitting(false); }
  }, [editTitle, editDate, editTime, editType, editStatus, editPriority, editDescription, t, success, notifyError, onActionCompleted]);

  const handleSaveCreate = useCallback(async () => {
    if (!editTitle.trim() || !editDate) return;
    setSubmitting(true);
    try {
      const due = combineDateAndTime(editDate, editTime);
      await createTaskWithPolicy({
        data: {
          title: editTitle.trim(), type: editType, status: editStatus,
          priority: editPriority, dueDate: due.toISOString(),
          description: editDescription.trim() || null,
          assignedTo: user?.uid ?? '',
        },
      });
      success(t('tasks.messages.created', { title: editTitle.trim() }));
      onActionCompleted?.();
    } catch (err) {
      notifyError(err instanceof Error ? err.message : t('tasks.messages.createError'));
    } finally { setSubmitting(false); }
  }, [editTitle, editDate, editTime, editType, editStatus, editPriority, editDescription, user, t, success, notifyError, onActionCompleted]);

  // ── Shared form fields renderer (create + edit modes) ─────────────────────

  const renderFormFields = (disabled: boolean) => (
    <>
      <fieldset className="space-y-1">
        <Label htmlFor="task-title">{t('tasks.form.fields.title')} *</Label>
        <Input
          id="task-title" value={editTitle} onChange={(e) => setEditTitle(e.target.value)}
          disabled={disabled} required autoFocus={!disabled}
        />
      </fieldset>
      <div className="grid grid-cols-2 gap-3">
        <fieldset className="space-y-1">
          <Label htmlFor="task-type">{t('tasks.form.fields.type')}</Label>
          <EnumSelect
            id="task-type"
            value={editType}
            onValueChange={setEditType}
            values={CRM_TASK_TYPE_VALUES}
            getLabel={(tt) => t(`tasks.type.${tt}`)}
            disabled={disabled}
          />
        </fieldset>
        <fieldset className="space-y-1">
          <Label htmlFor="task-status">{t('tasks.status.label')}</Label>
          <EnumSelect
            id="task-status"
            value={editStatus}
            onValueChange={setEditStatus}
            values={CRM_TASK_STATUS_VALUES}
            getLabel={(s) => t(`tasks.status.${s}`)}
            disabled={disabled}
          />
        </fieldset>
      </div>
      <fieldset className="space-y-1">
        <Label htmlFor="task-priority">{t('tasks.priority.label')}</Label>
        <EnumSelect
          id="task-priority"
          value={editPriority}
          onValueChange={setEditPriority}
          values={CRM_TASK_PRIORITY_VALUES}
          getLabel={(p) => t(`tasks.priority.${p}`)}
          disabled={disabled}
        />
      </fieldset>
      <div className="grid grid-cols-2 gap-3">
        <fieldset className="space-y-1">
          <Label htmlFor="task-date">{t('tasks.form.fields.date')}</Label>
          <Popover open={!disabled && calendarOpen} onOpenChange={(o) => !disabled && setCalendarOpen(o)}>
            <PopoverAnchor asChild>
              <div ref={dateAnchorRef} className="relative">
                <button
                  type="button"
                  disabled={disabled}
                  tabIndex={-1}
                  onClick={() => { if (!disabled) setCalendarOpen(true); }}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors disabled:pointer-events-none disabled:opacity-40"
                >
                  <CalendarIcon className="h-4 w-4" />
                </button>
                <Input
                  id="task-date"
                  hasLeftIcon
                  value={dateInputValue}
                  onChange={(e) => {
                    setDateInputValue(e.target.value);
                    const parsed = parseFlexibleDate(e.target.value);
                    if (parsed) setEditDate(parsed);
                  }}
                  onFocus={(e) => { const el = e.currentTarget; setTimeout(() => el.select(), 0); }}
                  onClick={(e) => { const el = e.currentTarget; setTimeout(() => el.select(), 0); if (!disabled) setCalendarOpen(true); }}
                  onBlur={() => { if (editDate) setDateInputValue(format(editDate, 'dd/MM/yyyy')); }}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') { e.preventDefault(); setCalendarOpen(false); return; }
                    if (e.key === 'Enter') {
                      setCalendarOpen(false);
                      if (editDate) setDateInputValue(format(editDate, 'dd/MM/yyyy'));
                      // Let event bubble → form's onSubmit fires via hidden submit button
                    }
                  }}
                  placeholder={t('tasks.form.placeholders.date')}
                  disabled={disabled}
                />
              </div>
            </PopoverAnchor>
            <PopoverContent
              className="w-auto p-0"
              align="start"
              onInteractOutside={(e) => {
                if (dateAnchorRef.current?.contains(e.target as Node)) e.preventDefault();
              }}
            >
              <CalendarPicker mode="single" selected={editDate} onSelect={handleCalendarSelect} />
            </PopoverContent>
          </Popover>
        </fieldset>
        <fieldset className="space-y-1">
          <Label htmlFor="task-time">{t('tasks.form.fields.time')}</Label>
          <TimePickerPopover
            inputId="task-time"
            value={editTime}
            onChange={setEditTime}
            disabled={disabled}
            open={timePickerOpen}
            onOpenChange={setTimePickerOpen}
            placeholder={t('tasks.form.placeholders.time')}
          />
        </fieldset>
      </div>
      <fieldset className="space-y-1">
        <Label htmlFor="task-desc">{t('tasks.form.fields.description')}</Label>
        <Textarea id="task-desc" value={editDescription} onChange={(e) => setEditDescription(e.target.value)} rows={3} disabled={disabled} />
      </fieldset>
    </>
  );

  // ── Derive header + body ───────────────────────────────────────────────────

  let headerEl: React.ReactNode = undefined;
  let bodyEl: React.ReactNode = undefined;

  if (isCreating) {
    const createSaveAction: EntityHeaderAction = {
      ...createEntityAction('save', t('tasks.actions.save'), handleSaveCreate),
      disabled: submitting || !editTitle.trim(),
    };
    headerEl = (
      <EntityDetailsHeader
        icon={Plus}
        title={t('tasks.newTask')}
        actions={[createSaveAction, createEntityAction('cancel', t('tasks.actions.cancel'), () => onCreateCancel?.())]}
        variant="detailed"
      />
    );
    bodyEl = (
      <form className={`${sp.padding.md} space-y-3`} onSubmit={(e) => { e.preventDefault(); void handleSaveCreate(); }}>
        <button type="submit" className="hidden" tabIndex={-1} aria-hidden="true" />
        {renderFormFields(false)}
      </form>
    );
  } else if (activity?.kind === 'appointment') {
    const { appt, title, date } = activity;
    const dateLabel = date ? format(date, 'dd/MM/yyyy HH:mm', { locale: el }) : t('tasks.noDate');
    headerEl = <EntityDetailsHeader icon={Calendar} title={title} variant="detailed" />;
    bodyEl = (
      <div className={`${sp.padding.md} space-y-3`}>
        <div className={`flex items-center gap-2 text-sm ${colors.text.muted}`}>
          <Clock className="h-4 w-4 flex-shrink-0" />
          <span className={colors.text.info}>{dateLabel}</span>
        </div>
        {appt.requester?.name && (
          <div className={`flex items-center gap-2 text-sm ${colors.text.muted}`}>
            <User className="h-4 w-4 flex-shrink-0" />
            <span>{appt.requester.name}</span>
          </div>
        )}
      </div>
    );
  } else if (activity?.kind === 'task') {
    const { task } = activity;
    const TaskIcon = (TASK_TYPE_ICONS[task.type] ?? Clock) as LucideIcon;
    const leadName = getLeadName(task.leadId);
    const meta = (task.metadata ?? {}) as Record<string, unknown>;
    const location = typeof meta.location === 'string' ? meta.location : null;
    const isCompleted = task.status === 'completed';

    const viewActions = [
      ...(!isCompleted ? [createEntityAction('complete', t('tasks.actions.complete'), () => handleComplete(task))] : []),
      createEntityAction('edit', t('tasks.actions.edit'), () => setIsEditing(true)),
      createEntityAction('new', t('tasks.newTask'), () => { onCreateTask?.(); }),
      createEntityAction('delete', t('tasks.actions.delete'), () => handleDelete(task)),
    ];
    const saveAction: EntityHeaderAction = {
      ...createEntityAction('save', t('tasks.actions.save'), () => handleSaveEdit(task.id!)),
      disabled: submitting || !editTitle.trim(),
    };

    headerEl = (
      <EntityDetailsHeader
        icon={TaskIcon}
        title={isEditing ? editTitle || task.title : task.title}
        actions={isEditing
          ? [saveAction, createEntityAction('cancel', t('tasks.actions.cancel'), () => handleCancelEdit(task))]
          : viewActions}
        variant="detailed"
      />
    );
    bodyEl = (
      <form
        className={`${sp.padding.md} space-y-3`}
        onSubmit={(e) => { e.preventDefault(); if (isEditing) void handleSaveEdit(task.id!); }}
      >
        <button type="submit" className="hidden" tabIndex={-1} aria-hidden="true" />
        {renderFormFields(!isEditing)}
        {(leadName ?? location) && (
          <div className={`flex flex-col gap-2 pt-2 border-t text-sm ${colors.text.muted}`}>
            {leadName && <div className="flex items-center gap-2"><User className="h-4 w-4 flex-shrink-0" /><span>{leadName}</span></div>}
            {location && <div className="flex items-center gap-2"><MapPin className="h-4 w-4 flex-shrink-0" /><span>{location}</span></div>}
          </div>
        )}
      </form>
    );
  }

  return (
    <>
      <ConfirmDialog {...dialogProps} />
      <DetailsContainer
        selectedItem={(activity ? { id: activity.kind === 'task' ? activity.task.id : (activity.appt as { id?: string }).id ?? '' } : (isCreating ? { id: 'creating' } : null))}
        emptyStateProps={{
          icon: Clock,
          title: t('tasks.emptyState.title'),
          description: t('tasks.emptyState.description'),
        }}
        onCreateAction={onCreateTask}
        header={headerEl}
        tabsRenderer={bodyEl}
      />
    </>
  );
}

export default TaskDetailPanel;
