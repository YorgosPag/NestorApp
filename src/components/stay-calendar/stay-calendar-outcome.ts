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

import { formatCalendarDay } from '@/lib/intl-formatting';
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
] as const;

export type StayCalendarMessageId = (typeof STAY_CALENDAR_MESSAGE_IDS)[number];

export interface StayCalendarMessage {
  readonly id: StayCalendarMessageId;
  readonly params?: Readonly<Record<string, string>>;
  /** `status` = επιβεβαίωση· `alert` = άρνηση που ο άνθρωπος πρέπει να διαβάσει. */
  readonly tone: 'status' | 'alert';
}

type SimpleKind = Exclude<StayCalendarSendOutcome['kind'], 'conflict' | 'not-changeable'>;

const SIMPLE: Readonly<Record<SimpleKind, StayCalendarMessage>> = {
  ok: { id: 'saved', tone: 'status' },
  absent: { id: 'absent', tone: 'alert' },
  'not-a-stay': { id: 'notAStay', tone: 'alert' },
  unreadable: { id: 'unreadable', tone: 'alert' },
  'entry-absent': { id: 'entryAbsent', tone: 'alert' },
  failed: { id: 'failed', tone: 'alert' },
};

export function stayCalendarMessageOf(outcome: StayCalendarSendOutcome): StayCalendarMessage {
  switch (outcome.kind) {
    case 'conflict': {
      const [first] = outcome.conflicts;
      if (first === undefined) return SIMPLE.failed;
      return {
        id: first.entryKind === 'booking' ? 'conflictBooking' : 'conflictBlock',
        params: { from: formatCalendarDay(first.from), to: formatCalendarDay(first.to) },
        tone: 'alert',
      };
    }
    case 'not-changeable':
      return { id: outcome.reason === 'external-source' ? 'externalSource' : 'lifecycle', tone: 'alert' };
    default:
      return SIMPLE[outcome.kind];
  }
}
