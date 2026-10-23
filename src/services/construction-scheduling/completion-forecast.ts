/**
 * @module completion-forecast
 * @enterprise ADR-919 βήμα 2 · ADR-777 §8.99.4 (Δ1: «το χρονοδιάγραμμα **προτείνει**»)
 *
 * **Πότε προβλέπεται να ολοκληρωθεί ένα κτίριο**, από τις φάσεις και τις εργασίες του, με
 * ημερομηνία κατάστασης (`status-date-rule.ts`). Καθαρή συνάρτηση: χωρίς δίκτυο, χωρίς ρολόι.
 *
 * ⛔ **ΕΣΩΤΕΡΙΚΗ ΓΝΩΣΗ.** Η πρόβλεψη είναι **πρόταση** προς τον άνθρωπο (`inferred`, ADR-842 Α7)
 * και αφορμή για προειδοποίηση απόκλισης. Ποτέ δημόσια χωρίς έγκριση, και ποτέ μαζί της οι
 * φάσεις, η καθυστέρηση ή τα αίτιά της (§8.99.4, ιδιωτικότητα).
 *
 * 🔑 **Οι φάσεις χωρίς εργασίες κρίνονται μόνες τους.** Δεν δηλώνουν εξαρτήσεις και μπορούν
 * να επικαλύπτονται, άρα το `order` **δεν** είναι αλυσίδα: αν τις δέναμε σειριακά θα
 * εφευρίσκαμε λογική που κανείς δεν δήλωσε. Οι φάσεις **με** εργασίες κρίνονται από το CPM,
 * που ξέρει τις εξαρτήσεις των εργασιών.
 */

import type { ConstructionPhase, ConstructionTask } from '@/types/building/construction';
import { computeCPM } from './cpm-calculator';
import { daysBetween, isReadableDate, maxDate, toIsoDay } from './schedule-dates';
import {
  activityWindowAt,
  isBlockedActivity,
  isCompletedActivity,
  type ScheduledActivity,
} from './status-date-rule';

export type CompletionForecast =
  /** Καμία φάση: δεν υπάρχει χρονοδιάγραμμα για να προτείνει κάτι. */
  | { readonly kind: 'no-schedule' }
  /** Όλα ολοκληρωμένα. */
  | { readonly kind: 'completed'; readonly completedOn: string }
  | {
      readonly kind: 'forecast';
      /** Η προβλεπόμενη ολοκλήρωση (ISO ημέρα). */
      readonly finish: string;
      /** Το τέλος του σχεδίου. Μόνο για εσωτερική σύγκριση. */
      readonly plannedFinish: string;
      /** `finish − plannedFinish` σε ημέρες· αρνητικό = μπροστά από το σχέδιο. */
      readonly slipDays: number;
      readonly basis: 'tasks' | 'phases' | 'mixed';
      /** Κάτι ανοιχτό είναι μπλοκαρισμένο: η ημερομηνία είναι το **νωρίτερο**, όχι εκτίμηση. */
      readonly isLowerBound: boolean;
    }
  /** Δεν βγαίνει έντιμη ημερομηνία· ποτέ ψεύτικη στη θέση της. */
  | { readonly kind: 'unreliable'; readonly reason: 'cyclic-dependencies' | 'invalid-dates' };

interface Contribution {
  readonly finish: Date;
  readonly open: boolean;
  readonly blocked: boolean;
}

function hasReadableDates(activity: ScheduledActivity): boolean {
  return isReadableDate(activity.plannedStartDate) && isReadableDate(activity.plannedEndDate);
}

function contributionOf(activity: ScheduledActivity, finish: Date): Contribution {
  return { finish, open: !isCompletedActivity(activity), blocked: isBlockedActivity(activity) };
}

/** Οι εργασίες, μέσα από το CPM με ημερομηνία κατάστασης. `null` = κυκλική εξάρτηση. */
function taskContributions(tasks: ConstructionTask[], phases: ConstructionPhase[], statusDate: string): Contribution[] | null {
  if (tasks.length === 0) return [];
  const cpm = computeCPM(tasks, phases, { statusDate });
  if (cpm.cyclicTaskIds.length > 0) return null;
  const byId = new Map(tasks.map(task => [task.id, task]));
  return cpm.tasks.map(result => contributionOf(byId.get(result.taskId)!, new Date(result.earlyFinish)));
}

function phaseContributions(phases: ConstructionPhase[], statusDate: Date): Contribution[] {
  return phases.map(phase =>
    contributionOf(phase, activityWindowAt(phase, statusDate, new Date(phase.plannedStartDate)).finish),
  );
}

function basisOf(withTasks: number, withoutTasks: number): 'tasks' | 'phases' | 'mixed' {
  if (withoutTasks === 0) return 'tasks';
  return withTasks === 0 ? 'phases' : 'mixed';
}

/** Η πρόβλεψη ολοκλήρωσης του κτιρίου στην ημερομηνία κατάστασης `statusDate` (ISO). */
export function forecastCompletion(
  phases: ConstructionPhase[],
  tasks: ConstructionTask[],
  statusDate: string,
): CompletionForecast {
  if (phases.length === 0) return { kind: 'no-schedule' };
  if (!isReadableDate(statusDate) || ![...phases, ...tasks].every(hasReadableDates)) {
    return { kind: 'unreliable', reason: 'invalid-dates' };
  }

  const phaseIds = new Set(phases.map(phase => phase.id));
  const ownTasks = tasks.filter(task => phaseIds.has(task.phaseId));
  const phasesWithTasks = new Set(ownTasks.map(task => task.phaseId));
  const loosePhases = phases.filter(phase => !phasesWithTasks.has(phase.id));

  const fromTasks = taskContributions(ownTasks, phases, statusDate);
  if (fromTasks === null) return { kind: 'unreliable', reason: 'cyclic-dependencies' };
  const all = [...fromTasks, ...phaseContributions(loosePhases, new Date(statusDate))];

  const finish = maxDate(...all.map(c => c.finish));
  if (!all.some(c => c.open)) return { kind: 'completed', completedOn: toIsoDay(finish) };

  const plannedFinish = maxDate(...[...phases, ...ownTasks].map(a => new Date(a.plannedEndDate)));
  return {
    kind: 'forecast',
    finish: toIsoDay(finish),
    plannedFinish: toIsoDay(plannedFinish),
    slipDays: daysBetween(plannedFinish, finish),
    basis: basisOf(phasesWithTasks.size, loosePhases.length),
    isLowerBound: all.some(c => c.open && c.blocked),
  };
}
