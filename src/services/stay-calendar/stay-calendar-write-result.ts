/**
 * @fileoverview **Η ΕΚΒΑΣΗ ΜΙΑΣ ΕΓΓΡΑΦΗΣ ΣΤΟ ΗΜΕΡΟΛΟΓΙΟ** — κλειστή ένωση, κάθε άρνηση
 *   με όνομα.
 * @related ADR-835 §20 (Στάδιο Α) · services/stay-calendar/stay-calendar-write.service.ts ·
 *   app/api/owner-properties/[ownerPropertyId]/stay-calendar/route.ts
 * @module services/stay-calendar/stay-calendar-write-result
 *
 * **Layering**: leaf — τύποι + καθαρές συναρτήσεις. Ζει χωριστά από την υπηρεσία ώστε η
 * οθόνη να εισάγει τον τύπο **χωρίς** `server-only`.
 */

import type { StayCalendarVerdict } from '@/lib/stay/stay-conflict';
import { isRecord } from '@/lib/type-guards';
import { isStayRuleWarningKind, type StayRuleWarningKind } from '@/lib/stay/stay-rule-warnings';

/**
 * **Με τι συγκρούστηκε** — ό,τι χρειάζεται η οθόνη για να πει «πέφτει πάνω στην κράτηση
 * 14–18/10», και **τίποτα** παραπάνω: ούτε όνομα επισκέπτη, ούτε σημείωση.
 */
export interface StayCalendarConflictView {
  readonly entryKind: 'booking' | 'block';
  readonly entryId: string;
  readonly from: string;
  readonly to: string;
}

export type StayCalendarWriteResult =
  | { readonly kind: 'ok'; readonly entryId: string | null; readonly version: number }
  /** Δεν υπάρχει — **ή** δεν το διαχειρίζεσαι. Ίδια έκβαση, επίτηδες (δεν διαρρέει ύπαρξη). */
  | { readonly kind: 'absent' }
  /** Νέα κατάληψη σε ακίνητο **χωρίς** ζωντανή βραχυχρόνια διάθεση. */
  | { readonly kind: 'not-a-stay' }
  | { readonly kind: 'conflict'; readonly conflicts: readonly StayCalendarConflictView[] }
  /** 🔴 Κάποια εγγραφή δεν διαβάζεται — **άρνηση**, ποτέ «έγραψα με ό,τι βρήκα» (§6.4). */
  | { readonly kind: 'unreadable' }
  | { readonly kind: 'entry-absent' }
  /** Block εξωτερικής πηγής (το ανοίγει η πηγή) ή κράτηση που δεν ακυρώνεται πια. */
  | { readonly kind: 'not-changeable'; readonly reason: 'external-source' | 'lifecycle' }
  /**
   * 🏆 Η χειροκίνητη κράτηση **παρακάμπτει κανόνες** που ο οικοδεσπότης δεν αποδέχτηκε ρητά
   * (ADR-835 §21). Η οθόνη τους ονομάζει και ζητά αποδοχή — ποτέ σιωπηλή παράκαμψη.
   */
  | { readonly kind: 'rules-unacknowledged'; readonly warnings: readonly StayRuleWarningKind[] }
  /** Η ρύθμιση ημερών αφήνει μέρα με ελάχιστες > μέγιστες νύχτες — αντίφαση, όχι κανόνας. */
  | { readonly kind: 'contradictory-rules'; readonly date: string };

export type StayCalendarWriteKind = StayCalendarWriteResult['kind'];

/** Η ετυμηγορία του κριτή ως έκβαση — `undetermined` ⇒ `unreadable`, **ποτέ** «καθαρό». */
export function refusalOf(verdict: StayCalendarVerdict): StayCalendarWriteResult | null {
  if (verdict.kind === 'clear') return null;
  if (verdict.kind === 'undetermined') return { kind: 'unreadable' };
  const seen = new Set<string>();
  const conflicts: StayCalendarConflictView[] = [];
  for (const conflict of verdict.conflicts) {
    const entry = conflict.with.source;
    const view: StayCalendarConflictView = entry.kind === 'booking'
      ? { entryKind: 'booking', entryId: entry.booking.id, from: entry.booking.checkIn, to: entry.booking.checkOut }
      : { entryKind: 'block', entryId: entry.block.id, from: entry.block.from, to: entry.block.to };
    // Μία γραμμή ανά εγγραφή — ο κριτής δίνει μία ανά αμφισβητούμενο **χώρο**.
    if (seen.has(view.entryId)) continue;
    seen.add(view.entryId);
    conflicts.push(view);
  }
  return { kind: 'conflict', conflicts };
}

function conflictViewsOf(value: unknown): readonly StayCalendarConflictView[] | null {
  if (!Array.isArray(value)) return null;
  const views: StayCalendarConflictView[] = [];
  for (const item of value) {
    if (!isRecord(item) || (item.entryKind !== 'booking' && item.entryKind !== 'block')) return null;
    const { entryId, from, to } = item;
    if (typeof entryId !== 'string' || typeof from !== 'string' || typeof to !== 'string') return null;
    views.push({ entryKind: item.entryKind, entryId, from, to });
  }
  return views;
}

/**
 * **Η έκβαση από το σύρμα** — για την οθόνη, που παίρνει το 409 ως σώμα σφάλματος.
 * Άγνωστο σχήμα ⇒ `null` (ο καλών το λέει «απέτυχε», ποτέ «αποθηκεύτηκε»).
 */
export function stayCalendarWriteResultFrom(raw: unknown): StayCalendarWriteResult | null {
  if (!isRecord(raw)) return null;
  switch (raw.kind) {
    case 'ok':
      return typeof raw.version === 'number' && (typeof raw.entryId === 'string' || raw.entryId === null)
        ? { kind: 'ok', entryId: raw.entryId, version: raw.version }
        : null;
    case 'conflict': {
      const conflicts = conflictViewsOf(raw.conflicts);
      return conflicts === null ? null : { kind: 'conflict', conflicts };
    }
    case 'rules-unacknowledged':
      return Array.isArray(raw.warnings) && raw.warnings.every(isStayRuleWarningKind)
        ? { kind: 'rules-unacknowledged', warnings: raw.warnings }
        : null;
    case 'contradictory-rules':
      return typeof raw.date === 'string' ? { kind: 'contradictory-rules', date: raw.date } : null;
    case 'not-changeable':
      return raw.reason === 'external-source' || raw.reason === 'lifecycle'
        ? { kind: 'not-changeable', reason: raw.reason }
        : null;
    case 'absent':
    case 'not-a-stay':
    case 'unreadable':
    case 'entry-absent':
      return { kind: raw.kind };
    default:
      return null;
  }
}

/** Ο κωδικός HTTP κάθε έκβασης — **ένας** πίνακας, `Record` ώστε νέα έκβαση να μη μεταγλωττίζεται σιωπηλά. */
export const STAY_CALENDAR_WRITE_STATUS: Readonly<Record<StayCalendarWriteKind, number>> = {
  ok: 200,
  absent: 404,
  'not-a-stay': 409,
  conflict: 409,
  unreadable: 503,
  'entry-absent': 404,
  'not-changeable': 409,
  'rules-unacknowledged': 409,
  'contradictory-rules': 422,
};
