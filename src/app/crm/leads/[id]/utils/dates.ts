'use client';

import { format, isToday, isTomorrow, isPast } from 'date-fns';
import { el } from 'date-fns/locale';
import { formatDateTime } from '@/lib/intl-utils';
import type { FirestoreishTimestamp } from '@/types/crm';
import i18n from '@/i18n/config';
import { getStatusColor } from '@/lib/design-system';
import { COLOR_BRIDGE } from '@/design-system/color-bridge';

// ?? ENTERPRISE: Type guard for Firestore timestamps with toDate() method
interface FirestoreTimestampLike {
  toDate: () => Date;
}

function isFirestoreTimestamp(value: unknown): value is FirestoreTimestampLike {
  return value !== null &&
         typeof value === 'object' &&
         'toDate' in value &&
         typeof (value as FirestoreTimestampLike).toDate === 'function';
}

const unknownDateLabel = i18n.t('opportunities.unknownDate', { ns: 'crm' });
const noDateLabel = i18n.t('tasks.noDate', { ns: 'crm' });
const todayLabel = i18n.t('tasks.today', { ns: 'crm' });
const tomorrowLabel = i18n.t('tasks.tomorrow', { ns: 'crm' });
const overdueLabel = i18n.t('tasks.overdue', { ns: 'crm' });
const mutedTextClass = COLOR_BRIDGE.text.muted;

// ? ENTERPRISE MIGRATION COMPLETE: formatDate now uses centralized intl-utils
export const formatDate = (timestamp?: FirestoreishTimestamp) => {
  if (!timestamp) return unknownDateLabel;
  try {
    // ?? ENTERPRISE: Type-safe timestamp conversion
    let date: Date;
    if (timestamp instanceof Date) {
      date = timestamp;
    } else if (typeof timestamp === 'string') {
      date = new Date(timestamp);
    } else if (isFirestoreTimestamp(timestamp)) {
      date = timestamp.toDate();
    } else {
      return unknownDateLabel;
    }
    return formatDateTime(date);
  } catch {
    return unknownDateLabel;
  }
};

export const getTaskDateColor = (dueDate?: FirestoreishTimestamp | null, status?: string) => {
  if (status === 'completed') return getStatusColor('success', 'text');
  if (!dueDate) return mutedTextClass;
  try {
    const date = dueDate instanceof Date ? dueDate : new Date(dueDate as string);
    if (isNaN(date.getTime())) return mutedTextClass;
    if (isPast(date) && !isToday(date)) return getStatusColor('error', 'text');
    if (isToday(date)) return getStatusColor('info', 'text');
    if (isTomorrow(date)) return getStatusColor('warning', 'text');
    return mutedTextClass;
  } catch {
    return mutedTextClass;
  }
};

export const formatTaskDate = (dueDate?: FirestoreishTimestamp | null) => {
  if (!dueDate) return noDateLabel;
  try {
    const date = dueDate instanceof Date ? dueDate : new Date(dueDate as string);
    if (isNaN(date.getTime())) return unknownDateLabel;
    if (isToday(date)) return `${todayLabel} ${format(date, 'HH:mm')}`;
    if (isTomorrow(date)) return `${tomorrowLabel} ${format(date, 'HH:mm')}`;
    if (isPast(date)) return `${overdueLabel} ${format(date, 'dd/MM HH:mm')}`;
    return format(date, 'dd/MM/yyyy HH:mm', { locale: el });
  } catch {
    return unknownDateLabel;
  }
};
