/**
 * @fileoverview **«ΝΑΙ, ΑΥΤΟ ΤΟ ΓΡΑΜΜΑΤΟΚΙΒΩΤΙΟ ΛΑΜΒΑΝΕΙ» / «ΔΕΝ ΤΟ ΖΗΤΗΣΑ ΕΓΩ»** — η απόφαση του παραλήπτη
 *   (ADR-841 §7 Α21.18).
 * @related app/(auth)/card-email/[token]/page.tsx (ανάγνωση) · app/api/showcase-email-confirmations/[token]/route.ts
 *   (απόφαση) · services/mandate/showcase-email-confirmation.service.ts (έκδοση)
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

import type { DocumentSnapshot, Firestore as AdminFirestore, Transaction } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { readLocationChannels } from '@/lib/agency/showcase-card-channels-read';
import { latestConfirmedAt, withConfirmation } from '@/lib/agency/showcase-email-confirmation-rules';
import { readShowcase } from '@/lib/agency/showcase-read';
import { sameChannelEmail } from '@/lib/contact/channel-email';
import { nowISO as clockNowISO } from '@/lib/date-local';
import { createModuleLogger } from '@/lib/telemetry';
import type { ShowcaseLocation, ShowcaseLocationChannels } from '@/types/showcase-card';
import {
  readStoredConfirmationState,
  type ShowcaseEmailConfirmationDecision,
  type ShowcaseEmailConfirmationDocument,
  type ShowcaseEmailConfirmationRefusal,
  type ShowcaseEmailConfirmationRequest,
} from '@/types/showcase-email-confirmation';

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

/** Κάρτα που **ακόμη** δημοσιεύει αυτή τη διεύθυνση σε αυτό το κατάστημα — ή `null`. */
interface CardWithEmail {
  readonly agencyName: string;
  readonly locations: readonly ShowcaseLocation[];
  readonly channels: ShowcaseLocationChannels;
  readonly storedLocations: Record<string, unknown>;
}

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

function cardWithEmail(
  profile: DocumentSnapshot,
  channels: DocumentSnapshot,
  request: ShowcaseEmailConfirmationRequest,
): CardWithEmail | null {
  const read = profile.exists ? readShowcase(profile.data(), request.companyId) : null;
  if (read?.outcome !== 'showcase') return null;
  if (!read.showcase.locations.some(({ id }) => id === request.locationId)) return null;
  const stored = readLocationChannels(channels.data(), request.locationId);
  if (!stored.emails.some((email) => sameChannelEmail(email, request.email))) return null;
  const rawLocations = (channels.data() as { locations?: unknown } | undefined)?.locations;
  return {
    agencyName: read.showcase.displayName,
    locations: read.showcase.locations,
    channels: stored,
    storedLocations: typeof rawLocations === 'object' && rawLocations !== null ? (rawLocations as Record<string, unknown>) : {},
  };
}

function linkOf(token: string): ConfirmationLinkFields | 'unavailable' | null {
  const secret = confirmationSecret();
  if (secret === null) {
    logger.error('[CARD-EMAIL] Λείπει το μυστικό — κάθε σύνδεσμος φαίνεται μη διαθέσιμος');
    return 'unavailable';
  }
  return readConfirmationLink(secret, token);
}

async function cardOf(adminDb: AdminFirestore, request: ShowcaseEmailConfirmationRequest, tx?: Transaction): Promise<CardWithEmail | null> {
  const profileRef = adminDb.collection(COLLECTIONS.AGENCY_PROFILES).doc(request.companyId);
  const channelsRef = adminDb.collection(COLLECTIONS.SHOWCASE_CARD_CHANNELS).doc(request.companyId);
  // ⚠️ Διαδοχικά μέσα στη συναλλαγή — κάθε ανάγνωση μπαίνει στο CAS πριν από την πρώτη εγγραφή.
  const profile = tx ? await tx.get(profileRef) : await profileRef.get();
  const channels = tx ? await tx.get(channelsRef) : await channelsRef.get();
  return cardWithEmail(profile, channels, request);
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
    const card = await cardOf(adminDb, request);
    if (card === null) return refuse('email-changed');
    return { ok: true, view: { agencyName: card.agencyName, email: request.email, expiresAt: request.expiresAt } };
  } catch (error) {
    logger.error('[CARD-EMAIL] Η ανάγνωση αιτήματος απέτυχε', { error: error instanceof Error ? error.message : String(error) });
    return refuse('unavailable');
  }
}

/** Επιβεβαίωση: ημερομηνία στο ιδιωτικό κανάλι **και** στο δημόσιο κατάστημα, από την **ίδια** λίστα. */
function writeConfirmation(adminDb: AdminFirestore, tx: Transaction, request: ShowcaseEmailConfirmationRequest, card: CardWithEmail, now: string): void {
  const confirmations = withConfirmation(card.channels.emailConfirmations, request.email, now);
  const emailConfirmedAt = latestConfirmedAt(confirmations);
  tx.set(adminDb.collection(COLLECTIONS.SHOWCASE_CARD_CHANNELS).doc(request.companyId), {
    locations: { ...card.storedLocations, [request.locationId]: { ...card.channels, emailConfirmations: confirmations } },
  });
  tx.update(adminDb.collection(COLLECTIONS.AGENCY_PROFILES).doc(request.companyId), {
    locations: card.locations.map((location) => (location.id === request.locationId ? { ...location, emailConfirmedAt } : location)),
  });
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
      const card = await cardOf(adminDb, request, tx);
      if (card === null) return refuse('email-changed');
      writeConfirmation(adminDb, tx, request, card, now);
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
