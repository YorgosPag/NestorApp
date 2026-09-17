/**
 * **Η έκβαση μιας πράξης καναλιού ως μήνυμα** — ταυτότητα + παράμετροι, μία αντιστοίχιση.
 *
 * 🔑 `Record` πάνω στο κλειστό σύνολο εκβάσεων: νέα έκβαση του διακομιστή **δεν
 * μεταγλωττίζεται** μέχρι να αποκτήσει μήνυμα — ποτέ σιωπηλό «κάτι πήγε στραβά».
 *
 * ⚠️ **Εδώ ΔΕΝ ζουν κλειδιά i18n**, επίτηδες (ίδιος λόγος με το `stay-calendar-outcome`):
 * η γεννήτρια των route slices (ADR-744) διαβάζει πίνακες κλειδιών **στο αρχείο που καλεί
 * το `t()`**. Ο πίνακας ζει στο `StayChannelSync`.
 *
 * @related ADR-835 §22 (Στάδιο Γ) · lib/stay/stay-channel-command.ts
 */

import type { StayChannelsSendOutcome } from '@/services/stay-calendar/stay-channels.client';

const STAY_CHANNEL_MESSAGE_IDS = [
  'saved',
  'feedUnreadable',
  'duplicate',
  'tooMany',
  'tooSoon',
  'feedAbsent',
  'notAStay',
  'unreadable',
  'exportUnconfigured',
  'absent',
  'failed',
] as const;

export type StayChannelMessageId = (typeof STAY_CHANNEL_MESSAGE_IDS)[number];

export interface StayChannelMessage {
  readonly id: StayChannelMessageId;
  readonly params?: Readonly<Record<string, string | number>>;
  /** `status` = επιβεβαίωση· `alert` = άρνηση που ο άνθρωπος πρέπει να διαβάσει. */
  readonly tone: 'status' | 'alert';
}

type SimpleKind = Exclude<StayChannelsSendOutcome['kind'], 'feed-unreadable' | 'too-many-feeds'>;

const SIMPLE: Readonly<Record<SimpleKind, StayChannelMessage>> = {
  ok: { id: 'saved', tone: 'status' },
  absent: { id: 'absent', tone: 'alert' },
  'not-a-stay': { id: 'notAStay', tone: 'alert' },
  unreadable: { id: 'unreadable', tone: 'alert' },
  'feed-absent': { id: 'feedAbsent', tone: 'alert' },
  'duplicate-feed': { id: 'duplicate', tone: 'alert' },
  'too-soon': { id: 'tooSoon', tone: 'alert' },
  'export-unconfigured': { id: 'exportUnconfigured', tone: 'alert' },
  failed: { id: 'failed', tone: 'alert' },
};

export function stayChannelMessageOf(outcome: StayChannelsSendOutcome): StayChannelMessage {
  switch (outcome.kind) {
    case 'feed-unreadable':
      // Ο **μηχανικός** κωδικός ταξιδεύει ως παράμετρος: η πρόταση λέει «δεν διαβάστηκε»,
      // και ο κωδικός επιτρέπει στον άνθρωπο (ή σε εμάς) να ξέρει **γιατί**.
      return { id: 'feedUnreadable', params: { code: outcome.failure }, tone: 'alert' };
    case 'too-many-feeds':
      return { id: 'tooMany', params: { max: outcome.max }, tone: 'alert' };
    default:
      return SIMPLE[outcome.kind];
  }
}
