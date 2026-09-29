/**
 * @fileoverview **Οι αποφάσεις του κύκλου ζωής μιας συνεδρίας** — καθαρές συναρτήσεις, χωρίς Firestore (ADR-894).
 * @related `session-server.service.ts` (το κέλυφος που τις εκτελεί) · `session-helpers.ts` (οι σταθερές)
 * @module services/session/session-lifecycle
 *
 * 🔑 **Functional core, imperative shell**: ό,τι **κρίνει** (ζει; άλλαξε δίκτυο; ποιες λήγουν, ποιες ανακαλούνται;)
 * ζει εδώ και δοκιμάζεται εξαντλητικά· ο γραφέας μόνο διαβάζει και γράφει. Ένα σφάλμα στο «ποια ανακαλείται»
 * αποσυνδέει λάθος συσκευή — δεν πρέπει να κρύβεται πίσω από mock συναλλαγής.
 */

/** Η ελάχιστη μορφή μιας αποθηκευμένης εγγραφής για τις αποφάσεις — χρόνοι σε ms. */
export interface SessionLifeFacts {
  readonly id: string;
  readonly status: unknown;
  /** `null` όταν λείπει ή δεν είναι χρόνος. */
  readonly expiresAtMs: number | null;
}

/** «Ζει» = `active` **και** η λήξη είναι μελλοντική. Εγγραφή χωρίς λήξη **δεν** ζει (fail-closed). */
export function isSessionAlive(facts: Pick<SessionLifeFacts, 'status' | 'expiresAtMs'>, nowMs: number): boolean {
  return facts.status === 'active' && facts.expiresAtMs !== null && facts.expiresAtMs > nowMs;
}

interface StoredLocationLike {
  readonly ipFingerprint?: unknown;
}

/** Το τελευταίο **γνωστό** αποτύπωμα δικτύου της εγγραφής (πρώτα η τελευταία θέση, μετά της σύνδεσης). */
export function knownFingerprintOf(data: { location?: StoredLocationLike; lastLocation?: StoredLocationLike } | undefined): string | null {
  const value = data?.lastLocation?.ipFingerprint ?? data?.location?.ipFingerprint;
  return typeof value === 'string' ? value : null;
}

/** Χρειάζεται νέα επίλυση θέσης; Μόνο όταν **άλλαξε** το δίκτυο — όχι σε κάθε άγγιγμα. */
export function needsRelocation(known: string | null, current: string | null): boolean {
  return known !== current;
}

export interface SessionCapPlan {
  /** `active` αλλά ληγμένες ⇒ `expired` (κανείς άλλος δεν γράφει αυτή την κατάσταση). */
  readonly expire: readonly string[];
  /** Οι **παλαιότερες** ζωντανές πέρα από το όριο — κρατώντας θέση για τη νέα. */
  readonly revoke: readonly string[];
}

/**
 * Πριν γεννηθεί νέα εγγραφή. `activeNewestFirst` = οι `active` με σειρά τελευταίας δραστηριότητας (νεότερη πρώτη).
 * Μένουν ζωντανές το πολύ `limit - 1`, ώστε με τη νέα να είναι `limit` (`MAX_CONCURRENT_SESSIONS`, από τον καλούντα —
 * ο πυρήνας δεν εισάγει τίποτα, ώστε τα helpers να τον εισάγουν χωρίς κύκλο).
 */
export function planSessionCap(
  activeNewestFirst: readonly SessionLifeFacts[],
  nowMs: number,
  limit: number,
): SessionCapPlan {
  const alive = activeNewestFirst.filter((facts) => isSessionAlive(facts, nowMs));
  return {
    expire: activeNewestFirst.filter((facts) => !isSessionAlive(facts, nowMs)).map((facts) => facts.id),
    revoke: alive.slice(Math.max(limit - 1, 0)).map((facts) => facts.id),
  };
}

// ============================================================================
// ADR-894 §10 Β2 — «Συνεδρίες που τελείωσαν» (Google «Your devices»: 28 ημέρες)
// ============================================================================

/** Το παράθυρο της λίστας συσκευών — ζωντανές **και** όσες τελείωσαν μέσα σε αυτό (Google: 28 ημέρες). */
export const SESSION_HISTORY_WINDOW_DAYS = 28;

/** Γιατί τελείωσε μια συνεδρία — κλειστό σύνολο, κάθε τιμή έχει κείμενο στο locale. */
export type SessionEndReason = 'signed_out' | 'removed' | 'device_limit' | 'expired';

const END_REASON_BY_REVOCATION: Readonly<Record<string, SessionEndReason>> = {
  logout: 'signed_out',
  user_requested: 'removed',
  revoked_all_other: 'removed',
  auto_revoked_max_sessions: 'device_limit',
};

/** Ανακλημένη με άγνωστο λόγο (παλιά εγγραφή) ⇒ «αφαιρέθηκε»· οτιδήποτε άλλο που δεν ζει ⇒ «έληξε». */
export function endReasonOf(status: unknown, revocationReason: unknown): SessionEndReason {
  if (status !== 'revoked') return 'expired';
  return (typeof revocationReason === 'string' && END_REASON_BY_REVOCATION[revocationReason]) || 'removed';
}

/** Η ελάχιστη μορφή που χρειάζεται ο διαχωρισμός — ταιριάζει δομικά στο `UserSession`. */
export interface OverviewSessionLike {
  readonly status: unknown;
  readonly revocationReason?: unknown;
  readonly timestamps: { readonly expiresAt: Date; readonly lastActiveAt: Date; readonly revokedAt?: Date };
}

export interface EndedSession<S> {
  readonly session: S;
  readonly reason: SessionEndReason;
  /** Η ανάκληση αν υπάρχει· αλλιώς η λήξη — ποτέ στο μέλλον (μια `active` ληγμένη τελείωσε όταν έληξε). */
  readonly endedAt: Date;
}

export interface SessionsOverview<S = OverviewSessionLike> {
  readonly live: readonly S[];
  readonly ended: readonly EndedSession<S>[];
}

/** Ζωντανές με τη σειρά που ήρθαν· τελειωμένες από την πιο πρόσφατη. */
export function partitionSessionsOverview<S extends OverviewSessionLike>(sessions: readonly S[], now: Date): SessionsOverview<S> {
  const nowMs = now.getTime();
  const live: S[] = [];
  const ended: EndedSession<S>[] = [];
  for (const session of sessions) {
    const expiresAtMs = session.timestamps.expiresAt.getTime();
    if (isSessionAlive({ status: session.status, expiresAtMs }, nowMs)) {
      live.push(session);
      continue;
    }
    const endedAt = session.timestamps.revokedAt ?? new Date(Math.min(expiresAtMs, nowMs));
    ended.push({ session, reason: endReasonOf(session.status, session.revocationReason), endedAt });
  }
  ended.sort((a, b) => b.endedAt.getTime() - a.endedAt.getTime());
  return { live, ended };
}
