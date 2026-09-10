/**
 * =============================================================================
 * Ο ΦΑΚΕΛΟΣ ΤΟΥ EMAIL ΕΙΔΟΠΟΙΗΣΗΣ — θέμα · κείμενο · HTML · κεφαλίδες (ADR-848)
 * =============================================================================
 *
 * 🔑 **Το αποτύπωμα του αποστολέα ανήκει στο επίπεδο παράδοσης** (§8.54, πρακτική
 * Zillow · Airbnb · GitHub): η υπογραφή του θέματος, οι σύνδεσμοι και οι κεφαλίδες
 * διαγραφής φτιάχνονται **εδώ**, τη στιγμή της αποστολής — ποτέ από τον παραγωγό
 * του συμβάντος, που δεν ξέρει αν το κείμενό του θα γίνει θέμα ή γραμμή σύνοψης.
 *
 * ⚠️ **Η ουρά κρατά ΓΕΓΟΝΟΤΑ, όχι URL** (`notificationId` · `recipientId`). Ο
 * σύνδεσμος χτίζεται από το δημόσιο origin **αυτής** της στιγμής: ένα μήνυμα που
 * περίμενε το παράθυρο των 20:00 δεν κουβαλά διεύθυνση που ίσως άλλαξε ως τότε.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΠΟΙΟΣ ΠΑΙΡΝΕΙ ΚΕΦΑΛΙΔΑ ΔΙΑΓΡΑΦΗΣ (RFC 8058) — ΚΑΙ ΠΟΙΟΣ ΟΧΙ
 * ────────────────────────────────────────────────────────────────────────────
 * | Μήνυμα | `List-Unsubscribe` | Γιατί |
 * |---|---|---|
 * | Ειδοποίηση (μεμονωμένη ή σύνοψη) | ✅ | Η Google το ορίζει «subscription message»: ο παραλήπτης μπορεί να το σταματήσει |
 * | **Επείγουσα** ειδοποίηση (ασφάλεια) | ❌ | Υποχρεωτική — καμία ρύθμιση δεν τη σταματά, άρα η υπόσχεση θα ήταν ψέμα |
 * | Ό,τι δεν είναι ειδοποίηση | ❌ | Δεν μας ανήκει ο φάκελός του: φεύγει **όπως έφευγε** |
 *
 * @module server/notifications/notification-email-envelope
 * @see server/notifications/notification-email-render — η απόδοση (καθαρή)
 */

import 'server-only';

import { resolveHumanLanguage } from '@/i18n/languages';
import { publicUrl } from '@/lib/http/public-origin';
import {
  emailOneClickHref,
  emailPreferencesHref,
} from '@/lib/notifications/email-subscription-routes';
import { notificationPermalinkHref } from '@/lib/notifications/notification-permalink-route';
import { brandedSubject } from '@/server/comms/email-texts';
import type { DeliveryPlanEntry, PendingEmail } from '@/server/notifications/email-digest';
import { issueEmailSubscriptionToken } from '@/services/notifications/email-subscription-token.service';
import { MESSAGE_CATEGORIES, MESSAGE_PRIORITIES } from '@/types/communications';

import {
  NO_LINKS,
  renderSoloHtml,
  renderSoloText,
  soleRecipientOf,
  soloPlainBody,
  type EmailLinks,
} from './notification-email-render';

/** Ό,τι χρειάζεται η αλυσίδα παρόχων, χωρίς τη διεύθυνση. */
export interface EmailEnvelope {
  readonly subject: string;
  readonly text: string;
  readonly html?: string;
  readonly headers?: Readonly<Record<string, string>>;
}

/** Η σύνοψη του πλάνου — ο τύπος που δέχεται το {@link digestHeaders}. */
type DigestEntry = Extract<DeliveryPlanEntry, { kind: 'digest' }>;

/**
 * **Οι ζωντανοί σύνδεσμοι**: δημόσιο origin + υπογεγραμμένο token.
 *
 * Χωρίς `NEXT_PUBLIC_APP_URL` ⇒ κανένας σύνδεσμος· χωρίς `NOTIFICATION_EMAIL_SECRET`
 * ⇒ σύνδεσμοι ειδοποιήσεων **ναι**, διαγραφή **όχι**. Κάθε απουσία υποβαθμίζει
 * **μόνο** ό,τι της ανήκει.
 */
export function liveEmailLinks(): EmailLinks {
  const withToken = (recipientId: string, href: (token: string) => string): string | null => {
    const token = issueEmailSubscriptionToken(recipientId);
    return token === null ? null : publicUrl(href(token));
  };
  return {
    permalink: (notificationId) => publicUrl(notificationPermalinkHref(notificationId)),
    preferences: (recipientId) => withToken(recipientId, emailPreferencesHref),
    oneClickUnsubscribe: (recipientId) => withToken(recipientId, emailOneClickHref),
  };
}

/**
 * Οι κεφαλίδες του RFC 8058 για αυτόν τον παραλήπτη — ή `undefined`.
 *
 * ⚠️ **Και οι ΔΥΟ, ή καμία.** Ένα `List-Unsubscribe` χωρίς `List-Unsubscribe-Post`
 * καλεί το πρόγραμμα email να κάνει **GET** — ακριβώς ό,τι οι σαρωτές κάνουν ήδη
 * μόνοι τους. Το RFC 8058 υπάρχει για να το αποτρέψει.
 */
export function subscriptionHeaders(
  recipientId: string | null | undefined,
  links: EmailLinks,
): Readonly<Record<string, string>> | undefined {
  if (!recipientId) return undefined;
  const url = links.oneClickUnsubscribe(recipientId);
  if (url === null) return undefined;
  return { 'List-Unsubscribe': `<${url}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' };
}

/** Οι κεφαλίδες μιας σύνοψης — **μόνο** αν όλα τα μέλη ανήκουν στον ίδιο άνθρωπο. */
export function digestHeaders(
  entry: DigestEntry,
  links: EmailLinks,
): Readonly<Record<string, string>> | undefined {
  return subscriptionHeaders(soleRecipientOf(entry.members), links);
}

/**
 * **Ο φάκελος ενός μεμονωμένου email.**
 *
 * ⚠️ Το **επείγον** παίρνει σύνδεσμο προς την ειδοποίηση αλλά **όχι** σύνδεσμο
 * διαχείρισης: μια υποχρεωτική ειδοποίηση ασφαλείας με «σταματήστε αυτά τα email»
 * στο κάτω μέρος θα υποσχόταν κάτι που καμία ρύθμιση δεν κάνει.
 */
export function soloEnvelope(message: PendingEmail, links: EmailLinks = NO_LINKS): EmailEnvelope {
  const language = resolveHumanLanguage(message.language);
  const subject = brandedSubject(language, message.subject);

  // Ό,τι ΔΕΝ είναι ειδοποίηση φεύγει όπως έφευγε: δεν του ανήκουν οι σύνδεσμοί μας.
  if (message.category !== MESSAGE_CATEGORIES.NOTIFICATION) {
    return { subject, text: soloPlainBody(message) };
  }

  const urgent = message.priority === MESSAGE_PRIORITIES.URGENT;
  const effective: EmailLinks = urgent ? { ...links, preferences: () => null } : links;
  const headers = urgent ? undefined : subscriptionHeaders(message.recipientId, links);

  return {
    subject,
    text: renderSoloText(message, language, effective),
    html: renderSoloHtml(message, language, subject, effective),
    ...(headers ? { headers } : {}),
  };
}
