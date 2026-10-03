/**
 * =============================================================================
 * Ο ΚΡΙΤΗΣ ΤΗΣ ΣΥΜΜΕΤΟΧΗΣ — η ετυμηγορία `engaged` (ADR-862 §5.3.2 · Φ1)
 * =============================================================================
 *
 * **Το ερώτημα**: *«Συμμετέχει αυτός ο άνθρωπος, ΤΩΡΑ, σε ΑΥΤΗ την υπόθεση, για ΑΥΤΟ το εύρος;»*
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΔΕΝ ΕΙΝΑΙ ΤΡΙΤΗ ΤΙΜΗ ΤΟΥ `decideMembership` (απόκλιση από το ADR-862 §5.3.2)
 * ─────────────────────────────────────────────────────────────────────────────
 * Το σχέδιο έλεγε «τρίτη ετυμηγορία δίπλα στο `member`». Μετρημένο στον κώδικα 2026-10-02: κάθε
 * **επιτρέπουσα** ετυμηγορία του `decideMembership` κάνει το `auth-context` να δέσει το αίτημα στο
 * `companyId` του **οικοδεσπότη** — δηλαδή ο δικηγόρος μιας υπόθεσης θα γινόταν μέλος **ολόκληρου**
 * του γραφείου (CRM · λογιστικά · όλα τα έργα): ακριβώς η υπερ-παραχώρηση που απορρίπτει το ADR-862 §9.
 * ⇒ Η κρίση γίνεται **ανά πόρο** (AuthZEN: subject × action × **resource**), εδώ.
 *
 * 🔑 **Η λήξη/ανάκληση/εύρος ΔΕΝ ξαναγράφονται**: τα κρίνει το `evaluateScopedGrant` (ADR-884 Φ0.5) —
 *    ο ΕΝΑΣ έλεγχος «ισχύει ακόμη;» της πλατφόρμας, που ήδη ξεχωρίζει `revoked` από `expired` (Α4)
 *    και αρνείται ό,τι δεν διαβάζεται (`unreadable-expiry`).
 *
 * **Καθαρό · σύγχρονο · κανένα SDK** — το διαβάζουν server, άγκυρες και (αν χρειαστεί) πελάτης.
 *
 * @module lib/auth/engagement-judge
 * @see types/engagement.ts · lib/auth/engagement-read.ts (ποιο έγγραφο) · ADR-862 Α1/Α3/Α4
 */

import { evaluateScopedGrant, type ScopedGrantVerdict } from './scoped-grant';
import type {
  Engagement,
  EngagementDecision,
  EngagementScope,
  EngagementState,
  EngagementSubject,
  EngagementVerdict,
} from '@/types/engagement';

/** Ετυμηγορία ανά **τελική/αναμένουσα** κατάσταση — `null` = «ζωντανή, κρίνεται από το grant». */
const VERDICT_BY_STATE: Readonly<Record<EngagementState, EngagementVerdict | null>> = {
  offered: 'offered',
  active: null,
  declined: 'declined',
  withdrawn: 'withdrawn',
  revoked: 'revoked',
  expired: 'expired',
  completed: 'completed',
};

/** Η ετυμηγορία του κοινού κριτή → της συμμετοχής (ίδια ονόματα, ένας χάρτης). */
const VERDICT_BY_GRANT: Readonly<Record<ScopedGrantVerdict, EngagementVerdict>> = {
  granted: 'engaged',
  revoked: 'revoked',
  expired: 'expired',
  'unreadable-expiry': 'unreadable-expiry',
  'scope-missing': 'scope-missing',
};

/** Δείχνει αυτή η συμμετοχή στην υπόθεση που ζητήθηκε; */
function isSameSubject(a: EngagementSubject, b: EngagementSubject): boolean {
  return a.kind === b.kind && a.caseId === b.caseId;
}

export interface EngagementQuery {
  /** Η συμμετοχή όπως τη διάβασε ο αναγνώστης — `null` ⇒ δεν υπάρχει. */
  readonly engagement: Engagement | null;
  /** Ο άνθρωπος που ρωτά — από το υπογεγραμμένο token, ποτέ από το σώμα. */
  readonly uid: string;
  readonly subject: EngagementSubject;
  readonly scope: EngagementScope;
  /** Η στιγμή της κρίσης — παράμετρος, ώστε τα tests να μην εξαρτώνται από το ρολόι. */
  readonly nowMs: number;
}

/**
 * **Η κρίση.** Σειρά = συμβόλαιο:
 *   1. καμία συμμετοχή · άλλος άνθρωπος · άλλη υπόθεση ⇒ `not-engaged` (Α1 — ο συμβολαιογράφος
 *      του διαμερίσματος Α **δεν** βλέπει το Β του ίδιου έργου)
 *   2. μη ζωντανή κατάσταση ⇒ η ετυμηγορία **της** (offered ≠ declined ≠ revoked ≠ completed)
 *   3. ζωντανή ⇒ `evaluateScopedGrant` (ανάκληση · λήξη · εύρος)
 */
export function decideEngagement(query: EngagementQuery): EngagementDecision {
  const { engagement, uid, subject, scope, nowMs } = query;
  if (!engagement || engagement.uid !== uid || !isSameSubject(engagement.subject, subject)) {
    return { verdict: 'not-engaged', engagement: null };
  }
  const byState = VERDICT_BY_STATE[engagement.state];
  if (byState !== null) return { verdict: byState, engagement };
  return { verdict: VERDICT_BY_GRANT[evaluateScopedGrant(engagement, scope, nowMs)], engagement };
}

/** Επιτρέπει η ετυμηγορία πρόσβαση; — **μία** τιμή, όπως το `isContainerVisible`. */
export function isEngaged(verdict: EngagementVerdict): boolean {
  return verdict === 'engaged';
}
