/**
 * @fileoverview **Η ΑΝΑΓΝΩΣΗ ΜΙΑΣ ΠΗΓΗΣ** — φυλαγμένο fetch + αυστηρός αναλυτής iCal,
 *   με **ονομασμένη** αποτυχία. Καμία γραφή εδώ.
 * @related ADR-835 §22 (Στάδιο Γ) · §6.4 · lib/security/outbound-url-guard.ts ·
 *   lib/ical/ical-read.ts · types/stay-channels.ts
 * @module services/stay-calendar/stay-channel-fetch
 *
 * ⚠️ **ΤΟ ΔΙΚΤΥΟ ΖΕΙ ΕΞΩ ΑΠΟ ΚΑΘΕ ΣΥΝΑΛΛΑΓΗ.** Μια συναλλαγή Firestore
 * **ξαναπαίζεται**: ένα `fetch` μέσα της θα χτυπούσε το κανάλι δύο και τρεις φορές, και
 * στη δεύτερη προσπάθεια θα έβλεπε **άλλο** ημερολόγιο από αυτό που έκρινε η πρώτη.
 *
 * 🔑 **Ο ίδιος φρουρός SSRF** με το CIMD (`outbound-url-guard`), με **άλλα όρια**: ένα
 * ημερολόγιο καναλιού είναι εκατοντάδες KB και τα OTA είναι αργά. Δεύτερος φρουρός θα
 * ήταν δεύτερη ευκαιρία να ξεχαστεί ένα στρώμα.
 */

import 'server-only';
import { readIcalCalendar, type IcalEvent } from '@/lib/ical/ical-read';
import {
  fetchGuardedDocument,
  type GuardedDocumentResult,
} from '@/lib/security/outbound-url-guard';
import { stayClockAt } from '@/lib/stay/stay-calendar-of';
import {
  STAY_CHANNEL_MAX_BYTES,
  STAY_CHANNEL_TIMEOUT_MS,
  type StayChannelFailure,
  type StayChannelFeed,
} from '@/types/stay-channels';

/** Πόσες ανακατευθύνσεις δέχεται ένα feed — τα OTA feeds μετρημένα ανακατευθύνουν. */
const MAX_REDIRECTS = 3;
/** Ό,τι δηλώνουμε ότι δεχόμαστε. Τα κανάλια στέλνουν άλλοτε `text/calendar`, άλλοτε `text/plain`. */
const ACCEPT = 'text/calendar, text/plain, */*';

/**
 * Τι έβγαλε μια ανάγνωση πηγής.
 *
 * 🔑 Το `not-modified` είναι **επιτυχία**: το κανάλι λέει «τίποτα δεν άλλαξε», και αυτό
 * ανανεώνει την εμπιστοσύνη **χωρίς** διαφορά να γραφτεί.
 */
export type StayChannelRead =
  | {
      readonly kind: 'events';
      readonly events: readonly IcalEvent[];
      readonly etag: string | null;
      readonly lastModified: string | null;
    }
  | { readonly kind: 'not-modified' }
  | { readonly kind: 'failed'; readonly failure: StayChannelFailure; readonly httpStatus: number | null };

/** Η αποτυχία του φρουρού/δικτύου στο λεξιλόγιο του τομέα. */
function failureOf(result: Extract<GuardedDocumentResult, { ok: false }>): StayChannelFailure {
  switch (result.rejection) {
    case 'timeout':
      return 'timeout';
    case 'too_large':
      return 'too-large';
    case 'dns_failed':
      return 'dns-failed';
    case 'http_error':
      if (result.status === 401 || result.status === 403) return 'unauthorized';
      if (result.status === 404 || result.status === 410) return 'not-found';
      return 'channel-error';
    // Συντακτικό, ιδιωτική διεύθυνση, διαπιστευτήρια στο URL, πολλές ανακατευθύνσεις:
    // **το URL δεν γίνεται δεκτό**, και η θεραπεία είναι ανθρώπινη (άλλος σύνδεσμος).
    default:
      return 'url-refused';
  }
}

/**
 * **Διαβάζει μια πηγή**: φυλαγμένο fetch (conditional GET) → αυστηρός αναλυτής.
 *
 * 🔑 Η μετάφραση ενός `DTSTART` σε **UTC** (`…Z`) σε ημέρα γίνεται με τη ζώνη **του
 * καταλύματος** (`STAY_CALENDAR_TIMEZONE`) — και η στιγμή που μετράει είναι **του
 * γεγονότος**, όχι της ανάγνωσης: γι' αυτό δεν υπάρχει παράμετρος ρολογιού εδώ.
 */
export async function readStayChannelFeed(feed: StayChannelFeed): Promise<StayChannelRead> {
  const result = await fetchGuardedDocument(feed.url, {
    accept: ACCEPT,
    timeoutMs: STAY_CHANNEL_TIMEOUT_MS,
    maxBytes: STAY_CHANNEL_MAX_BYTES,
    maxRedirects: MAX_REDIRECTS,
    ifNoneMatch: feed.status.etag,
    ifModifiedSince: feed.status.lastModified,
  });
  if (!result.ok) return { kind: 'failed', failure: failureOf(result), httpStatus: result.status };
  if (result.notModified) return { kind: 'not-modified' };

  const parsed = readIcalCalendar(result.body, {
    // Η ημέρα του καταλύματος για μια στιγμή UTC — **μία** μετάφραση ρολογιού (ώρα Αθήνας).
    dateKeyOfInstant: (epochMs) => stayClockAt(new Date(epochMs)).today,
  });
  if (!parsed.ok) return { kind: 'failed', failure: parsed.failure, httpStatus: result.status };
  return {
    kind: 'events',
    events: parsed.events,
    etag: result.etag,
    lastModified: result.lastModified,
  };
}
