'use client';

/**
 * @fileoverview **ΟΙ ΠΡΑΞΕΙΣ ΤΗΣ ΟΘΟΝΗΣ ΤΟΥ ΝΗΜΑΤΟΣ** — ο πελάτης των πορτών `app/api/network/**`.
 * @related ADR-867 Β7 · `types/network-wire.ts` (τα σχήματα) · `types/network-thread.ts` (`NETWORK_REFUSAL_CODES`)
 * @module services/network-messaging/network-thread.client
 *
 * 🔑 **Καμία γραφή στο Firestore από τον πελάτη** (ADR-867 §4.1: `write: false` σε όλες τις συλλογές) —
 * **κάθε** πράξη περνά από διαδρομή, όπου ο γραφέας κρίνει μέσα σε συναλλαγή. Η **ανάγνωση** είναι ζωντανή
 * (`useNetworkThread`), γι' αυτό εδώ **δεν** επιστρέφεται ποτέ νέο νήμα: το snapshot το φέρνει μόνο του.
 *
 * ⚠️ **Αποτυχία = ΚΩΔΙΚΟΣ από κλειστό σύνολο, ποτέ κείμενο** (N.11): η οθόνη τον μεταφράζει. Ένα άγνωστο
 * σφάλμα γίνεται `unreachable`/`internal-error` — **ποτέ** «ό,τι είπε ο διακομιστής».
 */

import { API_ROUTES } from '@/config/domain-constants';
import { ApiClientError, apiErrorBodyOf } from '@/lib/api/api-client-types';
import { apiClient } from '@/lib/api/enterprise-api-client';
import type { ActTeamChangeKind } from '@/services/network-messaging/act-team-change';
import { NETWORK_REFUSAL_CODES, type NetworkRefusalCode } from '@/types/network-thread';
import type {
  NetworkActTeamChangeResult,
  NetworkActTeamResult,
  NetworkAwayResult,
  NetworkEditResult,
  NetworkPeopleResult,
  NetworkPresenceResult,
  NetworkRetractionResult,
  NetworkThreadContextResult,
  NetworkSendResult,
  NetworkThreadDirectoryResult,
} from '@/types/network-wire';

/** Πώς απέτυχε — κλειστό σύνολο: οι αρνήσεις του γραφέα + τρεις του μεταφορέα. */
export type NetworkFailure = NetworkRefusalCode | 'invalid-request' | 'internal-error' | 'unreachable';

export type NetworkResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly failure: NetworkFailure; readonly currentVersion: number | null };

const isRefusalCode = (value: unknown): value is NetworkRefusalCode =>
  typeof value === 'string' && (NETWORK_REFUSAL_CODES as readonly string[]).includes(value);

/** Σφάλμα ⇒ κωδικός. Διαβάζει το **σώμα** της άρνησης (`{ error, currentVersion? }`), ποτέ το κείμενο. */
export function networkFailureOf(cause: unknown): { readonly failure: NetworkFailure; readonly currentVersion: number | null } {
  const body = apiErrorBodyOf(cause);
  const currentVersion = typeof body?.currentVersion === 'number' ? body.currentVersion : null;
  if (isRefusalCode(body?.error)) return { failure: body.error, currentVersion };
  if (!ApiClientError.isApiClientError(cause)) return { failure: 'unreachable', currentVersion: null };
  if (cause.statusCode === 400) return { failure: 'invalid-request', currentVersion: null };
  return { failure: cause.statusCode >= 500 ? 'internal-error' : 'unreachable', currentVersion: null };
}

async function call<T>(run: () => Promise<T>): Promise<NetworkResult<T>> {
  try {
    return { ok: true, value: await run() };
  } catch (cause) {
    return { ok: false, ...networkFailureOf(cause) };
  }
}

const R = API_ROUTES.NETWORK;

export const networkThreadClient = {
  /** `clientKey` = το κλειδί ιδεμποτησίας (ίδιο σε κάθε επανάληψη της ΙΔΙΑΣ αποστολής — Slack `client_msg_id`). */
  send: (threadId: string, text: string, clientKey: string) =>
    call(() => apiClient.post<NetworkSendResult>(R.MESSAGES(threadId), { text, clientKey })),
  edit: (threadId: string, messageId: string, text: string) =>
    call(() => apiClient.patch<NetworkEditResult>(R.MESSAGE(threadId, messageId), { text })),
  retract: (threadId: string, messageId: string) =>
    call(() => apiClient.post<NetworkRetractionResult>(R.RETRACTION(threadId, messageId), {})),
  markRead: (threadId: string) => call(() => apiClient.post<unknown>(R.READ(threadId), {})),
  setMuted: (threadId: string, muted: boolean) => call(() => apiClient.put<unknown>(R.MUTE(threadId), { muted })),
  setFollowing: (threadId: string, following: boolean) =>
    call(() => apiClient.put<unknown>(R.FOLLOW(threadId), { following })),
  presence: (threadId: string) => call(() => apiClient.get<NetworkPresenceResult>(R.PRESENCE(threadId))),
  people: (threadId: string) => call(() => apiClient.get<NetworkPeopleResult>(R.PEOPLE(threadId))),
  /**
   * **Τα συμφραζόμενα μιας συνομιλίας** (ADR-867 Β9γ) — πλευρά, ομάδα, και «για ποιο πράγμα».
   *
   * ⚠️ Χρειάζεται επειδή η συνομιλία απέκτησε **δική της** διεύθυνση: ο άνθρωπος φτάνει εκεί χωρίς
   * να έχει δει τη σελίδα της πράξης, και ο πελάτης **δεν** επιτρέπεται να συμπεράνει τίποτα από
   * αυτά μόνος του (το `actSeed` είναι εσωτερικός, η πλευρά ζει στη γραμμή ακροατηρίου).
   */
  context: (threadId: string) => call(() => apiClient.get<NetworkThreadContextResult>(R.THREAD(threadId))),
  /**
   * **Ο κατάλογος των νημάτων ΜΟΥ** (ADR-867 Β9β) — μία σελίδα, με **δρομέα**.
   *
   * ⚠️ Ο `cursor` είναι **αδιαφανής**: έρχεται αυτούσιος από το `next` της προηγούμενης σελίδας και
   * επιστρέφεται αυτούσιος. Ο πελάτης **ποτέ** δεν τον κατασκευάζει ούτε τον διαβάζει — χαλασμένος
   * δρομέας απαντά **400** (`invalid-request`), ποτέ σιωπηλά «πρώτη σελίδα».
   *
   * 🔑 **Καμία εμβέλεια χώρου, επίτηδες**: το νήμα είναι `cross-space-thread` (`tenant-config.ts`) —
   * η εμβέλεια είναι ο **άνθρωπος** (`uid`), και τη βάζει ο διακομιστής από την ταυτότητα.
   */
  list: (page?: { readonly limit?: number; readonly cursor?: string }) =>
    call(() => apiClient.get<NetworkThreadDirectoryResult>(withListQuery(R.THREADS, page))),
} as const;

/** Χτίζει το ερώτημα **μόνο** από όσα δόθηκαν — κενό `?` θα ήταν διαφορετική διεύθυνση για τον ίδιο πόρο. */
function withListQuery(route: string, page: { readonly limit?: number; readonly cursor?: string } | undefined): string {
  const params = new URLSearchParams();
  if (page?.limit !== undefined) params.set('limit', String(page.limit));
  if (page?.cursor !== undefined) params.set('cursor', page.cursor);
  const query = params.toString();
  return query === '' ? route : `${route}?${query}`;
}

export const networkAwayClient = {
  read: () => call(() => apiClient.get<NetworkAwayResult>(R.AWAY)),
  /** Έναρξη απούσα ⇒ «από τώρα» (ο διακομιστής). **Κανένα** πεδίο κειμένου (ΓΚΠΔ). */
  set: (endsAt: string, startsAt?: string) =>
    call(() => apiClient.put<NetworkAwayResult>(R.AWAY, startsAt === undefined ? { endsAt } : { startsAt, endsAt })),
  /** «Γύρισα» — λήγει τώρα, δεν σβήνεται. */
  end: () => call(() => apiClient.delete<NetworkAwayResult>(R.AWAY)),
} as const;

export const networkActTeamClient = {
  read: (teamId: string) => call(() => apiClient.get<NetworkActTeamResult>(R.ACT_TEAM(teamId))),
  /** `expectedVersion` = η έκδοση που **είδε** ο άνθρωπος (If-Match) — σύγκρουση ⇒ `stale-version` + η τρέχουσα. */
  change: (teamId: string, change: { readonly kind: ActTeamChangeKind; readonly uid: string }, expectedVersion: number) =>
    call(() => apiClient.patch<NetworkActTeamChangeResult>(R.ACT_TEAM(teamId), { change, expectedVersion })),
} as const;
