import 'server-only';

/**
 * @fileoverview **Ο ΜΟΝΟΣ γραφέας των εγγραφών συνεδρίας** (`users/{uid}/sessions/{sessionId}`) — ADR-894.
 * @related `app/api/auth/active-sessions/**` (οι πόρτες) · `lib/geo/ip-geolocation.ts` (η τοποθεσία) ·
 *   `session-helpers.ts` (σταθερές + ανάγνωση) · `firestore.rules` (ο client **μόνο διαβάζει**)
 * @module services/session/session-server.service
 *
 * 🔑 **Γιατί server**: μέχρι τις 2026-09-29 ο browser έγραφε ο ίδιος το έγγραφο, μαζί με την τοποθεσία που
 * του έδινε το `ipapi.co` ⇒ ό,τι έβλεπε ο χρήστης στη «λίστα συσκευών» μπορούσε να το είχε γράψει ο
 * οποιοσδήποτε με το token του. Τώρα UA, IP και τοποθεσία διαβάζονται από το **ίδιο το αίτημα**.
 *
 * 🔑 **Μία εγγραφή ανά browser** (πρότυπο Google «Your devices»), όχι ανά καρτέλα: ο browser θυμάται το id
 * και το ξαναστέλνει· εδώ **αγγίζεται** αν ζει, αλλιώς γεννιέται νέο. Η λήξη **κυλά** με τη δραστηριότητα.
 *
 * 🔑 **Τελευταία θέση**: αν το αποτύπωμα της IP αλλάξει μετά τη σύνδεση, γράφεται `lastLocation` — η
 * σύνδεση κρατά την αρχική της θέση, ώστε «συνδέθηκε από Θεσσαλονίκη, τώρα από Λάγο» να **φαίνεται**.
 */

import { Timestamp, type CollectionReference, type DocumentData, type Transaction } from 'firebase-admin/firestore';

import { COLLECTIONS, SUBCOLLECTIONS } from '@/config/firestore-collections';
import { getDeploymentId } from '@/lib/app-version/deployment-identity';
import { normalizeToDate } from '@/lib/date-local';
import { resolveIpPlace } from '@/lib/geo/ip-geolocation';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { clientIpFingerprint } from '@/lib/http/client-ip';
import { generateSessionId } from '@/services/enterprise-id.service';

import { DEFAULT_SESSION_DURATION_HOURS, MAX_CONCURRENT_SESSIONS, SESSION_RETENTION_DAYS } from './session-helpers';
import { denySignIns, endEverySignIn, type SignInRevocationOutcome } from './session-sign-in-revocation';
import { alertOnNovelSignIn } from './new-sign-in-notifier';
import {
  isSessionAlive,
  knownFingerprintOf,
  needsRelocation,
  planSessionCap,
  type SessionLifeFacts,
} from './session-lifecycle';
import type {
  LoginMethod,
  SessionDeviceInfo,
  SessionLocation,
  SyncActiveSessionResult,
} from './session.types';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/** Οι λόγοι ανάκλησης — κλειστό σύνολο, ώστε κανένα ελεύθερο κείμενο να μη φτάνει στο έγγραφο. */
export const SESSION_REVOCATION_REASONS = ['user_requested', 'logout'] as const;
export type SessionRevocationReason =
  | (typeof SESSION_REVOCATION_REASONS)[number]
  | 'revoked_all_other'
  | 'auto_revoked_max_sessions';

export interface ActiveSessionRequest {
  readonly uid: string;
  /** Η εγγραφή που θυμάται ο browser, **ήδη επικυρωμένη** από τη διαδρομή. */
  readonly sessionId: string | null;
  readonly loginMethod: LoginMethod;
  readonly deviceInfo: SessionDeviceInfo;
  /** Από το `clientIpOf` — **δεν** αποθηκεύεται ποτέ. */
  readonly ip: string;
  /** Η σύνδεση του διαπιστευτηρίου (`auth_time`) — ADR-894 §10 Β1: σε αυτήν δένεται η ανάκληση. */
  readonly authTimeSec?: number;
}

/** Η σύνδεση που κρατά μια εγγραφή (`signIn.authTimeSec`), αν γράφτηκε (εγγραφές πριν τη Φάση 2 δεν την έχουν). */
function signInOf(data: DocumentData | undefined): number | undefined {
  const value: unknown = data?.signIn?.authTimeSec;
  return typeof value === 'number' ? value : undefined;
}

function sessionsOf(uid: string): CollectionReference<DocumentData> {
  return getAdminFirestore().collection(COLLECTIONS.USERS).doc(uid).collection(SUBCOLLECTIONS.USER_SESSIONS);
}

function fingerprintOf(ip: string): string | null {
  return ip && ip !== 'unknown' ? clientIpFingerprint(ip) : null;
}

/** Η τοποθεσία του αιτήματος — τοπική βάση, αποτύπωμα αντί για IP. */
export async function locateRequest(ip: string): Promise<SessionLocation> {
  const place = await resolveIpPlace(ip);
  return { ...place, ipFingerprint: fingerprintOf(ip) };
}

function expiryFrom(now: Date): { expiresAt: Timestamp; purgeAt: Timestamp } {
  const expires = now.getTime() + DEFAULT_SESSION_DURATION_HOURS * HOUR_MS;
  return {
    expiresAt: Timestamp.fromMillis(expires),
    purgeAt: Timestamp.fromMillis(expires + SESSION_RETENTION_DAYS * DAY_MS),
  };
}

function endedFields(reason: SessionRevocationReason, now: Date): Record<string, unknown> {
  const at = Timestamp.fromDate(now);
  return {
    status: 'revoked',
    'timestamps.revokedAt': at,
    revocationReason: reason,
    purgeAt: Timestamp.fromMillis(now.getTime() + SESSION_RETENTION_DAYS * DAY_MS),
  };
}

/** Το έγγραφο → τα γεγονότα που κρίνει ο πυρήνας (`session-lifecycle.ts`). */
function lifeFactsOf(id: string, data: DocumentData | undefined): SessionLifeFacts {
  // `normalizeToDate` = ο ΕΝΑΣ αναγνώστης χρόνου (Timestamp · Date · σειριοποιημένο {_seconds}).
  const expiresAt = normalizeToDate(data?.timestamps?.expiresAt);
  return { id, status: data?.status, expiresAtMs: expiresAt ? expiresAt.getTime() : null };
}

/** Αγγίζει ζωντανή εγγραφή· `false` αν δεν υπάρχει / ανακλήθηκε / έληξε (τότε γεννιέται νέα). */
async function touchSession(request: ActiveSessionRequest, sessionId: string, now: Date): Promise<boolean> {
  const ref = sessionsOf(request.uid).doc(sessionId);
  const snap = await ref.get();
  const data = snap.data();
  if (!isSessionAlive(lifeFactsOf(sessionId, data), now.getTime())) return false;

  const { expiresAt, purgeAt } = expiryFrom(now);
  const update: Record<string, unknown> = {
    'timestamps.lastActiveAt': Timestamp.fromDate(now),
    'timestamps.expiresAt': expiresAt,
    purgeAt,
  };
  if (needsRelocation(knownFingerprintOf(data), fingerprintOf(request.ip))) {
    update.lastLocation = await locateRequest(request.ip);
  }
  // Νέα σύνδεση στον ίδιο browser (επανασύνδεση · κλειδί μετά από «αποσύνδεση όλων») ⇒ η εγγραφή τη μαθαίνει.
  if (request.authTimeSec !== undefined && signInOf(data) !== request.authTimeSec) {
    update['signIn.authTimeSec'] = request.authTimeSec;
  }

  await ref.update(update);
  return true;
}

/**
 * Όσες ζωντανές ξεπερνούν το όριο (κρατώντας χώρο για τη νέα) ανακαλούνται· όσες έληξαν σημαίνονται.
 * @returns οι συνδέσεις των ανακλημένων — «ανακλήθηκε» σημαίνει και αποσυνδέθηκε (ADR-894 §10 Β1).
 */
async function enforceSessionCap(tx: Transaction, uid: string, now: Date): Promise<(number | undefined)[]> {
  const active = await tx.get(
    sessionsOf(uid).where('status', '==', 'active').orderBy('timestamps.lastActiveAt', 'desc'),
  );
  const facts = active.docs.map((doc) => lifeFactsOf(doc.id, doc.data()));
  const plan = planSessionCap(facts, now.getTime(), MAX_CONCURRENT_SESSIONS);
  const byId = new Map(active.docs.map((doc) => [doc.id, doc.ref]));
  const signInById = new Map(active.docs.map((doc) => [doc.id, signInOf(doc.data())]));
  const purgeAt = Timestamp.fromMillis(now.getTime() + SESSION_RETENTION_DAYS * DAY_MS);
  // Το `expired` γίνεται **πραγματική** κατάσταση (κανείς δεν το έγραφε) — και αποκτά ημερομηνία σβησίματος.
  for (const id of plan.expire) {
    const ref = byId.get(id);
    if (ref) tx.update(ref, { status: 'expired', purgeAt });
  }
  for (const id of plan.revoke) {
    const ref = byId.get(id);
    if (ref) tx.update(ref, endedFields('auto_revoked_max_sessions', now));
  }
  return plan.revoke.map((id) => signInById.get(id));
}

async function createSession(request: ActiveSessionRequest, now: Date): Promise<string> {
  const sessionId = generateSessionId();
  const location = await locateRequest(request.ip);
  const { expiresAt, purgeAt } = expiryFrom(now);
  const createdAt = Timestamp.fromDate(now);

  const capped = await getAdminFirestore().runTransaction(async (tx) => {
    const revokedSignIns = await enforceSessionCap(tx, request.uid, now);
    tx.create(sessionsOf(request.uid).doc(sessionId), {
      id: sessionId,
      userId: request.uid,
      deviceInfo: request.deviceInfo,
      location,
      ...(request.authTimeSec !== undefined ? { signIn: { authTimeSec: request.authTimeSec } } : {}),
      timestamps: { createdAt, lastActiveAt: createdAt, expiresAt },
      status: 'active',
      metadata: {
        loginMethod: request.loginMethod,
        rememberMe: false,
        twoFactorUsed: false,
        appVersion: getDeploymentId() ?? '1.0.0',
        source: 'web',
      },
      purgeAt,
    });
    return revokedSignIns;
  });
  await denySignIns(request.uid, capped, request.authTimeSec);
  // ADR-894 §10 Β3 — νέα χώρα/συσκευή για τον λογαριασμό ⇒ ο άνθρωπος το μαθαίνει (ποτέ δεν ρίχνει).
  await alertOnNovelSignIn({ uid: request.uid, sessionId, deviceInfo: request.deviceInfo, location, now });
  return sessionId;
}

/** «Αυτός ο browser είναι ενεργός»: αγγίζει τη γνωστή εγγραφή ή γεννά νέα. */
export async function syncActiveSession(request: ActiveSessionRequest): Promise<SyncActiveSessionResult> {
  const now = new Date();
  if (request.sessionId && (await touchSession(request, request.sessionId, now))) {
    return { sessionId: request.sessionId, created: false };
  }
  return { sessionId: await createSession(request, now), created: true };
}

export interface RevokeSessionOutcome extends SignInRevocationOutcome {
  /** `false` = η εγγραφή δεν υπάρχει (κάτω από αυτόν τον χρήστη). */
  readonly found: boolean;
}

/**
 * Ανάκληση **μίας** εγγραφής του ίδιου χρήστη — **και** της σύνδεσής της (ADR-894 §10 Β1). Ιδεμποτική.
 * @param callerAuthTimeSec Η σύνδεση του καλούντα: δεν ανακαλείται ποτέ ως «άλλη συσκευή». Στο `logout` η
 *   ανακλώμενη **είναι** του καλούντα, και ανακαλείται — ένα αντίγραφο του cookie δεν επιβιώνει της αποσύνδεσης.
 */
export async function revokeSession(
  uid: string,
  sessionId: string,
  reason: SessionRevocationReason,
  callerAuthTimeSec?: number,
): Promise<RevokeSessionOutcome> {
  const ref = sessionsOf(uid).doc(sessionId);
  const snap = await ref.get();
  if (!snap.exists) return { found: false, everySignInEnded: false };
  if (snap.data()?.status === 'active') await ref.update(endedFields(reason, new Date()));
  const guard = reason === 'logout' ? undefined : callerAuthTimeSec;
  return { found: true, ...(await denySignIns(uid, [signInOf(snap.data())], guard)) };
}

/**
 * Ανάκληση **όλων των άλλων** — εγγραφές **και** διαπιστευτήρια (`revokeRefreshTokens`, ADR-894 §10 Β1).
 * Η Firebase δεν ανακαλεί «όλες εκτός από μία»: ανακαλούνται όλες, και η διαδρομή δίνει στον καλούντα κλειδί
 * νέας συνεδρίας (`reissueCallerSession`). Επιστρέφει τα id των εγγραφών που ανακλήθηκαν.
 */
export async function revokeOtherSessions(uid: string, keepSessionId: string | null): Promise<string[]> {
  const now = new Date();
  const active = await sessionsOf(uid)
    .where('status', '==', 'active')
    .orderBy('timestamps.lastActiveAt', 'desc')
    .get();
  const targets = active.docs.filter((doc) => doc.id !== keepSessionId);
  if (targets.length > 0) {
    const batch = getAdminFirestore().batch();
    for (const doc of targets) batch.update(doc.ref, endedFields('revoked_all_other', now));
    await batch.commit();
  }
  // Και χωρίς ορατή εγγραφή: μια συσκευή μπορεί να κρατά token χωρίς ζωντανή εγγραφή (έληξε, ή πριν τη Φάση 1).
  await endEverySignIn(uid);
  return targets.map((doc) => doc.id);
}
