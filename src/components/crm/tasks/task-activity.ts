/**
 * CRM Task Activity — Shared constants and types
 * SSoT for task/appointment card data, consumed by TasksTab + TaskListCard.
 * Extracted to break the circular dep: TasksTab ↔ TaskListCard.
 */

import { Phone, Users, Calendar, Mail, FileText, AlertCircle, Clock } from 'lucide-react';
import type React from 'react';
import { appointmentStartAt } from '@/services/appointments/appointment-schedule';
import type { AppointmentDocument } from '@/types/appointment';
import type { CrmTask, CrmTaskType, CrmTaskPriority, CrmTaskStatus } from '@/types/crm';

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

export const PRIORITY_BADGE_VARIANT: Record<CrmTaskPriority, 'success' | 'warning' | 'info' | 'destructive'> = {
  low: 'success',
  medium: 'warning',
  high: 'info',
  urgent: 'destructive',
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

/**
 * ADR-869 §12 — εδώ ζούσε το **ΤΡΙΤΟ** αντίγραφο της ερώτησης «πότε είναι αυτό;», με δικό
 * του κανονικοποιητή και δική του προεπιλογή ώρας. Πλέον **δείχνει** στον ιδιοκτήτη.
 */
export function resolveAppointmentDate(appt: AppointmentDocument): Date | null {
  return appointmentStartAt(appt);
}
