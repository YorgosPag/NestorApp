/**
 * @fileoverview **«ΣΤΕΙΛΕ ΕΠΙΒΕΒΑΙΩΣΗ»** — η έκδοση αιτήματος επιβεβαίωσης email της κάρτας (ADR-841 §7 Α21.18).
 * @related services/mandate/showcase-email-confirmation-decision.ts (η άλλη πλευρά) ·
 *   services/contact/first-contact-invitation.service.ts (το πρότυπο πολιτικής) ·
 *   types/showcase-email-confirmation.ts
 * @module services/mandate/showcase-email-confirmation.service
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 Η ΣΕΙΡΑ ΕΙΝΑΙ Η ΑΣΦΑΛΕΙΑ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * 1. **Υπάρχει η διεύθυνση στην κάρτα ΑΥΤΟΥ του γραφείου;** — ταυτότητα από τα claims, ποτέ από το
 *    σώμα. Αλλιώς η πόρτα θα ήταν «στείλε email στο όνομά μας σε όποια διεύθυνση θέλεις».
 * 2. **Χωράει στο όριο του παραλήπτη;** — πριν από κάθε εγγραφή, ώστε η κατάχρηση να μη γεννά ούτε
 *    έγγραφα ούτε αντικαταστάσεις.
 * 3. **Η προηγούμενη παύει** — ποτέ δύο ζωντανοί σύνδεσμοι για το ίδιο γραμματοκιβώτιο.
 * 4. **Γράφεται το αίτημα, ΜΕΤΑ φεύγει το email** — ένα email χωρίς έγγραφο θα ήταν σύνδεσμος που
 *    απαντά «άγνωστο» στο πρώτο πάτημα.
 *
 * ⚠️ **SERVER-ONLY** — Admin SDK.
 */

import 'server-only';

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { readLocationChannels } from '@/lib/agency/showcase-card-channels-read';
import {
  EMAIL_CONFIRMATION_LIFETIME_HOURS,
  confirmationLinkExpiresAt,
} from '@/lib/agency/showcase-email-confirmation-rules';
import { readShowcase } from '@/lib/agency/showcase-read';
import { normaliseChannelEmail, sameChannelEmail } from '@/lib/contact/channel-email';
import { nowISO as clockNowISO } from '@/lib/date-local';
import { publicUrl } from '@/lib/http/public-origin';
import { withinRecipientQuota } from '@/lib/middleware/recipient-quota';
import { SHOWCASE_EMAIL_CONFIRMATION_RECIPIENT_QUOTA } from '@/lib/middleware/rate-limit-config';
import { createModuleLogger } from '@/lib/telemetry';
import { sendReplyViaMailgun } from '@/services/ai-pipeline/shared/mailgun-sender';
import { buildShowcaseEmailConfirmationEmail } from '@/services/email-templates/showcase-email-confirmation';
import { generateShowcaseEmailConfirmationId } from '@/services/enterprise-id.service';
import type {
  ShowcaseEmailConfirmationIssueRefusal,
  ShowcaseEmailConfirmationRequest,
} from '@/types/showcase-email-confirmation';

import { emailConfirmationPagePath, emailDisownPagePath } from '@/components/mandate/showcase-card-paths';
import { confirmationSecret, newConfirmationLink } from './showcase-email-confirmation-token';

const logger = createModuleLogger('showcase-email-confirmation');

/** Ό,τι ζητά ο επαγγελματίας — `companyId`/`requestedByUid` **από τα claims**. */
export interface ShowcaseEmailConfirmationAsk {
  readonly companyId: string;
  readonly locationId: string;
  readonly email: string;
  readonly requestedByUid: string;
}

export type ShowcaseEmailConfirmationIssue =
  | { readonly kind: 'sent'; readonly expiresAt: string }
  | { readonly kind: 'refused'; readonly reason: ShowcaseEmailConfirmationIssueRefusal }
  /** 🔴 **Δεν ξέρουμε** (βάση/μυστικό/διεύθυνση εφαρμογής) — ποτέ ίδιο με άρνηση. */
  | { readonly kind: 'failed' };

const refused = (reason: ShowcaseEmailConfirmationIssueRefusal): ShowcaseEmailConfirmationIssue => ({ kind: 'refused', reason });

/** **Είναι αυτή η διεύθυνση στην κάρτα;** — και ποιο όνομα θα διαβάσει ο παραλήπτης. */
async function readTarget(
  adminDb: AdminFirestore,
  ask: ShowcaseEmailConfirmationAsk,
  email: string,
): Promise<{ readonly agencyName: string } | ShowcaseEmailConfirmationIssueRefusal> {
  const [profile, channels] = await Promise.all([
    adminDb.collection(COLLECTIONS.AGENCY_PROFILES).doc(ask.companyId).get(),
    adminDb.collection(COLLECTIONS.SHOWCASE_CARD_CHANNELS).doc(ask.companyId).get(),
  ]);
  const read = profile.exists ? readShowcase(profile.data(), ask.companyId) : null;
  if (read?.outcome !== 'showcase') return 'without-showcase';
  if (!read.showcase.locations.some(({ id }) => id === ask.locationId)) return 'email-not-on-card';
  const onCard = readLocationChannels(channels.data(), ask.locationId).emails.some((stored) => sameChannelEmail(stored, email));
  return onCard ? { agencyName: read.showcase.displayName } : 'email-not-on-card';
}

/** **Ίδιο κατάστημα, ίδια διεύθυνση ⇒ η προηγούμενη παύει.** Το `companyId` στο ερώτημα (CHECK 3.10). */
async function supersedePrevious(adminDb: AdminFirestore, ask: ShowcaseEmailConfirmationAsk, email: string, now: string): Promise<void> {
  const collection = adminDb.collection(COLLECTIONS.SHOWCASE_EMAIL_CONFIRMATIONS);
  const snapshot = await collection
    .where('companyId', '==', ask.companyId)
    .where('email', '==', email)
    .where('state', '==', 'sent')
    .get();
  const stale = snapshot.docs.filter((doc) => (doc.data() as { locationId?: unknown }).locationId === ask.locationId);
  if (stale.length === 0) return;
  // ⚠️ `collection.doc(doc.id)` και ΟΧΙ `doc.ref` — ίδιος λόγος με το `first-contact-invitation.service`.
  const batch = adminDb.batch();
  for (const doc of stale) batch.update(collection.doc(doc.id), { state: 'superseded', settledAt: now });
  await batch.commit();
}

/** Το email — μετά την εγγραφή. `false` = ο πάροχος αρνήθηκε. */
async function mail(email: string, agencyName: string, token: string): Promise<boolean | null> {
  const confirmUrl = publicUrl(emailConfirmationPagePath(token));
  const disownUrl = publicUrl(emailDisownPagePath(token));
  if (confirmUrl === null || disownUrl === null) return null;
  const { subject, html, text } = buildShowcaseEmailConfirmationEmail({
    agencyName, email, confirmUrl, disownUrl, lifetimeHours: EMAIL_CONFIRMATION_LIFETIME_HOURS,
  });
  const sent = await sendReplyViaMailgun({ to: email, subject, textBody: text, htmlBody: html });
  if (!sent.success) logger.warn('[CARD-EMAIL] Ο πάροχος αρνήθηκε την αποστολή', { error: sent.error });
  return sent.success;
}

async function issue(
  adminDb: AdminFirestore,
  ask: ShowcaseEmailConfirmationAsk,
  secret: string,
  now: string,
): Promise<ShowcaseEmailConfirmationIssue> {
  const email = normaliseChannelEmail(ask.email);
  const target = await readTarget(adminDb, ask, email);
  if (typeof target === 'string') return refused(target);
  if (!(await withinRecipientQuota('showcase-email-confirmation', email, SHOWCASE_EMAIL_CONFIRMATION_RECIPIENT_QUOTA))) {
    return refused('recipient-quota');
  }
  const expiresAt = confirmationLinkExpiresAt(now);
  if (expiresAt === null) return { kind: 'failed' };

  await supersedePrevious(adminDb, ask, email, now);
  const id = generateShowcaseEmailConfirmationId();
  const { token, nonce } = newConfirmationLink(secret, id, expiresAt);
  const request: ShowcaseEmailConfirmationRequest = {
    id, companyId: ask.companyId, locationId: ask.locationId, email, nonce, state: 'sent',
    requestedByUid: ask.requestedByUid, createdAt: now, expiresAt, settledAt: null,
  };
  await adminDb.collection(COLLECTIONS.SHOWCASE_EMAIL_CONFIRMATIONS).doc(id).set(request);

  const sent = await mail(email, target.agencyName, token);
  if (sent === null) return { kind: 'failed' };
  return sent ? { kind: 'sent', expiresAt } : refused('send-failed');
}

/**
 * **«Στείλε επιβεβαίωση σε αυτή τη διεύθυνση του καταστήματός μου.»**
 *
 * @param nowISOValue Η στιγμή — περασμένη, ώστε τα όρια (λήξη, αντικατάσταση) να είναι δοκιμάσιμα.
 */
export async function issueShowcaseEmailConfirmation(
  adminDb: AdminFirestore,
  ask: ShowcaseEmailConfirmationAsk,
  nowISOValue: string = clockNowISO(),
): Promise<ShowcaseEmailConfirmationIssue> {
  const secret = confirmationSecret();
  if (secret === null) {
    logger.error('[CARD-EMAIL] Λείπει το μυστικό — καμία επιβεβαίωση δεν μπορεί να σταλεί');
    return { kind: 'failed' };
  }
  try {
    return await issue(adminDb, ask, secret, nowISOValue);
  } catch (error) {
    logger.error('[CARD-EMAIL] Η έκδοση απέτυχε', {
      companyId: ask.companyId,
      error: error instanceof Error ? error.message : String(error),
    });
    return { kind: 'failed' };
  }
}
