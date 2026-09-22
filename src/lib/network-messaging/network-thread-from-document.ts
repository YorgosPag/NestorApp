/**
 * @fileoverview **ΤΑ ΣΥΝΟΡΑ ΑΝΑΓΝΩΣΗΣ ΤΟΥ ΝΗΜΑΤΟΣ ΣΤΟΝ ΠΕΛΑΤΗ** — αποθηκευμένο έγγραφο ⇒ τύπος του τομέα.
 * @related ADR-867 Β7 · CHECK 3.74 (το δόγμα: `*-from-document.ts`, ποτέ `as T`) · `types/network-thread.ts`
 * @module lib/network-messaging/network-thread-from-document
 *
 * 🔴 **ΓΙΑΤΙ ΟΧΙ `snapshot.data() as NetworkMessage`**: το έγγραφο έρχεται από τη **βάση**, όχι από τον
 * μεταγλωττιστή. Μηνύματα γραμμένα **πριν** από ένα πεδίο (`readBeforeEdit` · Β7, `following` · Β7) δεν το
 * έχουν — και ένα `undefined` που ο τύπος λέει `boolean | null` γίνεται «επεξεργάστηκε αφού το διάβασαν;
 * όχι» σε μια οθόνη που το πιστεύει. Εδώ κάθε πεδίο κρίνεται και κάθε απουσία παίρνει την **ουδέτερη**
 * τιμή που σημαίνει «δεν συνέβη».
 *
 * 🔑 **`null` ⇒ «δεν είναι έγγραφο του τομέα»** (λείπει ταυτότητα/αποστολέας/χρόνος) — **όχι** «λείπει
 * προαιρετικό πεδίο». Ίδιο συμβόλαιο με τα σύνορα του ADR-777 (`useOwnedDocuments`).
 */

import {
  NETWORK_ACT_KINDS,
  NETWORK_AUDIENCE_REASONS,
  NETWORK_AUDIENCE_ROLES,
  NETWORK_AUDIENCE_SIDES,
  NETWORK_HOST_ROLES,
  NETWORK_AUDIENCE_PRIVATE_DEFAULTS,
  NETWORK_THREAD_STATES,
  type NetworkAudienceEntry,
  type NetworkAudiencePrivate,
  type NetworkMessage,
  type NetworkThread,
  type NetworkThreadTopic,
} from '@/types/network-thread';

type Raw = Readonly<Record<string, unknown>>;

const isRecord = (value: unknown): value is Raw => typeof value === 'object' && value !== null;
const str = (value: unknown): string | null => (typeof value === 'string' && value !== '' ? value : null);
const strOrNull = (value: unknown): string | null => (typeof value === 'string' ? value : null);
const boolOrNull = (value: unknown): boolean | null => (typeof value === 'boolean' ? value : null);
const oneOf = <T extends string>(set: readonly T[], value: unknown): T | null =>
  typeof value === 'string' && (set as readonly string[]).includes(value) ? (value as T) : null;

/** Το μήνυμα — ό,τι διαβάζει ο πελάτης. Κενό σώμα επιτρέπεται (ταφόπλακα). */
export function networkMessageFromDocument(raw: unknown, id: string): NetworkMessage | null {
  if (!isRecord(raw)) return null;
  const senderUid = str(raw.senderUid);
  const createdAt = str(raw.createdAt);
  if (senderUid === null || createdAt === null) return null;
  return {
    id,
    senderUid,
    text: typeof raw.text === 'string' ? raw.text : '',
    createdAt,
    editedAt: strOrNull(raw.editedAt),
    retractedAt: strOrNull(raw.retractedAt),
    readBeforeRetraction: boolOrNull(raw.readBeforeRetraction),
    readBeforeEdit: boolOrNull(raw.readBeforeEdit),
  };
}

/** Μια γραμμή ακροατηρίου. Άγνωστη πλευρά/ρόλος ⇒ `null`: η λίστα δεν μαντεύει ποιος είναι ποιος. */
export function networkAudienceFromDocument(raw: unknown, id: string): NetworkAudienceEntry | null {
  if (!isRecord(raw)) return null;
  const side = oneOf(NETWORK_AUDIENCE_SIDES, raw.side);
  const role = oneOf(NETWORK_AUDIENCE_ROLES, raw.role);
  const since = str(raw.since);
  if (side === null || role === null || since === null) return null;
  return {
    uid: str(raw.uid) ?? id,
    side,
    role,
    reason: oneOf(NETWORK_AUDIENCE_REASONS, raw.reason) ?? 'added',
    addedBy: strOrNull(raw.addedBy) ?? '',
    since,
    until: strOrNull(raw.until),
    threadActivityAt: str(raw.threadActivityAt) ?? since,
    // Γραμμή προ-Β9 ⇒ `null` = «μία ιδιότητα» — ποτέ μαντεψιά δεύτερου ρόλου.
    alsoHostRole: oneOf(NETWORK_HOST_ROLES, raw.alsoHostRole),
  };
}

/** Τα αναλυμένα ιδιωτικά πεδία **ενός** εγγράφου — λείπει κλειδί ⇒ «αυτό το έγγραφο δεν το λέει». */
export function audiencePrivateFieldsOf(raw: unknown): Partial<NetworkAudiencePrivate> {
  if (!isRecord(raw)) return {};
  const found: { lastReadAt?: string | null; muted?: boolean; following?: boolean } = {};
  // ⚠️ `null` στο `lastReadAt` είναι **τιμή** («δεν διάβασε ποτέ»), όχι απουσία.
  if (typeof raw.lastReadAt === 'string' || raw.lastReadAt === null) found.lastReadAt = raw.lastReadAt;
  if (typeof raw.muted === 'boolean') found.muted = raw.muted;
  if (typeof raw.following === 'boolean') found.following = raw.following;
  return found;
}

/**
 * 🔒 **Η ιδιωτική πλευρά της θέσης** (ADR-867 Β9(β) Ε9) — **ποτέ `null`**: η απουσία εγγράφου είναι έγκυρη
 * κατάσταση («δεν διάβασε ποτέ, δεν σίγασε, δεν ακολουθεί»).
 *
 * 🔒 **ΜΙΑ πηγή — το ιδιωτικό έγγραφο.** Η εφεδρεία στη δημόσια γραμμή (expand/contract) **αφαιρέθηκε**
 * 2026-09-22, μετά το `migrate:network-audience-private -- --apply` (4 γραμμές, ξηρό ξανά = απόκλιση 0).
 * ⚠️ **ΜΗΝ την ξαναφέρεις**: ό,τι ιδιωτικό όνομα εμφανιστεί ξανά στη δημόσια γραμμή είναι **διαρροή** προς
 * την άλλη πλευρά, όχι τιμή — ο ανιχνευτής του είναι το ίδιο script (ξηρό ⇒ exit 1).
 */
export function networkAudiencePrivateFromDocument(privateRaw: unknown): NetworkAudiencePrivate {
  return { ...NETWORK_AUDIENCE_PRIVATE_DEFAULTS, ...audiencePrivateFieldsOf(privateRaw) };
}

function topicOf(raw: unknown): NetworkThreadTopic | null {
  if (!isRecord(raw)) return null;
  if (raw.kind === 'act') {
    const actKind = oneOf(NETWORK_ACT_KINDS, raw.actKind);
    const actSeed = str(raw.actSeed);
    const hostCompanyId = str(raw.hostCompanyId);
    const counterpartUid = str(raw.counterpartUid);
    if (actKind === null || actSeed === null || hostCompanyId === null || counterpartUid === null) return null;
    return { kind: 'act', actKind, actSeed, hostCompanyId, counterpartUid };
  }
  if (raw.kind === 'relationship' && Array.isArray(raw.personUids) && raw.personUids.length === 2) {
    const [a, b] = raw.personUids.map(str);
    return a && b ? { kind: 'relationship', personUids: [a, b] } : null;
  }
  return null;
}

/** Το νήμα. Άγνωστο θέμα ⇒ `null` (η οθόνη δεν δείχνει νήμα που δεν καταλαβαίνει). */
export function networkThreadFromDocument(raw: unknown, id: string): NetworkThread | null {
  if (!isRecord(raw)) return null;
  const topic = topicOf(raw.topic);
  const createdAt = str(raw.createdAt);
  if (topic === null || createdAt === null) return null;
  return {
    id,
    topic,
    // ⚠️ Άγνωστη κατάσταση ⇒ `closed`, ΠΟΤΕ `open`: η οθόνη κρύβει το «γράψε» αντί να υποσχεθεί
    //    αποστολή που ο γραφέας θα αρνηθεί (`thread-closed`).
    state: oneOf(NETWORK_THREAD_STATES, raw.state) ?? 'closed',
    createdAt,
    lastMessageAt: strOrNull(raw.lastMessageAt),
    // Νήμα προ-Ε10 ⇒ `undefined` (όχι `null`): «δεν ξέρω» ≠ «κανένα ζωντανό μήνυμα» — δες `thread-liveness.ts`.
    ...('lastLiveMessageAt' in raw ? { lastLiveMessageAt: strOrNull(raw.lastLiveMessageAt) } : {}),
  };
}
