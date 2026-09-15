/**
 * @fileoverview **«ΝΑΙ, ΑΥΤΟ ΤΟ ΓΡΑΜΜΑΤΟΚΙΒΩΤΙΟ ΛΑΜΒΑΝΕΙ» / «ΔΕΝ ΤΟ ΖΗΤΗΣΑ ΕΓΩ»** — η απόφαση του παραλήπτη
 *   (ADR-841 §7 Α21.18).
 * @related app/(auth)/card-email/[token]/page.tsx (ανάγνωση) · app/api/showcase-email-confirmations/[token]/route.ts
 *   (απόφαση) · services/mandate/showcase-email-confirmation.service.ts (έκδοση) ·
 *   services/mandate/showcase-email-confirmation-store.ts (τα δύο μισά του σήματος)
 * @module services/mandate/showcase-email-confirmation-decision
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🏆 ΔΥΟ ΣΥΝΑΡΤΗΣΕΙΣ, ΚΑΙ Η ΔΙΑΚΡΙΣΗ ΤΟΥΣ ΕΙΝΑΙ ΟΛΗ Η ΑΣΦΑΛΕΙΑ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Οι σαρωτές αλληλογραφίας (Microsoft Defender Safe Links, Outlook, εταιρικές πύλες) **ανοίγουν κάθε
 * σύνδεσμο πριν τον άνθρωπο**. Σελίδα που εξαργυρώνει στο `GET` καίγεται από μηχανή — και ο άνθρωπος
 * βλέπει «ήδη χρησιμοποιήθηκε» (keycloak#41834 · zitadel 11669).
 *
 * ⇒ {@link readShowcaseEmailConfirmation} **μόνο διαβάζει** (η σελίδα). {@link decideShowcaseEmailConfirmation}
 * **μόνο** από κουμπί (`POST`). Ίδιο σχήμα με το RFC 8058 και με το αδελφό `mandate/[token]`.
 *
 * 🔴 **Η ΑΠΟΦΑΣΗ ΕΙΝΑΙ ΜΙΑ ΣΥΝΑΛΛΑΓΗ**: κατάσταση αιτήματος · «είναι ακόμη η διεύθυνση στην κάρτα;» ·
 * ημερομηνία στο ιδιωτικό κανάλι · ημερομηνία στο δημόσιο κατάστημα · σφράγισμα. Μια αποθήκευση κάρτας
 * που αλλάζει το email **την ίδια στιγμή** διαβάζει τα ίδια έγγραφα, οπότε όποιος χάσει ξαναεκτελείται —
 * σήμα πάνω σε διεύθυνση που μόλις έφυγε είναι **αδύνατο**, όχι απίθανο.
 */

import 'server-only';

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { withConfirmation } from '@/lib/agency/showcase-email-confirmation-rules';
import { nowISO as clockNowISO } from '@/lib/date-local';
import { createModuleLogger } from '@/lib/telemetry';
import {
  readStoredConfirmationState,
  type ShowcaseEmailConfirmationDecision,
  type ShowcaseEmailConfirmationDocument,
  type ShowcaseEmailConfirmationRefusal,
  type ShowcaseEmailConfirmationRequest,
} from '@/types/showcase-email-confirmation';

import { readCardWithEmail, writeLocationConfirmations } from './showcase-email-confirmation-store';
import { confirmationSecret, readConfirmationLink, type ConfirmationLinkFields } from './showcase-email-confirmation-token';

const logger = createModuleLogger('showcase-email-confirmation-decision');

/** Ό,τι ζωγραφίζει η σελίδα — **τίποτα** πέρα από αυτό δεν ταξιδεύει στο HTML. */
export interface ShowcaseEmailConfirmationView {
  readonly agencyName: string;
  readonly email: string;
  readonly expiresAt: string;
}

/** `unavailable` = **δικό μας** πρόβλημα (μυστικό · βάση) — ποτέ «ο σύνδεσμός σου είναι άκυρος». */
export type ShowcaseEmailConfirmationLookup =
  | { readonly ok: true; readonly view: ShowcaseEmailConfirmationView }
  | { readonly ok: false; readonly reason: ShowcaseEmailConfirmationRefusal | 'unavailable' };

export type ShowcaseEmailConfirmationOutcome =
  | { readonly ok: true; readonly decision: ShowcaseEmailConfirmationDecision }
  | { readonly ok: false; readonly reason: ShowcaseEmailConfirmationRefusal | 'unavailable' };

type Refused = { readonly ok: false; readonly reason: ShowcaseEmailConfirmationRefusal | 'unavailable' };
const refuse = (reason: ShowcaseEmailConfirmationRefusal | 'unavailable'): Refused => ({ ok: false, reason });

function readRequest(data: unknown): ShowcaseEmailConfirmationRequest {
  const raw = data as ShowcaseEmailConfirmationDocument;
  return { ...raw, state: readStoredConfirmationState(raw.state) };
}

function stateRefusal(request: ShowcaseEmailConfirmationRequest, now: string): ShowcaseEmailConfirmationRefusal | null {
  if (request.state === 'confirmed') return 'already-confirmed';
  if (request.state === 'disowned') return 'already-disowned';
  if (request.state === 'superseded') return 'superseded';
  const expires = Date.parse(request.expiresAt);
  return !Number.isFinite(expires) || expires <= Date.parse(now) ? 'expired' : null;
}

function linkOf(token: string): ConfirmationLinkFields | 'unavailable' | null {
  const secret = confirmationSecret();
  if (secret === null) {
    logger.error('[CARD-EMAIL] Λείπει το μυστικό — κάθε σύνδεσμος φαίνεται μη διαθέσιμος');
    return 'unavailable';
  }
  return readConfirmationLink(secret, token);
}

/**
 * **Η σελίδα ρωτά: «τι είναι αυτός ο σύνδεσμος;»** — ⛔ **ΚΑΜΙΑ ΕΓΓΡΑΦΗ**. Ο σαρωτής που την ανοίγει
 * πρώτος δεν αλλάζει τίποτα.
 */
export async function readShowcaseEmailConfirmation(
  adminDb: AdminFirestore,
  token: string,
  nowISOValue: string = clockNowISO(),
): Promise<ShowcaseEmailConfirmationLookup> {
  const link = linkOf(token);
  if (link === 'unavailable') return refuse('unavailable');
  if (link === null) return refuse('link-invalid');
  try {
    const snapshot = await adminDb.collection(COLLECTIONS.SHOWCASE_EMAIL_CONFIRMATIONS).doc(link.id).get();
    if (!snapshot.exists) return refuse('request-unknown');
    const request = readRequest(snapshot.data());
    if (request.nonce !== link.nonce) return refuse('link-invalid');
    const unusable = stateRefusal(request, nowISOValue);
    if (unusable !== null) return refuse(unusable);
    const card = await readCardWithEmail(adminDb, request);
    if (card === null) return refuse('email-changed');
    return { ok: true, view: { agencyName: card.agencyName, email: request.email, expiresAt: request.expiresAt } };
  } catch (error) {
    logger.error('[CARD-EMAIL] Η ανάγνωση αιτήματος απέτυχε', { error: error instanceof Error ? error.message : String(error) });
    return refuse('unavailable');
  }
}

async function decide(
  adminDb: AdminFirestore,
  link: ConfirmationLinkFields,
  decision: ShowcaseEmailConfirmationDecision,
  now: string,
): Promise<ShowcaseEmailConfirmationOutcome> {
  const requestRef = adminDb.collection(COLLECTIONS.SHOWCASE_EMAIL_CONFIRMATIONS).doc(link.id);
  return adminDb.runTransaction(async (tx): Promise<ShowcaseEmailConfirmationOutcome> => {
    const snapshot = await tx.get(requestRef);
    if (!snapshot.exists) return refuse('request-unknown');
    const request = readRequest(snapshot.data());
    if (request.nonce !== link.nonce) return refuse('link-invalid');
    const unusable = stateRefusal(request, now);
    if (unusable !== null) return refuse(unusable);

    if (decision === 'confirm') {
      const card = await readCardWithEmail(adminDb, request, tx);
      if (card === null) return refuse('email-changed');
      // Ημερομηνία στο ιδιωτικό κανάλι **και** στο δημόσιο κατάστημα, από την **ίδια** λίστα.
      writeLocationConfirmations(adminDb, tx, request, card, withConfirmation(card.channels.emailConfirmations, request.email, now));
    }
    // 🔑 «Δεν το ζήτησα εγώ» σφραγίζει ΜΟΝΟ το αίτημα: δεν αγγίζει σήμα που υπήρχε ήδη από παλιότερη,
    //    νόμιμη επιβεβαίωση — ένας τρίτος που έστειλε σύνδεσμο δεν μπορεί να σβήσει ξένη απόδειξη.
    tx.update(requestRef, { state: decision === 'confirm' ? 'confirmed' : 'disowned', settledAt: now });
    return { ok: true, decision };
  });
}

/**
 * **Το κουμπί.** Υπογραφή πριν από κάθε ανάγνωση· όλα τα υπόλοιπα σε **μία** συναλλαγή — δύο πατήματα
 * (διπλό κλικ, δύο καρτέλες) δίνουν **μία** επιβεβαίωση και ένα `already-confirmed`.
 */
export async function decideShowcaseEmailConfirmation(
  adminDb: AdminFirestore,
  token: string,
  decision: ShowcaseEmailConfirmationDecision,
  nowISOValue: string = clockNowISO(),
): Promise<ShowcaseEmailConfirmationOutcome> {
  const link = linkOf(token);
  if (link === 'unavailable') return refuse('unavailable');
  if (link === null) return refuse('link-invalid');
  try {
    return await decide(adminDb, link, decision, nowISOValue);
  } catch (error) {
    logger.error('[CARD-EMAIL] Η απόφαση απέτυχε', { error: error instanceof Error ? error.message : String(error) });
    return refuse('unavailable');
  }
}
