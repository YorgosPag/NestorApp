'use client';

/**
 * @fileoverview **Ο ΕΝΑΣ ΚΑΤΟΧΟΣ ΤΗΣ ΑΠΟΣΥΝΔΕΣΗΣ** — μία πράξη, σταθερή σειρά, τέλος που δεν ανατρέπεται (ADR-908 §3.1).
 * @related ./end-sign-in-destinations (ο πίνακας προορισμών) · contexts/auth-context/session-handover ·
 *   contexts/auth-context/identity-epoch · lib/browser/document-navigation
 * @module auth/identity-change/end-sign-in
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΙ ΕΚΛΕΙΣΕ (μετρημένο στην παραγωγή, 2026-10-08)
 * ────────────────────────────────────────────────────────────────────────────
 * Το μενού έκανε `router.push('/login')` στα **6 ms** και αποσύνδεε στο παρασκήνιο (1,6 s). Στο μεταξύ η φόρμα
 * σύνδεσης έβλεπε `!loading && user` και έστελνε τον άνθρωπο **πίσω**, ο `ProtectedRoute` τον ξανάστελνε στο
 * `/login?next=…`, και ο ακροατής των claims **ξαναζητούσε** το cookie που μόλις είχε σβηστεί. Η απάντηση του
 * διακομιστή για ανώνυμο έμενε στη μνήμη του δρομολογητή και σερβιριζόταν στον **επόμενο** που συνδεόταν ⇒ βρόχος.
 *
 * 🔑 **Η ΣΕΙΡΑ ΕΙΝΑΙ ΤΟ ΣΥΜΒΟΛΑΙΟ**:
 * 1. **Φράχτης** — ο ακροατής claims σωπαίνει **πριν** η ανάκληση ανεβάσει το `claimsUpdatedAt`.
 * 2. **Εποχή** — ό,τι εκκρεμεί μετά από `await` ανήκει πια σε άνθρωπο που φεύγει, και παραιτείται.
 * 3. Εγγραφή συσκευής → Firebase → cookie διακομιστή (**μία** φορά, awaited).
 * 4. **Πλοήγηση εγγράφου** — το έγγραφο πεθαίνει· μνήμη δρομολογητή, React state και ακροατές **δεν υπάρχουν πια**.
 *
 * ⛔ **ΚΑΜΙΑ `router.*` ΕΔΩ, ΚΑΙ ΚΑΜΙΑ ΠΛΟΗΓΗΣΗ ΠΡΙΝ ΤΟ ΒΗΜΑ 4.** Η «αισιόδοξη» πλοήγηση ήταν η πηγή και των δύο
 * ελαττωμάτων. Το κόστος είναι δεκτό: το κουμπί δείχνει «Αποσύνδεση…» ~1,5 s.
 * ⚠️ Κάθε σκέλος σε δικό του `try`: μια αποτυχία δεν επιτρέπεται να αφήσει τον άνθρωπο σε έγγραφο που δεν
 * ξέρει αν είναι συνδεδεμένος — η σελίδα σύνδεσης είναι ο σωστός τόπος και για να ξαναδοκιμάσει.
 */

import { signOut as firebaseSignOut } from 'firebase/auth';

import { auth } from '@/lib/firebase';
import { navigateDocument } from '@/lib/browser/document-navigation';
import { createModuleLogger } from '@/lib/telemetry';
import { sessionService } from '@/services/session';

import { clearServerSessionCookie } from '../contexts/auth-context/auth-context-session';
import { advanceIdentityEpoch } from '../contexts/auth-context/identity-epoch';
import { beginSessionHandover } from '../contexts/auth-context/session-handover';
import {
  destinationAfterSignIn,
  type EndSignInDestination,
  type EndSignInRequest,
} from './end-sign-in-destinations';

const logger = createModuleLogger('EndSignIn');

/** Το συμβάν που ακούν οι αποθήκες πελάτη για να αδειάσουν ό,τι ανήκει στον άνθρωπο. */
const SIGN_OUT_EVENT = 'auth:logout';

type Outcome = EndSignInDestination['kind'];

let inFlight: Promise<Outcome> | null = null;

/** Τρέχει αποσύνδεση; — ο ακροατής ταυτότητας δεν ξανασβήνει cookie ούτε κατεβάζει το `loading` όσο απαντά «ναι». */
export function isEndSignInActive(): boolean {
  return inFlight !== null;
}

async function attempt(step: string, run: () => Promise<void> | void): Promise<void> {
  try {
    await run();
  } catch (error: unknown) {
    logger.warn('Sign-out step failed — continuing', { step, error });
  }
}

async function run(request: EndSignInRequest): Promise<Outcome> {
  const destination = destinationAfterSignIn(request);
  const endHandover = beginSessionHandover();
  advanceIdentityEpoch();
  logger.info('Ending sign-in', { reason: request.reason });

  await attempt('announce', () => { window.dispatchEvent(new CustomEvent(SIGN_OUT_EVENT)); });
  // ADR-894 — η εγγραφή «αυτή η συσκευή» κλείνει ΠΡΙΝ χαθεί το token (μετά δεν θα μπορούσε).
  const uid = auth.currentUser?.uid;
  if (uid !== undefined) await attempt('device-session', () => sessionService.endCurrentSession(uid));
  await attempt('firebase', () => firebaseSignOut(auth));
  await attempt('server-cookie', () => clearServerSessionCookie());

  if (destination.kind === 'stay') {
    endHandover();
    inFlight = null;
    return 'stay';
  }
  // ⚠️ Ο φράχτης και το `inFlight` ΔΕΝ κλείνουν: το έγγραφο τελειώνει, και ως τότε κανείς δεν ξαναγράφει ταυτότητα.
  navigateDocument(destination.href, { replace: true });
  return 'navigate';
}

/**
 * **Τελειώνει τη σύνδεση αυτού του browser.** Ιδεμποτικό: δεύτερη κλήση όσο τρέχει η πρώτη (διπλό κλικ, δύο
 * σήματα ανάκλησης) παίρνει την **ίδια** πράξη — ο πρώτος λόγος κερδίζει.
 *
 * @returns `navigate` ⇒ το έγγραφο φεύγει (μην αγγίξεις κατάσταση)· `stay` ⇒ η σελίδα συνεχίζει ανώνυμη.
 */
export function endSignIn(request: EndSignInRequest): Promise<Outcome> {
  if (inFlight === null) inFlight = run(request);
  return inFlight;
}
