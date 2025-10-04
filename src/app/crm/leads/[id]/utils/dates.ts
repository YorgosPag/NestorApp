
'use client';

import { format, isToday, isTomorrow, isPast } from 'date-fns';
import { el } from 'date-fns/locale';
import type { FirestoreishTimestamp } from '@/types/crm';

export const formatDate = (timestamp?: FirestoreishTimestamp) => {
  if (!timestamp) return 'Άγνωστη ημερομηνία';
  try {
    const date = timestamp instanceof Date 
        ? timestamp 
        : typeof timestamp === 'string'
        ? new Date(timestamp)
        : (timestamp as any).toDate();
    return format(date, 'dd MMMM yyyy, HH:mm', { locale: el });
  } catch (err) {
    return 'Άγνωστη ημερομηνία';
  }
};

export const getTaskDateColor = (dueDate?: FirestoreishTimestamp | null, status?: string) => {
    if (status === 'completed') return 'text-green-600';
    if (!dueDate) return 'text-gray-600 dark:text-gray-400';
    try {
        const date = dueDate instanceof Date ? dueDate : new Date(dueDate as string);
        if (isNaN(date.getTime())) return 'text-gray-600 dark:text-gray-400';
        if (isPast(date) && !isToday(date)) return 'text-red-600';
        if (isToday(date)) return 'text-blue-600';
        if (isTomorrow(date)) return 'text-purple-600';
        return 'text-gray-600 dark:text-gray-400';
    } catch {
        return 'text-gray-600 dark:text-gray-400';
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
