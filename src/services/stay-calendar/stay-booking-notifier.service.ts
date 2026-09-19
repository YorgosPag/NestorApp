import 'server-only';

/**
 * @fileoverview **«ΕΧΕΙΣ ΑΙΤΗΜΑ» · «ΣΟΥ ΑΠΑΝΤΗΣΑΝ»** — οι ειδοποιήσεις του αιτήματος κράτησης.
 * @related ADR-835 §23.6 · services/mandate/mandate-request-notifier.service.ts (το πρότυπο) ·
 *   server/notifications/notification-orchestrator.ts · server/notifications/notification-destination-rules.ts
 * @module services/stay-calendar/stay-booking-notifier.service
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΔΥΟ ΑΓΩΓΟΙ, ΠΕΝΤΕ ΜΕΤΑΒΑΣΕΙΣ — ΚΑΘΕ ΜΕΤΑΒΑΣΗ ΞΕΡΕΙ ΣΕ ΠΟΙΟΝ ΜΙΛΑ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * | Μετάβαση | Οικοδεσπότης (`stayRequestReceived`) | Επισκέπτης (`stayRequestAnswered`) |
 * |---|---|---|
 * | `request` | «νέο αίτημα — απάντησε ως …» | — |
 * | `withdraw` | «το αίτημα αποσύρθηκε» | — |
 * | `accept` | — | «η κράτηση επιβεβαιώθηκε» |
 * | `decline` | — | «ο οικοδεσπότης δεν μπορεί» |
 * | `expire` | «δεν απάντησες — το αίτημα έληξε» | «δεν απαντήθηκε — ρώτα ξανά» |
 * | `cancel` | — (ο ίδιος ακύρωσε) | «ο οικοδεσπότης ακύρωσε την κράτησή σας» (§23.12 Ε5) |
 *
 * 🔴 **Η λήξη μιλά ΚΑΙ στους δύο, με ΔΙΑΦΟΡΕΤΙΚΑ λόγια** (§4.11 #3): στον επισκέπτη δεν είναι
 * «όχι» (είναι «ρώτα ξανά»), και στον οικοδεσπότη είναι γεγονός που **δεν** του κοστίζει θέση στην
 * αναζήτηση — το αντίθετο του Airbnb/Vrbo, που τιμωρούν χωρίς να ρωτούν γιατί.
 *
 * 🔑 **ΟΙ ΤΡΕΙΣ ΙΔΙΟΤΗΤΕΣ ΤΟΥ ΠΡΟΤΥΠΟΥ** (`mandate-request-notifier`):
 * 1. **Ταυτότητα = η ΜΕΤΑΒΑΣΗ**, ποτέ η ώρα — μια κράτηση γεννιέται ως αίτημα **μία** φορά και
 *    κλείνει **μία** φορά (οι ιδιοδύναμες επαναλήψεις δεν γεννούν ειδοποίηση), άρα η σύγκρουση
 *    κλειδιού είναι **δομικά αδύνατη** (το μάθημα του γειτονικού αγωγού, 2/4 κόκκινα).
 * 2. **ΜΕΤΑ τη γραφή** — ο γραφέας καλεί εδώ μόνο για **δεσμευμένη** μετάβαση.
 * 3. **ΠΟΤΕ δεν πετά** — αποτυχία ειδοποίησης δεν αναιρεί κράτηση.
 *
 * ⚠️ **Υποχρεωτικές** (`isMandatory: true`): είναι **συναλλακτικές**, όχι ενημερωτικές — ένα αίτημα
 * που ο οικοδεσπότης δεν μαθαίνει λήγει χωρίς ποτέ να ειπωθεί. Ούτε το Airbnb επιτρέπει να
 * σβήσει κανείς τις ειδοποιήσεις κρατήσεων.
 */

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import {
  getCurrentEnvironment,
  NOTIFICATION_ENTITY_TYPES,
  NOTIFICATION_EVENT_TYPES,
  SOURCE_SERVICES,
  type NotificationEventType,
} from '@/config/notification-events';
import { formatCalendarDay, formatDateTime } from '@/lib/intl-formatting';
import { STAY_HOLD_TIME_FORMAT } from '@/lib/stay/stay-hold-deadline';
import { listingNoticeTitle } from '@/lib/listings/listing-notice-title';
import { viewDestination, type NotificationDestination } from '@/lib/notifications/notification-destination';
import { custodyOf, custodyWorkspace, type ListingCustody } from '@/lib/owner-property/listing-custody';
import { offerStayCalendarHref } from '@/lib/owner-property/owner-property-routes';
import { createModuleLogger } from '@/lib/telemetry';
import { dispatchNotification } from '@/server/notifications/notification-orchestrator';
import { listingMatchDestination } from '@/services/demand/listing-match-notifier.service';
import type { OwnerProperty } from '@/types/owner-property';
import type { StayBooking } from '@/types/stay-booking';
import { workspaceTenantId } from '@/types/workspace-membership';

import type { StayBookingNotice } from './stay-calendar-write-decision';

const logger = createModuleLogger('stay-booking-notifier.service');

/** Η γλώσσα του θέματος — ελληνικά, όπως όλα τα θέματα email του διακομιστή (ADR-777 §8.22). */
const EMAIL_LOCALE = 'el';

type NoticeEvent = StayBookingNotice['event'];

/** Σε ποιον μιλά μια μετάβαση. */
type Audience = 'host' | 'guest';

/** **Ο πίνακας** — ποιοι ακούνε κάθε μετάβαση. Κενός = καμία ειδοποίηση. */
const AUDIENCES: Readonly<Record<NoticeEvent, readonly Audience[]>> = {
  request: ['host'],
  withdraw: ['host'],
  accept: ['guest'],
  decline: ['guest'],
  expire: ['guest', 'host'],
  // 🔴 §23.12 Ε5 — μόνο για κράτηση επισκέπτη (ο γραφέας δεν γεννά notice για χειροκίνητη).
  cancel: ['guest'],
};

/** Ο τύπος γεγονότος ανά ακροατήριο — δύο αγωγοί, δύο διακόπτες στις ρυθμίσεις. */
const EVENT_TYPE: Readonly<Record<Audience, NotificationEventType>> = {
  host: NOTIFICATION_EVENT_TYPES.PROPERTIES_STAY_REQUEST_RECEIVED,
  guest: NOTIFICATION_EVENT_TYPES.PROPERTIES_STAY_REQUEST_ANSWERED,
};

/**
 * **Τα κλειδιά του τίτλου** — στατικός πίνακας, ποτέ ``t(`…${event}`)``: το δυναμικό κλειδί είναι
 * αόρατο στη CHECK 3.8. Χωρίς πρόθεμα namespace: ο `NotificationDrawer` αποδίδει με `common-shared`.
 */
const TITLE_KEYS: Readonly<Record<Audience, Partial<Record<NoticeEvent, string>>>> = {
  host: {
    request: 'stayRequest.receivedTitle',
    withdraw: 'stayRequest.withdrawnTitle',
    expire: 'stayRequest.expiredTitle',
  },
  guest: {
    accept: 'stayRequestAnswered.acceptedTitle',
    decline: 'stayRequestAnswered.declinedTitle',
    expire: 'stayRequestAnswered.expiredTitle',
    cancel: 'stayRequestAnswered.cancelledTitle',
  },
};

/**
 * **Το θέμα του email**, ελληνικά, στον διακομιστή — το `titleKey` είναι η αλήθεια της οθόνης· αυτό
 * είναι το θέμα, που συντίθεται εκεί όπου **δεν υπάρχει** αποδότης i18n (ADR-777 §8.22, κοινό κενό).
 */
type Subject = (p: { readonly title: string; readonly range: string; readonly until: string }) => string;
const EMAIL_SUBJECTS: Readonly<Record<Audience, Partial<Record<NoticeEvent, Subject>>>> = {
  host: {
    request: ({ title, range, until }) => `Νέο αίτημα κράτησης για «${title}» (${range}) — απαντήστε ως ${until}`,
    withdraw: ({ title, range }) => `Το αίτημα κράτησης για «${title}» (${range}) αποσύρθηκε`,
    expire: ({ title, range }) => `Το αίτημα κράτησης για «${title}» (${range}) έληξε χωρίς απάντηση`,
  },
  guest: {
    accept: ({ title, range }) => `Η κράτησή σας στο «${title}» (${range}) επιβεβαιώθηκε`,
    decline: ({ title, range }) => `Ο οικοδεσπότης του «${title}» δεν μπορεί να σας φιλοξενήσει (${range})`,
    expire: ({ title, range }) => `Το αίτημά σας για «${title}» (${range}) δεν απαντήθηκε — δοκιμάστε ξανά`,
    cancel: ({ title, range }) => `Ο οικοδεσπότης ακύρωσε την κράτησή σας στο «${title}» (${range})`,
  },
};

/**
 * **Ο οικοδεσπότης** προσγειώνεται στο ημερολόγιο του καταλύματος, **στον χώρο της αγγελίας**
 * (ADR-849 §6δ Β1) — εκεί ζουν τα κουμπιά «Αποδοχή / Άρνηση». Εξάγεται για τον ανιχνευτή απόκλισης.
 */
export function stayRequestReceivedDestination(ownerPropertyId: string, custody: ListingCustody): NotificationDestination {
  return viewDestination(offerStayCalendarHref(ownerPropertyId), custodyWorkspace(custody));
}

/**
 * **Ο επισκέπτης** προσγειώνεται στη **δημόσια σελίδα** της αγγελίας, στον ιδιωτικό του χώρο — ο
 * **ίδιος** κανόνας με την αντιστοίχιση ζήτησης (`listingMatchDestination`), όχι δεύτερη διαδρομή.
 */
export function stayRequestAnsweredDestination(listingId: string, guestUserId: string): NotificationDestination {
  return listingMatchDestination(listingId, guestUserId);
}

interface Recipient {
  readonly userId: string;
  readonly tenantId: string;
  readonly destination: NotificationDestination;
}

function recipientOf(audience: Audience, property: OwnerProperty, booking: StayBooking): Recipient | null {
  if (audience === 'guest') {
    if (booking.guestUserId === null) return null;
    return {
      userId: booking.guestUserId,
      tenantId: booking.guestUserId,
      destination: stayRequestAnsweredDestination(property.id, booking.guestUserId),
    };
  }
  const custody = custodyOf(property);
  // Ο υπόχρεος της απάντησης είναι γραμμένος **στο hold** (§4.11 #4) — ποτέ ξαναϋπολογισμένος.
  const userId = booking.hold?.respondentUserId ?? property.authorUserId;
  return { userId, tenantId: workspaceTenantId(custodyWorkspace(custody)), destination: stayRequestReceivedDestination(property.id, custody) };
}

async function announceTo(
  audience: Audience,
  property: OwnerProperty,
  notice: StayBookingNotice,
  title: string,
): Promise<void> {
  const { booking, event } = notice;
  const recipient = recipientOf(audience, property, booking);
  const titleKey = TITLE_KEYS[audience][event];
  const subject = EMAIL_SUBJECTS[audience][event];
  if (recipient === null || titleKey === undefined || subject === undefined) return;
  const range = `${formatCalendarDay(booking.checkIn, true, EMAIL_LOCALE)} – ${formatCalendarDay(booking.checkOut, true, EMAIL_LOCALE)}`;
  const until = booking.hold === null ? '' : formatDateTime(booking.hold.expiresAt, STAY_HOLD_TIME_FORMAT, EMAIL_LOCALE);
  await dispatchNotification({
    eventType: EVENT_TYPE[audience],
    recipientId: recipient.userId,
    tenantId: recipient.tenantId,
    title: subject({ title, range, until }),
    titleKey,
    titleParams: { title, range, until },
    // 🔴 Η ΤΑΥΤΟΤΗΤΑ ΕΙΝΑΙ Η ΜΕΤΑΒΑΣΗ — δες την κεφαλίδα.
    eventId: `stay-booking:${booking.id}:${event}:${audience}`,
    entityId: property.id,
    entityType: NOTIFICATION_ENTITY_TYPES.PROPERTY,
    ...recipient.destination,
    source: { service: SOURCE_SERVICES.PROPERTIES, feature: 'stay-request', env: getCurrentEnvironment() },
  });
}

/**
 * **Λέει ό,τι έγινε σε όσους αφορά.** Καλείται **μόνο** μετά από δεσμευμένη μετάβαση. **Κανένα πέταγμα.**
 */
export async function announceStayBookingNotice(
  adminDb: AdminFirestore,
  property: OwnerProperty,
  notice: StayBookingNotice,
): Promise<void> {
  try {
    const title = await listingNoticeTitle(adminDb, property.id, property.title);
    await Promise.all(AUDIENCES[notice.event].map((audience) => announceTo(audience, property, notice, title)));
  } catch (error) {
    logger.error('Η ειδοποίηση του αιτήματος κράτησης δεν στάλθηκε', {
      data: { bookingId: notice.booking.id, event: notice.event },
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
