
'use client';

import { format, isToday, isTomorrow, isPast } from 'date-fns';
import { el } from 'date-fns/locale';
import { formatDateTime } from '@/lib/intl-utils';
import type { FirestoreishTimestamp } from '@/types/crm';
import { hardcodedColorValues } from '@/design-system/tokens/colors';

// 🏢 ENTERPRISE: Type guard for Firestore timestamps with toDate() method
interface FirestoreTimestampLike {
  toDate: () => Date;
}

function isFirestoreTimestamp(value: unknown): value is FirestoreTimestampLike {
  return value !== null &&
         typeof value === 'object' &&
         'toDate' in value &&
         typeof (value as FirestoreTimestampLike).toDate === 'function';
}

// ✅ ENTERPRISE MIGRATION COMPLETE: formatDate now uses centralized intl-utils
export const formatDate = (timestamp?: FirestoreishTimestamp) => {
  if (!timestamp) return 'Άγνωστη ημερομηνία';
  try {
    // 🏢 ENTERPRISE: Type-safe timestamp conversion
    let date: Date;
    if (timestamp instanceof Date) {
      date = timestamp;
    } else if (typeof timestamp === 'string') {
      date = new Date(timestamp);
    } else if (isFirestoreTimestamp(timestamp)) {
      date = timestamp.toDate();
    } else {
      return 'Άγνωστη ημερομηνία';
    }
    return formatDateTime(date);
  } catch (err) {
    return 'Άγνωστη ημερομηνία';
  }
};

export const getTaskDateColor = (dueDate?: FirestoreishTimestamp | null, status?: string) => {
    if (status === 'completed') return 'text-green-600';
    if (!dueDate) return hardcodedColorValues.text.muted; // ✅ ENTERPRISE: Uses centralized semantic system
    try {
        const date = dueDate instanceof Date ? dueDate : new Date(dueDate as string);
        if (isNaN(date.getTime())) return hardcodedColorValues.text.muted; // ✅ ENTERPRISE: Uses centralized semantic system
        if (isPast(date) && !isToday(date)) return 'text-red-600';
        if (isToday(date)) return 'text-blue-600';
        if (isTomorrow(date)) return 'text-purple-600';
        return hardcodedColorValues.text.muted; // ✅ ENTERPRISE: Uses centralized semantic system
    } catch {
        return hardcodedColorValues.text.muted; // ✅ ENTERPRISE: Uses centralized semantic system
    }
};

export const formatTaskDate = (dueDate?: FirestoreishTimestamp | null) => {
    if (!dueDate) return 'Χωρίς ημερομηνία';
    try {
        const date = dueDate instanceof Date ? dueDate : new Date(dueDate as string);
        if (isNaN(date.getTime())) return 'Άγνωστη ημερομηνία';
        if (isToday(date)) return `Σήμερα ${format(date, 'HH:mm')}`;
        if (isTomorrow(date)) return `Αύριο ${format(date, 'HH:mm')}`;
        if (isPast(date)) return `Εκπρόθεσμη ${format(date, 'dd/MM HH:mm')}`;
        return format(date, 'dd/MM/yyyy HH:mm', { locale: el });
    } catch (err) {
        return 'Άγνωστη ημερομηνία';
    }
};
