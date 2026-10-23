/**
 * @module status-date-rule
 * @enterprise ADR-919 βήμα 2 · ADR-266 (CPM)
 *
 * **Ο κανόνας της ημερομηνίας κατάστασης** (data date, Primavera P6 / MS Project): ό,τι δεν
 * έχει τελειώσει **δεν μπορεί να τελειώσει πριν από σήμερα**. Ένας κανόνας για εργασίες
 * (μέσα στο CPM) και για φάσεις χωρίς εργασίες (στην πρόβλεψη ολοκλήρωσης).
 *
 * | Κατάσταση | Έναρξη | Λήξη |
 * |---|---|---|
 * | ολοκληρωμένη | πραγματική ή προγραμματισμένη | πραγματική ή προγραμματισμένη |
 * | ξεκίνησε | πραγματική ή προγραμματισμένη | σήμερα + υπόλοιπη διάρκεια |
 * | δεν ξεκίνησε | max(προγραμματισμένη, σήμερα, τέλος προκατόχων) | έναρξη + διάρκεια |
 *
 * Υπόλοιπη διάρκεια = ⌈διάρκεια × (1 − πρόοδος/100)⌉. «Ξεκίνησε» σημαίνει πραγματική έναρξη,
 * πρόοδο πάνω από 0 ή κατάσταση `inProgress`. Μια `delayed`/`blocked` χωρίς τίποτα από αυτά
 * δεν έχει ξεκινήσει, άρα αρχίζει το νωρίτερο σήμερα.
 */

import { addDaysUtc, daysBetween, maxDate } from './schedule-dates';

/** Ό,τι κοινό έχουν φάση και εργασία για τον κανόνα. */
export interface ScheduledActivity {
  readonly status: string;
  readonly plannedStartDate: string;
  readonly plannedEndDate: string;
  readonly actualStartDate?: string | null;
  readonly actualEndDate?: string | null;
  readonly progress: number;
}

export interface ActivityWindow {
  readonly start: Date;
  readonly finish: Date;
}

/** Η προγραμματισμένη διάρκεια σε ημέρες, τουλάχιστον 1 (ίδιος κανόνας με το CPM). */
export function plannedDurationDays(activity: ScheduledActivity): number {
  return Math.max(1, daysBetween(activity.plannedStartDate, activity.plannedEndDate));
}

export function isCompletedActivity(activity: ScheduledActivity): boolean {
  return activity.status === 'completed';
}

/** Ανοιχτή και μπλοκαρισμένη: η πρόβλεψη είναι τότε μόνο το νωρίτερο δυνατό. */
export function isBlockedActivity(activity: ScheduledActivity): boolean {
  return activity.status === 'blocked' && !isCompletedActivity(activity);
}

function hasStarted(activity: ScheduledActivity): boolean {
  return Boolean(activity.actualStartDate) || activity.progress > 0 || activity.status === 'inProgress';
}

function remainingDays(activity: ScheduledActivity): number {
  const progress = Math.min(100, Math.max(0, activity.progress));
  return Math.ceil(plannedDurationDays(activity) * (1 - progress / 100));
}

/**
 * Πότε τρέχει η δραστηριότητα, δεδομένης της ημερομηνίας κατάστασης.
 * `earliestStart` = το τέλος των προκατόχων (ή η προγραμματισμένη έναρξη, αν δεν έχει).
 */
export function activityWindowAt(
  activity: ScheduledActivity,
  statusDate: Date,
  earliestStart: Date,
): ActivityWindow {
  const recordedStart = new Date(activity.actualStartDate || activity.plannedStartDate);

  if (isCompletedActivity(activity)) {
    return { start: recordedStart, finish: new Date(activity.actualEndDate || activity.plannedEndDate) };
  }
  if (hasStarted(activity)) {
    return { start: recordedStart, finish: addDaysUtc(statusDate, remainingDays(activity)) };
  }
  const start = maxDate(new Date(activity.plannedStartDate), statusDate, earliestStart);
  return { start, finish: addDaysUtc(start, plannedDurationDays(activity)) };
}
