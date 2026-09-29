/**
 * @fileoverview **ΤΙ ΓΙΝΕΤΑΙ ΜΙΑ ΕΓΓΡΑΦΗ ΣΥΝΕΔΡΙΑΣ ΤΗΣ ΕΠΟΧΗΣ ipapi** — ADR-894 §10 Β4 (καθαρός σχεδιαστής).
 * @related app/api/admin/migrations/scrub-legacy-session-locations (το κέλυφος) · session-helpers (`LEGACY_LOCATION`)
 * @module services/session/legacy-session-scrub
 *
 * Μετρημένο 2026-09-29 (Firestore, μόνο ανάγνωση): **9.095** εγγραφές σε έναν λογαριασμό — 9.023 `revoked`
 * (το σφάλμα «νέα εγγραφή ανά καρτέλα» + το όριο των 10), 10 «`active`», οι υπόλοιπες `expired` — **καμία** με
 * `purgeAt` ⇒ το TTL δεν θα τις έσβηνε **ποτέ**. Όλες κρατούν τοποθεσία από το `ipapi.co` (`ipHash`, `countryName`,
 * `city`, `timezone`), αποθηκευμένη πέρα από τις 24 ώρες που επιτρέπουν οι όροι του.
 *
 * 🔑 **Όπως οι μεγάλοι — ελαχιστοποίηση + διατήρηση, όχι μαζικό σβήσιμο με κώδικα**:
 * 1. Η τοποθεσία **φεύγει τώρα** (`LEGACY_LOCATION` — το ίδιο σχήμα που ήδη δείχνει η οθόνη για αυτές).
 * 2. Η εγγραφή παίρνει `purgeAt` = τέλος + 90 ημέρες (η **ίδια** πολιτική με τις νέες) ⇒ το σβήσιμο το κάνει το TTL,
 *    ο ένας μηχανισμός διατήρησης. Όσες είναι ήδη πέρα από τις 90 ημέρες σβήνουν στο επόμενο πέρασμα του TTL.
 * 3. «`active`» που έχει λήξει γίνεται `expired` (ό,τι κάνει ήδη ο γραφέας για τις νέες).
 * 4. Το αποθηκευμένο `isCurrent` (αλήθεια «ανά θεατή», καταργημένη στη Φάση 1) φεύγει.
 * Ιδεμποτικό: εγγραφή με `precision` (νέο σχήμα) δεν αγγίζεται ⇒ δεύτερη εκτέλεση = 0 αλλαγές.
 */

import { LEGACY_LOCATION, SESSION_RETENTION_DAYS } from './session-helpers';
import type { SessionLocation } from './session.types';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Τα γεγονότα μιας αποθηκευμένης εγγραφής — χρόνοι σε ms (`null` όταν λείπουν). */
export interface LegacyScrubFacts {
  readonly location: unknown;
  readonly status: unknown;
  readonly expiresAtMs: number | null;
  readonly revokedAtMs: number | null;
  readonly hasPurgeAt: boolean;
  readonly hasIsCurrent: boolean;
}

export interface LegacyScrubUpdate {
  readonly location: SessionLocation;
  readonly purgeAtMs: number | null;
  readonly markExpired: boolean;
  readonly dropIsCurrent: boolean;
}

export type LegacyScrubPlan = { readonly kind: 'skip' } | { readonly kind: 'scrub'; readonly update: LegacyScrubUpdate };

/** Νέο σχήμα = η τοποθεσία δηλώνει `precision`. Οτιδήποτε άλλο είναι της εποχής ipapi. */
export function isLegacySessionLocation(location: unknown): boolean {
  return !(typeof location === 'object' && location !== null && 'precision' in location);
}

export function planLegacySessionScrub(facts: LegacyScrubFacts, nowMs: number): LegacyScrubPlan {
  if (!isLegacySessionLocation(facts.location)) return { kind: 'skip' };

  const alive = facts.status === 'active' && facts.expiresAtMs !== null && facts.expiresAtMs > nowMs;
  const endedAtMs = facts.revokedAtMs ?? facts.expiresAtMs ?? nowMs;
  const purgeAtMs = facts.hasPurgeAt ? null : Math.max(endedAtMs + SESSION_RETENTION_DAYS * DAY_MS, nowMs);

  return {
    kind: 'scrub',
    update: {
      location: LEGACY_LOCATION,
      purgeAtMs,
      markExpired: facts.status === 'active' && !alive,
      dropIsCurrent: facts.hasIsCurrent,
    },
  };
}
