/**
 * @fileoverview **Η ΟΨΗ ΤΗΣ ΣΟΒΑΡΟΤΗΤΑΣ** — εικονίδιο + χρώμα κειμένου ανά `Severity`, για το συρτάρι **και**
 * τη σελίδα Inbox (ADR-927). Ζούσε μέσα στο συρτάρι· δεύτερο αντίγραφο στη σελίδα θα απέκλινε.
 * @module components/notifications/notification-severity
 *
 * ⚠️ `Record`, όχι `Partial`: νέα σοβαρότητα χωρίς όψη **δεν μεταγλωττίζεται**. Το χρώμα δεν είναι το μόνο
 *    κανάλι (ADR-771): το εικονίδιο διαφέρει ανά σοβαρότητα.
 */

import type { ComponentType } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle, Info } from 'lucide-react';
import type { Severity } from '@/types/notification';

export const SEVERITY_ICON: Readonly<Record<Severity, ComponentType<{ className?: string }>>> = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
  critical: AlertCircle,
};

export const SEVERITY_TEXT_CLASS: Readonly<Record<Severity, string>> = {
  success: 'text-[hsl(var(--text-success))]',
  error: 'text-destructive',
  warning: 'text-[hsl(var(--text-warning))]',
  // ADR-770: ήταν `text-primary` — στο σκοτεινό θέμα το `--primary` ταυτίζεται με το `--card` ⇒ αόρατο.
  info: 'text-[hsl(var(--text-info))]',
  critical: 'text-destructive',
};
