/**
 * CRM Task Activity — Shared constants and types
 * SSoT for task/appointment card data, consumed by TasksTab + TaskListCard.
 * Extracted to break the circular dep: TasksTab ↔ TaskListCard.
 */

import { Phone, Users, Calendar, Mail, FileText, AlertCircle, Clock } from 'lucide-react';
import { format, parse, isValid } from 'date-fns';
import type React from 'react';
import type { CrmTaskType, CrmTaskPriority, CrmTaskStatus } from '@/types/crm-extra';
import type { AppointmentDocument } from '@/types/appointment';
import type { CrmTask } from '@/types/crm';

export const TASK_TYPE_ICONS: Record<CrmTaskType, React.ElementType> = {
  call: Phone,
  meeting: Users,
  viewing: Calendar,
  follow_up: AlertCircle,
  email: Mail,
  document: FileText,
  complaint: AlertCircle,
  other: Clock,
};

export const PRIORITY_BADGE_VARIANT: Record<CrmTaskPriority, 'success' | 'warning' | 'info' | 'error'> = {
  low: 'success',
  medium: 'warning',
  high: 'info',
  urgent: 'error',
};

export const STATUS_BADGE_VARIANT: Record<CrmTaskStatus, 'info' | 'warning' | 'success' | 'muted'> = {
  pending: 'info',
  in_progress: 'warning',
  completed: 'success',
  cancelled: 'muted',
};

export type ActivityItem =
  | { kind: 'task'; task: CrmTask; sortDate: number }
  | { kind: 'appointment'; appt: AppointmentDocument; sortDate: number; title: string; date: Date | null };

export function resolveAppointmentDate(appt: AppointmentDocument): Date | null {
  const flat = appt as unknown as Record<string, unknown>;
  const rawDate =
    appt.appointment?.confirmedDate ??
    appt.appointment?.requestedDate ??
    (flat['date'] as string | undefined);
  if (!rawDate) return null;
  let dateStr = rawDate;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(rawDate)) {
    const parsed = parse(rawDate, 'dd/MM/yyyy', new Date());
    if (!isValid(parsed)) return null;
    dateStr = format(parsed, 'yyyy-MM-dd');
  }
  const timeStr =
    appt.appointment?.confirmedTime ??
    appt.appointment?.requestedTime ??
    (flat['time'] as string | undefined) ??
    '09:00';
  const dt = new Date(`${dateStr}T${timeStr}:00`);
  return isNaN(dt.getTime()) ? null : dt;
}
