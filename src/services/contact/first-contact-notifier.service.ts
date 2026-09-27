import 'server-only';

/**
 * @fileoverview **«ΚΑΠΟΙΟΣ ΣΕ ΠΛΗΣΙΑΣΕ»** — ο προσφέρων μαθαίνει τη στιγμή της πράξης (ADR-843 §10.20).
 * @related services/contact/first-contact.service.ts (ο ΕΝΑΣ καλών) · server/notifications/notification-orchestrator.ts
 *   (ο ΕΝΑΣ αγωγός) · server/spatial-tour/tour-access-notifier.ts (το πρότυπο «αίτημα προς υπεύθυνο»)
 * @module services/contact/first-contact-notifier.service
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ ΚΕΝΟ ΠΟΥ ΚΛΕΙΝΕΙ — ΜΕΤΡΗΜΕΝΟ ΖΩΝΤΑΝΑ 2026-09-27
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η πράξη γραφόταν σωστά, αλλά ο ιδιοκτήτης **δεν μάθαινε ποτέ** ότι τον πλησίασαν — μόνο αν άνοιγε μόνος του τα
 * εισερχόμενα. Ο ζητών κρατούσε **μία από τις δέκα θέσεις του** δεμένη σε άνθρωπο που δεν ήξερε ότι περιμένει.
 * 🏆 **Zillow / Idealista / Rightmove: ο αγγελιοδότης μαθαίνει ΑΜΕΣΩΣ** — η ταχύτητα απάντησης στο πρώτο ενδιαφέρον
 * είναι ο ισχυρότερος γνωστός παράγοντας μετατροπής. Γι' αυτό **ένα** μήνυμα, **τώρα**, όχι σύνοψη ημέρας.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΚΑΝΕΝΑ ΣΤΟΙΧΕΙΟ ΤΟΥ ΖΗΤΟΥΝΤΟΣ ΣΤΟ ΜΗΝΥΜΑ — ΚΑΙ ΕΙΝΑΙ ΕΔΩ ΠΟΥ ΞΕΠΕΡΝΑΜΕ ΤΟ ΠΡΟΤΥΠΟ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το Zillow βάζει όνομα, τηλέφωνο και email **μέσα στο email**. Εδώ αυτό θα **έσπαγε μια υπόσχεση που δίνουμε**:
 * ο ζητών βλέπει *«Δεν το έχει δει ακόμα»* / *«Το είδε στις …»* από το `seenAt`, που σφραγίζεται **μόνο** όταν ο
 * προσφέρων ανοίξει τα εισερχόμενα (`readOffererInbox`). Και η απόσυρση του λέει *«ό,τι είδε, το είδε»* (ΠΕ6 / Κ10).
 * Αν το τηλέφωνο είχε ήδη φύγει σε γραμματοκιβώτιο, το «δεν το έχει δει» θα ήταν **ψέμα** και η απόσυρση **άδεια**.
 * ⇒ Το μήνυμα λέει **ότι** και **για ποιο** — ποτέ **ποιος**. Το κουμπί οδηγεί στα εισερχόμενα, όπου η ανάγνωση
 * **σφραγίζει**. Ίδιο σχήμα με το Airbnb πριν την κράτηση: *«έχετε νέο μήνυμα — δείτε το στην εφαρμογή»*.
 * ⛔ **ΜΗΝ «βελτιώσεις» το μήνυμα προσθέτοντας `disclosure.*`** — ούτε το όνομα: κι αυτό είναι γνωστοποίηση.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΠΟΙΟΣ ΜΑΘΑΙΝΕΙ — ο παραλήπτης της πράξης, όπως τον έγραψε ο κριτής
 * ────────────────────────────────────────────────────────────────────────────
 *
 * | `offerer` | Παραλήπτες | Γιατί |
 * |---|---|---|
 * | `personal` | ο ίδιος ο ιδιοκτήτης | η πράξη απευθύνεται σε **αυτόν** |
 * | `company` | οι **ενεργοί διαχειριστές** του χώρου | τα εισερχόμενα του γραφείου είναι **κοινά**· το ίδιο κοινό με την ερώτηση αργιών (απόφαση 2026-09-15) |
 *
 * 🔶 **Δηλωμένο όριο**: σε αγγελία γραφείου το Zillow δρομολογεί στον **πράκτορα της αγγελίας**. Εδώ ο επιλυτής
 * αγγελιών δεν εκθέτει τον καταχωρητή, και η δρομολόγηση ανά πράκτορα είναι ολόκληρη λειτουργία (κανόνες ανάθεσης)
 * — ADR-843 §10.20 ανοιχτό #1.
 *
 * 🔑 **Οι τρεις ιδιότητες του προτύπου**: (1) ιδεμποτία κατά **πράξη** — `eventId` = η ταυτότητα της πράξης, που
 * γεννιέται **μία** φορά (ένα δεύτερο πάτημα επιστρέφει `unchanged` και δεν φτάνει εδώ)· (2) **μετά** τη γραφή· (3)
 * **ποτέ δεν πετά** — η πράξη έχει ήδη γίνει· η ειδοποίηση είναι ενημέρωση, όχι μέρος της.
 */

import type { Firestore } from 'firebase-admin/firestore';

import {
  getCurrentEnvironment,
  NOTIFICATION_ENTITY_TYPES,
  NOTIFICATION_EVENT_TYPES,
  SOURCE_SERVICES,
} from '@/config/notification-events';
import { createBundleTranslate } from '@/i18n/bundle-translate';
import elShared from '@/i18n/locales/el/common-shared.json';
import { firstContactsInboxHref } from '@/lib/contact/first-contact-routes';
import { listingNoticeTitle } from '@/lib/listings/listing-notice-title';
import { viewDestination, type NotificationDestination } from '@/lib/notifications/notification-destination';
import { custodyWorkspace } from '@/lib/owner-property/listing-custody';
import { createModuleLogger } from '@/lib/telemetry';
import { readWorkspaceName } from '@/lib/workspace/workspace-catalog';
import { activeWorkspaceAdministrators } from '@/lib/workspace/workspace-administrators';
import { dispatchNotification } from '@/server/notifications/notification-orchestrator';
import type { FirstContact, FirstContactTargetKind } from '@/types/first-contact';
import { personalWorkspace, workspaceTenantId } from '@/types/workspace-membership';

const logger = createModuleLogger('first-contact-notifier.service');

/**
 * **Τίτλος ανά είδος στόχου** — `Record` πάνω στο κλειστό σύνολο: τρίτο είδος στόχου χωρίς κείμενο **δεν
 * μεταγλωττίζεται**. Χωρίς πρόθεμα namespace: ο drawer αποδίδει με `COMMON_NAMESPACES` (`common-shared`).
 */
const FIRST_CONTACT_TITLE_KEYS: Record<FirstContactTargetKind, string> = {
  listing: 'firstContactReceived.listingTitle',
  professional: 'firstContactReceived.officeTitle',
};

const FIRST_CONTACT_BODY_KEY = 'firstContactReceived.body';

/**
 * 🔑 **Το θέμα του email βγαίνει ΑΠΟ ΤΟ LOCALE**, όχι από γραμμένο κείμενο — ιδίωμα του `member-exit-notifier`
 * (μία πρόταση, ένα σημείο· κουδούνι και email δεν μπορούν να πουν άλλα). 🔶 Η εφεδρεία είναι ελληνική για κάθε
 * παραλήπτη — όριο του αγωγού (ADR-777 §8.22), όχι αυτού του αρχείου.
 */
const elSharedT = createBundleTranslate({ 'common-shared': elShared }, 'common-shared');

/**
 * **Πού οδηγεί** (ADR-849 §6δ Β1): στα εισερχόμενα επαφών, στον **ιδιωτικό** χώρο του παραλήπτη — εκεί ζει η σελίδα
 * (`app/(me)/first-contacts/inbox`), και το API βρίσκει μόνο του τη θεματοφυλακή του γραφείου από τη σύνδεση
 * (`listingActorOf`). Εξάγεται ώστε ο ανιχνευτής απόκλισης να ρωτά **αυτόν** τον κανόνα.
 */
export function firstContactReceivedDestination(recipientUserId: string): NotificationDestination {
  return viewDestination(firstContactsInboxHref(), personalWorkspace(recipientUserId));
}

/** **Ποιοι μαθαίνουν** — δες τον πίνακα στην κεφαλίδα. Ο ζητών **ποτέ** (ζώνη-και-τιράντες: ο κριτής ήδη αρνείται «δική σου»). */
async function recipientsOf(db: Firestore, contact: FirstContact): Promise<readonly string[]> {
  const candidates = contact.offerer.kind === 'personal'
    ? [contact.offerer.userId]
    : await activeWorkspaceAdministrators(db, contact.offerer.companyId);
  return candidates.filter((uid) => uid !== contact.seekerUserId);
}

/** **Για ποιο** — ο τίτλος της αγγελίας ή το όνομα του γραφείου. Ποτέ **ποιος** (δες κεφαλίδα). */
async function subjectParams(db: Firestore, contact: FirstContact): Promise<Record<string, string>> {
  const target = contact.target;
  return target.kind === 'listing'
    ? { title: await listingNoticeTitle(db, target.listingId) }
    : { office: await readWorkspaceName(target.agencyCompanyId) };
}

/**
 * **Ο προσφέρων μαθαίνει ότι τον πλησίασαν.** Αποτυχία ενός παραλήπτη **δεν** σταματά τους υπόλοιπους.
 *
 * @returns πόσοι ειδοποιήθηκαν — για το ημερολόγιο και τις άγκυρες. **Κανένα πέταγμα.**
 */
export async function announceFirstContactReceived(db: Firestore, contact: FirstContact): Promise<number> {
  try {
    const recipients = await recipientsOf(db, contact);
    if (recipients.length === 0) return 0;
    const params = await subjectParams(db, contact);
    const outcomes = await Promise.all(recipients.map((uid) => notifyOne(contact, uid, params)));
    return outcomes.filter(Boolean).length;
  } catch (error) {
    logger.error('[FIRST-CONTACT] Η ειδοποίηση του προσφέροντος δεν στάλθηκε', {
      contactId: contact.id,
      error: error instanceof Error ? error.message : String(error),
    });
    return 0;
  }
}

async function notifyOne(contact: FirstContact, recipientId: string, params: Record<string, string>): Promise<boolean> {
  const titleKey = FIRST_CONTACT_TITLE_KEYS[contact.target.kind];
  try {
    const result = await dispatchNotification({
      eventType: NOTIFICATION_EVENT_TYPES.PROPERTIES_FIRST_CONTACT_RECEIVED,
      recipientId,
      // 🔑 Ο μισθωτής είναι η **θεματοφυλακή** (ιδιώτης ⇒ ο εαυτός του · γραφείο ⇒ η εταιρεία).
      tenantId: workspaceTenantId(custodyWorkspace(contact.offerer)),
      title: elSharedT(titleKey, params),
      titleKey,
      titleParams: params,
      body: elSharedT(FIRST_CONTACT_BODY_KEY),
      bodyKey: FIRST_CONTACT_BODY_KEY,
      // 🔴 **Η ταυτότητα του γεγονότος ΕΙΝΑΙ η πράξη** — γεννιέται μία φορά, άρα σύγκρουση κλειδιού δομικά αδύνατη.
      eventId: `first-contact:${contact.id}:open`,
      entityId: contact.id,
      entityType: NOTIFICATION_ENTITY_TYPES.CONTACT,
      ...firstContactReceivedDestination(recipientId),
      source: { service: SOURCE_SERVICES.PROPERTIES, feature: 'first-contact', env: getCurrentEnvironment() },
    });
    return result.success;
  } catch (error) {
    logger.error('[FIRST-CONTACT] Η ειδοποίηση προς παραλήπτη απέτυχε', {
      contactId: contact.id,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}
