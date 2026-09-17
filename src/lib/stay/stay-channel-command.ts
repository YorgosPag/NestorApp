/**
 * @fileoverview **ΟΙ ΠΡΑΞΕΙΣ ΠΑΝΩ ΣΤΑ ΚΑΝΑΛΙΑ** — κλειστό λεξιλόγιο + ο ΜΟΝΟΣ αναλυτής
 *   σώματος, και η **προβολή** που φεύγει προς την οθόνη.
 * @related ADR-835 §22 (Στάδιο Γ) · CHECK 3.78 (παραλλαγή σώματος, όχι νέα διαδρομή) ·
 *   services/stay-calendar/stay-channel-commands.service.ts · lib/stay/stay-calendar-view.ts
 * @module lib/stay/stay-channel-command
 *
 * 🔑 **Μία διαδρομή, τέσσερις πράξεις** — ίδιο ιδίωμα με το `stay-calendar-command.ts`.
 *
 * 🔴 **Η ΠΡΟΒΟΛΗ ΔΕΝ ΕΙΝΑΙ ΤΟ ΕΓΓΡΑΦΟ**: το `url` μιας πηγής **ΔΕΝ** φεύγει ποτέ προς
 * τον πελάτη (είναι διαπιστευτήριο του καναλιού). Φεύγει ο **host** — αρκετός για να
 * αναγνωρίσει ο άνθρωπος «ποιος σύνδεσμος είναι αυτός», άχρηστος για όποιον τον κλέψει.
 *
 * **Layering**: leaf — καθαρές συναρτήσεις, μηδέν I/O, μηδέν ρολόι.
 */

import { isRecord } from '@/lib/type-guards';
import type { StayChannelConflict } from './stay-channel-conflicts';
import type { StayChannelFreshness, StayChannelKind } from '@/types/stay-channels';

/** Ανώτατο μήκος ετικέτας πηγής — όνομα, όχι κείμενο. */
export const STAY_CHANNEL_LABEL_MAX_LENGTH = 60;
/** Ανώτατο μήκος URL πηγής. Τα tokens της Airbnb είναι μακριά, αλλά όχι τόσο. */
export const STAY_CHANNEL_URL_MAX_LENGTH = 2_048;

export type StayChannelCommand =
  /** Προσθήκη πηγής. Η **πρώτη ανάγνωση είναι υποχρεωτική**: αν αποτύχει, δεν αποθηκεύεται. */
  | { readonly action: 'add-feed'; readonly label: string; readonly url: string }
  | { readonly action: 'remove-feed'; readonly feedId: string }
  | { readonly action: 'sync-feed'; readonly feedId: string }
  /** Ανάκληση **όλων** των συνδέσμων εξαγωγής (γενιά + 1). */
  | { readonly action: 'rotate-export' };

export type StayChannelCommandParse =
  | { readonly ok: true; readonly command: StayChannelCommand }
  | { readonly ok: false; readonly malformed: readonly string[] };

const malformed = (...fields: readonly string[]): StayChannelCommandParse => ({ ok: false, malformed: fields });

function trimmed(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  return text.length > 0 && text.length <= max ? text : null;
}

/**
 * **Το σώμα ως πράξη.** Κρίνει **σχήμα**, ποτέ «διαβάζεται ο σύνδεσμος;» — αυτό το λέει
 * μόνο η πραγματική ανάγνωση, στον διακομιστή (και γι' αυτό είναι υποχρεωτική).
 */
export function stayChannelCommandFrom(raw: unknown): StayChannelCommandParse {
  if (!isRecord(raw)) return malformed('body');
  switch (raw.action) {
    case 'add-feed': {
      const label = trimmed(raw.label, STAY_CHANNEL_LABEL_MAX_LENGTH);
      const url = trimmed(raw.url, STAY_CHANNEL_URL_MAX_LENGTH);
      if (label === null || url === null) return malformed('label', 'url');
      return { ok: true, command: { action: 'add-feed', label, url } };
    }
    case 'remove-feed':
    case 'sync-feed': {
      const feedId = trimmed(raw.feedId, 120);
      if (feedId === null) return malformed('feedId');
      return { ok: true, command: { action: raw.action, feedId } };
    }
    case 'rotate-export':
      return { ok: true, command: { action: 'rotate-export' } };
    default:
      return malformed('action');
  }
}

// =============================================================================
// Η ΠΡΟΒΟΛΗ — ό,τι βλέπει ο ιδιοκτήτης, και ΤΙΠΟΤΑ παραπάνω
// =============================================================================

/** Μια πηγή, όπως τη βλέπει η οθόνη. **Χωρίς URL.** */
export interface StayChannelFeedView {
  readonly id: string;
  readonly label: string;
  /** Ο host του συνδέσμου (`www.airbnb.com`) — αναγνωρίσιμος, ακίνδυνος. */
  readonly host: string;
  readonly channel: StayChannelKind;
  /** 🔴 Δέχεται **αυτό** το κανάλι τον σύνδεσμό μας; (Booking.com: όχι, από 03/2025) */
  readonly acceptsImport: boolean;
  readonly freshness: StayChannelFreshness;
  readonly lastSuccessAt: string | null;
  readonly lastFailureAt: string | null;
  /** Ο μηχανικός κωδικός της τελευταίας αποτυχίας — η οθόνη τον μεταφράζει σε διέξοδο. */
  readonly lastFailure: string | null;
  readonly eventCount: number;
  /** Ο σύνδεσμος **για αυτό** το κανάλι (χωρίς τα δικά του γεγονότα), ή `null`. */
  readonly exportUrl: string | null;
}

/**
 * **Η οθόνη των καναλιών.**
 *
 * 🔑 `exportConfigured: false` σημαίνει «λείπει το μυστικό **από εμάς**»: η οθόνη το λέει
 * ως **δική μας** εκκρεμότητα, ποτέ ως σφάλμα του ανθρώπου (ίδιο ιδίωμα με το
 * `server-config` του `signed-token`).
 */
export type StayChannelsView =
  | {
      readonly kind: 'readable';
      readonly exportConfigured: boolean;
      /** Ο γενικός σύνδεσμος (όλα τα γεγονότα), ή `null` όταν λείπει το μυστικό. */
      readonly exportUrl: string | null;
      readonly feeds: readonly StayChannelFeedView[];
      /** Οι **μελλοντικές** συγκρούσεις των εισαγόμενων νυχτών, ονομασμένες. */
      readonly conflicts: readonly StayChannelConflict[];
    }
  /** Το ημερολόγιο δεν διαβάζεται — καμία πράξη πάνω σε κανάλια (§6.4). */
  | { readonly kind: 'unreadable' };

/** Η έκβαση μιας πράξης — κλειστή ένωση, κάθε άρνηση με **όνομα και διέξοδο**. */
export type StayChannelWriteResult =
  | { readonly kind: 'ok' }
  | { readonly kind: 'absent' }
  | { readonly kind: 'not-a-stay' }
  | { readonly kind: 'unreadable' }
  | { readonly kind: 'feed-absent' }
  | { readonly kind: 'too-many-feeds'; readonly max: number }
  | { readonly kind: 'duplicate-feed' }
  /** Ο σύνδεσμος **δεν διαβάστηκε**: δεν αποθηκεύεται, και ο λόγος λέγεται. */
  | { readonly kind: 'feed-unreadable'; readonly failure: string; readonly httpStatus: number | null }
  /** Χειροκίνητος συγχρονισμός πιο συχνά από το επιτρεπτό. */
  | { readonly kind: 'too-soon' }
  /** Λείπει το μυστικό υπογραφής — **δικό μας** χρέος, ποτέ του ανθρώπου. */
  | { readonly kind: 'export-unconfigured' };

export type StayChannelWriteKind = StayChannelWriteResult['kind'];

/** Ο κωδικός HTTP κάθε έκβασης — **ένας** πίνακας (`Record`, ώστε νέα έκβαση να φαίνεται). */
export const STAY_CHANNEL_WRITE_STATUS: Readonly<Record<StayChannelWriteKind, number>> = {
  ok: 200,
  absent: 404,
  'not-a-stay': 409,
  unreadable: 503,
  'feed-absent': 404,
  'too-many-feeds': 409,
  'duplicate-feed': 409,
  'feed-unreadable': 422,
  'too-soon': 429,
  'export-unconfigured': 503,
};

/** **Η έκβαση από το σύρμα** — άγνωστο σχήμα ⇒ `null` («απέτυχε», ποτέ «αποθηκεύτηκε»). */
export function stayChannelWriteResultFrom(raw: unknown): StayChannelWriteResult | null {
  if (!isRecord(raw)) return null;
  switch (raw.kind) {
    case 'too-many-feeds':
      return typeof raw.max === 'number' ? { kind: 'too-many-feeds', max: raw.max } : null;
    case 'feed-unreadable':
      return typeof raw.failure === 'string'
        ? {
          kind: 'feed-unreadable',
          failure: raw.failure,
          httpStatus: typeof raw.httpStatus === 'number' ? raw.httpStatus : null,
        }
        : null;
    case 'ok':
    case 'absent':
    case 'not-a-stay':
    case 'unreadable':
    case 'feed-absent':
    case 'duplicate-feed':
    case 'too-soon':
    case 'export-unconfigured':
      return { kind: raw.kind };
    default:
      return null;
  }
}
