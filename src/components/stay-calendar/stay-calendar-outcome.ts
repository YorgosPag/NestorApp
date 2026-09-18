/**
 * **Η έκβαση μιας πράξης ως μήνυμα** — ταυτότητα μηνύματος + παράμετροι, μία αντιστοίχιση.
 *
 * 🔑 `Record` πάνω στο κλειστό σύνολο εκβάσεων: νέα έκβαση του διακομιστή **δεν
 * μεταγλωττίζεται** μέχρι να αποκτήσει μήνυμα — ποτέ σιωπηλό «κάτι πήγε στραβά».
 *
 * ⚠️ **Εδώ ΔΕΝ ζουν κλειδιά i18n**, επίτηδες: η γεννήτρια των route slices (ADR-744)
 * διαβάζει πίνακες κλειδιών **στο αρχείο που καλεί το `t()`**. Κλειδί συντεθειμένο σε
 * άλλο αρχείο θα ήταν «ανεπίλυτη δυναμική `t()`». Ο πίνακας ζει στο `StayCalendarPanel`.
 *
 * @related ADR-835 §20 (Στάδιο Α) · services/stay-calendar/stay-calendar-write-result.ts
 */

import { formatCalendarDay, formatDateTime } from '@/lib/intl-formatting';
import { STAY_HOLD_TIME_FORMAT } from '@/lib/stay/stay-hold-deadline';
import type { StayCalendarSendOutcome } from '@/services/stay-calendar/stay-calendar.client';

const STAY_CALENDAR_MESSAGE_IDS = [
  'saved',
  'conflictBlock',
  'conflictBooking',
  'notAStay',
  'unreadable',
  'entryAbsent',
  'externalSource',
  'lifecycle',
  'absent',
  'failed',
  'rulesUnacknowledged',
  'contradictoryRules',
  // Στάδιο Δ (ADR-835 §23) — ό,τι μόνο ο οικοδεσπότης μπορεί να συναντήσει.
  'conflictRequest',
  'holdLapsed',
] as const;

export type StayCalendarMessageId = (typeof STAY_CALENDAR_MESSAGE_IDS)[number];

export interface StayCalendarMessage {
  readonly id: StayCalendarMessageId;
  readonly params?: Readonly<Record<string, string>>;
  /** `status` = επιβεβαίωση· `alert` = άρνηση που ο άνθρωπος πρέπει να διαβάσει. */
  readonly tone: 'status' | 'alert';
}

type SimpleKind = Exclude<StayCalendarSendOutcome['kind'], 'conflict' | 'not-changeable' | 'contradictory-rules'>;

const SIMPLE: Readonly<Record<SimpleKind, StayCalendarMessage>> = {
  ok: { id: 'saved', tone: 'status' },
  absent: { id: 'absent', tone: 'alert' },
  'not-a-stay': { id: 'notAStay', tone: 'alert' },
  unreadable: { id: 'unreadable', tone: 'alert' },
  'entry-absent': { id: 'entryAbsent', tone: 'alert' },
  failed: { id: 'failed', tone: 'alert' },
  // Οι ίδιες οι παραβιάσεις ονομάζονται δίπλα, με επιβεβαίωση (`StayRuleWarningsConfirm`).
  'rules-unacknowledged': { id: 'rulesUnacknowledged', tone: 'alert' },
  // Στάδιο Δ: αποδοχή/άρνηση **μετά** την προθεσμία — το αίτημα έχει ήδη λήξει.
  'hold-lapsed': { id: 'holdLapsed', tone: 'alert' },
  // Εκβάσεις της πόρτας του **επισκέπτη**: σε αυτή την οθόνη θα σήμαιναν σφάλμα, όχι κατάσταση.
  unavailable: { id: 'failed', tone: 'alert' },
  'too-late': { id: 'failed', tone: 'alert' },
  'risk-not-acknowledged': { id: 'failed', tone: 'alert' },
  'guest-hold-limit': { id: 'failed', tone: 'alert' },
  'hold-alive': { id: 'failed', tone: 'alert' },
  'own-listing': { id: 'failed', tone: 'alert' },
};

export function stayCalendarMessageOf(outcome: StayCalendarSendOutcome): StayCalendarMessage {
  switch (outcome.kind) {
    case 'conflict': {
      const [first] = outcome.conflicts;
      if (first === undefined) return SIMPLE.failed;
      // 🏆 Ζωντανό αίτημα: «απαντήστε πρώτα» — άλλη θεραπεία από το «πέφτει πάνω σε κράτηση».
      if (first.heldUntil !== null) {
        return { id: 'conflictRequest', params: { until: formatDateTime(first.heldUntil, STAY_HOLD_TIME_FORMAT) }, tone: 'alert' };
      }
      return {
        id: first.entryKind === 'booking' ? 'conflictBooking' : 'conflictBlock',
        params: { from: formatCalendarDay(first.from), to: formatCalendarDay(first.to) },
        tone: 'alert',
      };
    }
    case 'contradictory-rules':
      return { id: 'contradictoryRules', params: { date: formatCalendarDay(outcome.date) }, tone: 'alert' };
    case 'not-changeable':
      return { id: outcome.reason === 'external-source' ? 'externalSource' : 'lifecycle', tone: 'alert' };
    default:
      return SIMPLE[outcome.kind];
  }
}
