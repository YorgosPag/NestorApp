import 'server-only';

/**
 * @fileoverview **«ΤΟ ΓΡΑΦΕΙΟ ΑΠΑΝΤΗΣΕ»** — ο ιδιώτης μαθαίνει (ADR-827 §9.21, Φ5).
 * @related services/mandate/mandate-decision-notifier.service.ts (ο ΑΝΤΙΘΕΤΟΣ αγωγός)
 * @module services/mandate/mandate-request-notifier.service
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΣΥΜΜΕΤΡΙΚΟΣ ΑΓΩΓΟΣ, ΟΧΙ ΑΝΤΙΓΡΑΦΟ — ΤΡΙΑ ΠΡΑΓΜΑΤΑ ΑΛΛΑΖΟΥΝ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ο υπάρχων `announceMandateDecision` πάει **γραφείο ← ιδιοκτήτης**. Αυτός πάει
 * **ιδιώτης ← γραφείο**, και δεν είναι ο ίδιος με άλλη παράμετρο:
 *
 * | | Εκείνος | Αυτός |
 * |---|---|---|
 * | παραλήπτης | ο υπάλληλος που καταχώρησε | ο **`requestedByUserId`** |
 * | μισθωτής | η **εταιρεία** του | ο **εαυτός του** — ο ιδιώτης δεν έχει οργανισμό |
 * | γεγονός | `PROPERTIES_MANDATE_DECIDED` | `PROPERTIES_MANDATE_REQUEST_ANSWERED` |
 *
 * 🔑 **Ο ΜΙΣΘΩΤΗΣ ΕΙΝΑΙ Ο ΙΔΙΟΣ Ο ΑΝΘΡΩΠΟΣ, ΚΑΙ ΥΠΑΡΧΕΙ ΗΔΗ ΙΔΙΩΜΑ**: το
 * `interest-notifier.service.ts` γράφει `tenantId: property.authorUserId` με τον λόγο
 * γραμμένο (*«για τον ιδιώτη είναι ο εαυτός του»*, `tenant-config.ts` → `mode: 'userId'`).
 * ⛔ **ΜΗΝ αντιγράψεις τον φρουρό `tenantId === null` του άλλου αγωγού**: εκεί σημαίνει
 * *«απόφαση εντολής χωρίς εταιρεία — κάτι έσπασε»*· εδώ θα σήμαινε ότι **κανένας
 * ιδιώτης δεν ειδοποιείται ποτέ**, δηλαδή σιωπηλή απενεργοποίηση όλης της Φ5.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΟΙ ΤΡΕΙΣ ΙΔΙΟΤΗΤΕΣ ΤΟΥ ΠΡΟΤΥΠΟΥ, ΔΙΑΤΗΡΗΜΕΝΕΣ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * 1. **Ιδεμποτησία κατά ΜΕΤΑΒΑΣΗ**, όχι κατά άνοιγμα: το `eventId` κουβαλά
 *    `pending>accepted`. Το ίδιο αίτημα δεν μπορεί να κριθεί δεύτερη φορά (το CAS το
 *    εγγυάται), άρα η μετάβαση είναι **μοναδική εξ ορισμού** — η σύγκρουση κλειδιού
 *    γίνεται δομικά αδύνατη, όχι απλώς απίθανη.
 *    ⚠️ Το πρώτο σχέδιο του γειτονικού αγωγού είχε `…:${decidedAt}` και **κοκκίνιζε
 *    δύο στις τέσσερις εκτελέσεις**: δύο αποφάσεις στο ίδιο χιλιοστό έπαιρναν
 *    ταυτόσημο κλειδί και η δεύτερη **καταπινόταν**. Το μάθημα δεν ξαναγίνεται.
 * 2. **ΜΕΤΑ τη γραφή**: η απόφαση είναι ήδη στη βάση όταν φτάνουμε εδώ.
 * 3. **ΠΟΤΕ δεν πετά**: αποτυχία ειδοποίησης δεν επιτρέπεται να γυρίσει σφάλμα στον
 *    μεσίτη που μόλις δεσμεύτηκε.
 */

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import {
  getCurrentEnvironment,
  NOTIFICATION_ENTITY_TYPES,
  NOTIFICATION_EVENT_TYPES,
  SOURCE_SERVICES,
} from '@/config/notification-events';
import { createModuleLogger } from '@/lib/telemetry';
import { dispatchNotification } from '@/server/notifications/notification-orchestrator';
import type { MandateRequestDecision } from '@/types/mandate-request';
import type { PublicListing } from '@/types/public-listing';

const logger = createModuleLogger('mandate-request-notifier.service');

/** Ό,τι χρειάζεται για να ειπωθεί «ποιο γραφείο απάντησε τι, για ποια αγγελία». */
export interface MandateRequestAnswer {
  readonly requestId: string;
  readonly ownerPropertyId: string;
  /** Ο **ιδιώτης** — παραλήπτης **και** μισθωτής. */
  readonly recipientUserId: string;
  readonly agencyName: string;
  readonly decision: MandateRequestDecision;
}

/**
 * **Τίτλος ανά απόφαση** — στατικός πίνακας πάνω στο **κλειστό σύνολο**.
 *
 * ⛔ **ΠΟΤΕ ``t(`...${decision}`)``**: το δυναμικό κλειδί είναι **δομικά αόρατο** στη
 * CHECK 3.8, και η διαγραφή του από τα locales δεν θα κοκκίνιζε τίποτα. Ο τύπος
 * `Record<MandateRequestDecision, string>` κάνει την **τέταρτη** απόφαση αδύνατο να
 * προστεθεί χωρίς κείμενο.
 *
 * ⚠️ **Χωρίς πρόθεμα namespace**: ο `NotificationDrawer` αποδίδει με
 * `COMMON_NAMESPACES`, άρα τα κλειδιά ζουν στο `common-shared`.
 */
const TITLE_KEYS: Record<MandateRequestDecision, string> = {
  accepted: 'mandateRequestAnswered.acceptedTitle',
  'declined-revisable': 'mandateRequestAnswered.revisableTitle',
  'declined-final': 'mandateRequestAnswered.finalTitle',
};

/**
 * **Το θέμα του email**, ελληνικά, στον διακομιστή.
 *
 * ⚠️ **Το `titleKey` είναι η αλήθεια· αυτό είναι το ΘΕΜΑ.** Το έγγραφο ειδοποίησης ζει
 * για πάντα και ο άνθρωπος μπορεί να αλλάξει γλώσσα, οπότε η οθόνη αποδίδει **το
 * κλειδί**. Το email όμως συντίθεται εδώ, όπου **δεν υπάρχει** αποδότης i18n.
 * 🔶 Ο αποδότης i18n διακομιστή είναι υπαρκτό, **ονομασμένο** κενό (ADR-777 §8.22
 * ανοιχτό #2) — **κοινό** με τους δύο άλλους αγωγούς, όχι δικό μας.
 */
const EMAIL_SUBJECTS: Record<MandateRequestDecision, (agency: string, title: string) => string> = {
  accepted: (agency, title) => `Το «${agency}» ανέλαβε την αγγελία «${title}» — ΝΕΣΤΩΡ`,
  'declined-revisable': (agency, title) =>
    `Το «${agency}» σας ζητά να ξαναστείλετε το αίτημα για «${title}» — ΝΕΣΤΩΡ`,
  'declined-final': (agency, title) =>
    `Το «${agency}» δεν ανέλαβε την αγγελία «${title}» — ΝΕΣΤΩΡ`,
};

/**
 * **Ο ιδιώτης μαθαίνει τι απάντησε το γραφείο.**
 *
 * @returns `true` όταν στάλθηκε· `false` όταν παραλείφθηκε (κλειστός διακόπτης, ή
 *   αποτυχία που καταγράφηκε). **Κανένα πέταγμα.**
 */
export async function announceMandateRequestAnswer(
  adminDb: AdminFirestore,
  answer: MandateRequestAnswer,
): Promise<boolean> {
  try {
    const listingTitle = await listingTitleOf(adminDb, answer.ownerPropertyId);

    const result = await dispatchNotification({
      eventType: NOTIFICATION_EVENT_TYPES.PROPERTIES_MANDATE_REQUEST_ANSWERED,
      recipientId: answer.recipientUserId,
      // 🔑 **Ο ίδιος ο άνθρωπος είναι ο μισθωτής του** — δες την κεφαλίδα.
      tenantId: answer.recipientUserId,
      title: EMAIL_SUBJECTS[answer.decision](answer.agencyName, listingTitle),
      titleKey: TITLE_KEYS[answer.decision],
      titleParams: { agency: answer.agencyName, title: listingTitle },
      // 🔴 **Η ΤΑΥΤΟΤΗΤΑ ΤΟΥ ΓΕΓΟΝΟΤΟΣ ΕΙΝΑΙ Η ΜΕΤΑΒΑΣΗ, ΟΧΙ Η ΩΡΑ** — δες την
      //    κεφαλίδα για το πόσο ακριβά κόστισε αυτό το μάθημα στον γειτονικό αγωγό.
      eventId: `mandate-request:${answer.requestId}:pending>${answer.decision}`,
      entityId: answer.ownerPropertyId,
      entityType: NOTIFICATION_ENTITY_TYPES.PROPERTY,
      source: {
        service: SOURCE_SERVICES.PROPERTIES,
        feature: 'mandate-request-answer',
        env: getCurrentEnvironment(),
      },
    });

    return result.success;
  } catch (error) {
    logger.error('Η απάντηση του γραφείου δεν ειδοποιήθηκε', {
      data: { requestId: answer.requestId },
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

/**
 * Ο τίτλος της αγγελίας για το μήνυμα.
 *
 * 🔑 **Από τη ΔΗΜΟΣΙΑ προβολή**, όχι από το ωμό έγγραφο: είναι η ίδια πηγή που είδε
 * το γραφείο όταν έκρινε (§8.2), και η μόνη που δεν χρειάζεται δεύτερη απόφαση
 * αποκάλυψης.
 *
 * ⚠️ **Εφεδρεία το αναγνωριστικό, ποτέ κενό**: ένα *«Το «Χ» ανέλαβε την αγγελία «»»*
 * είναι χειρότερο από ένα άσχημο αναγνωριστικό — ο άνθρωπος πρέπει να μπορεί να
 * καταλάβει **ποια** αγγελία, ακόμη κι όταν η προβολή έχει αποσυρθεί στο μεταξύ.
 */
async function listingTitleOf(
  adminDb: AdminFirestore,
  ownerPropertyId: string,
): Promise<string> {
  try {
    const snapshot = await adminDb
      .collection(COLLECTIONS.PUBLIC_LISTINGS)
      .doc(ownerPropertyId)
      .get();

    // ⚠️ Το `as` πέφτει σε **ωμό έγγραφο**: ο τίτλος μπορεί να λείπει από παλιό
    //    στιγμιότυπο, οπότε ελέγχεται ως `unknown` και όχι ως εγγυημένη συμβολοσειρά.
    const title: unknown = (snapshot.data() as PublicListing | undefined)?.title;
    return typeof title === 'string' && title.trim() !== '' ? title.trim() : ownerPropertyId;
  } catch (error) {
    logger.warn('Ο τίτλος της αγγελίας δεν διαβάστηκε — το μήνυμα φεύγει με αναγνωριστικό', {
      data: { ownerPropertyId },
      error: error instanceof Error ? error.message : String(error),
    });
    return ownerPropertyId;
  }
}
