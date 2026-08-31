/**
 * @fileoverview **«Ο ΚΩΣΤΑΣ ΑΠΑΝΤΗΣΕ»** — το γραφείο μαθαίνει τι είπε ο ιδιοκτήτης.
 * @related ADR-777 §8.34 · §8.23-§8.26 · server/notifications/notification-orchestrator.ts
 * @module services/mandate/mandate-decision-notifier.service
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 Ο ΑΓΩΓΟΣ ΥΠΗΡΧΕ ΚΑΙ ΔΕΝ ΤΟΝ ΚΑΛΟΥΣΕ ΚΑΝΕΙΣ — ΓΙ' ΑΥΤΟ ΔΕΝ ΓΡΑΦΤΗΚΕ ΜΗΧΑΝΗ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * | Χρειαζόταν | Υπήρχε ήδη |
 * |---|---|
 * | ειδοποίηση εντός εφαρμογής | `notifications` + `NotificationDrawer` |
 * | email | `dispatchNotification` → `server/comms/orchestrator` |
 * | προτίμηση χρήστη | `UserNotificationSettings.properties.mandateDecided` |
 * | αντι-spam | ατομικό `create()` σε ντετερμινιστικό `dedupeKey` |
 *
 * ⇒ Γράφτηκε **ένα κλειδί** και **ένας φρουρός αλλαγής**. Καμία ουρά, κανένα «πότε
 * του το είπαμε» — δεύτερο βιβλίο για κάτι που το σύστημα ήδη ξέρει (ADR-749).
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΕΙΔΟΠΟΙΕΙ ΜΟΝΟ ΟΤΑΝ Η ΑΠΑΝΤΗΣΗ **ΑΛΛΑΖΕΙ** — ΚΑΙ ΕΙΝΑΙ ΤΟ ΚΛΕΙΔΙ ΟΛΟΥ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ο σύνδεσμος του ιδιοκτήτη **δεν καίγεται μετά τη χρήση** επίτηδες: μπορεί να τον
 * ανοίξει δέκα φορές και να ξαναπατήσει «Εγκρίνω». Ένας αφελής ειδοποιητής θα
 * έστελνε **δέκα μηνύματα** για μία απόφαση.
 *
 * 🔑 Ο φρουρός δεν είναι χρονόμετρο — είναι **σύγκριση με την προηγούμενη απάντηση**:
 * ειδοποιούμε όταν το `pending → confirmed`, το `confirmed → declined`, το
 * `declined → confirmed`. Ίδια απάντηση ξανά ⇒ **σιωπή**. Έτσι η αλλαγή γνώμης —
 * που το §8.33 προστατεύει ρητά — **φτάνει** στο γραφείο, ενώ η επανάληψη όχι.
 *
 * ⚠️ **Το `eventId` κουβαλά το `decidedAt`**, ώστε δύο *διαφορετικές* αποφάσεις να
 * μην θεωρηθούν η ίδια από το idempotency. 🔶 **Δηλωμένο όριο**: δύο ταυτόχρονα
 * αιτήματα που διαβάζουν και τα δύο την παλιά απάντηση θα στείλουν δύο μηνύματα με
 * απόσταση ενός δευτερολέπτου. Δεν προστέθηκε συναλλαγή γι' αυτό: το τίμημα είναι ένα
 * διπλό μήνυμα σε σπάνια κούρσα, ενώ μια συναλλαγή γύρω από **αποστολή** θα κρατούσε
 * κλείδωμα όσο μιλά το δίκτυο.
 *
 * ⚠️ **Δεν πετά ΠΟΤΕ.** Η απόφαση του ιδιοκτήτη είναι **ήδη γραμμένη** όταν φτάνουμε
 * εδώ· μια αποτυχία ειδοποίησης δεν επιτρέπεται να γυρίσει σφάλμα σε άνθρωπο που
 * μόλις υπέγραψε.
 */

import 'server-only';

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import {
  getCurrentEnvironment,
  NOTIFICATION_ENTITY_TYPES,
  NOTIFICATION_EVENT_TYPES,
  SOURCE_SERVICES,
} from '@/config/notification-events';
import {
  clientNameFrom,
  CLIENT_NAME_KNOWN,
} from '@/lib/mandate/mandate-client-name';
import { createModuleLogger } from '@/lib/telemetry';
import { dispatchNotification } from '@/server/notifications/notification-orchestrator';
import type { Contact } from '@/types/contacts/contracts';
import { getContactDisplayName } from '@/types/contacts/helpers';
import type { MandateConfirmation } from '@/types/mandate';

const logger = createModuleLogger('mandate-decision-notifier.service');

/** Ό,τι χρειάζεται για να ειπωθεί «ποιος απάντησε τι, για ποιο ακίνητο». */
export interface MandateDecisionEvent {
  readonly ownerPropertyId: string;
  readonly listingTitle: string;
  readonly clientContactId: string;
  /** Ο υπάλληλος που καταχώρησε — **ο παραλήπτης** (απόφαση Giorgio, §8.23). */
  readonly recipientUserId: string;
  /** Η εταιρεία του — ο **μισθωτής** της ειδοποίησης. */
  readonly tenantId: string | null;
  readonly previous: MandateConfirmation;
  readonly next: MandateConfirmation;
  readonly decidedAt: string;
}

/**
 * Το όνομα του πελάτη για το μήνυμα.
 *
 * ⚠️ Εφεδρεία **το αναγνωριστικό της επαφής**, ποτέ κενό: ένα «Ο/Η  ενέκρινε» είναι
 * χειρότερο από ένα άσχημο αναγνωριστικό — ο μεσίτης πρέπει να μπορεί να βρει ποιον
 * αφορά, ακόμη κι όταν η επαφή σβήστηκε.
 */
async function clientNameOf(
  adminDb: AdminFirestore,
  clientContactId: string,
): Promise<string> {
  const snapshot = await adminDb
    .collection(COLLECTIONS.CONTACTS)
    .doc(clientContactId)
    .get();

  if (!snapshot.exists) return clientContactId;
  const contact = { ...(snapshot.data() as object), id: snapshot.id } as Contact;

  // ⚠️ Ίδια άμυνα με τον κατάλογο: το `as Contact` πέφτει σε **ωμό έγγραφο**, όπου ο
  // διακριτής μπορεί να λείπει ⇒ `undefined`. Εδώ η συνέπεια θα ήταν χειρότερη από
  // λάθος όνομα: η ειδοποίηση **δεν θα έφευγε καθόλου**, και ο μεσίτης δεν θα μάθαινε
  // ποτέ ότι ο πελάτης απάντησε.
  //
  // 🔑 **Ο κριτής είναι ΕΝΑΣ** (ADR-834 §6.5.δ, N.0.2): το *«μετράει αυτό ως όνομα;»* το
  //    απαντά το {@link clientNameFrom}, ο ίδιος που χρησιμοποιεί ο κατάλογος. Ήταν
  //    γραμμένο **δύο φορές** (`typeof … && .trim() !== ''`) — ίδια ουσία, άλλο σημείο,
  //    και η μία γραφή θα άλλαζε χωρίς την άλλη.
  //
  // ⚠️ **Η ΑΠΑΝΤΗΣΗ μένει διαφορετική, και είναι σωστό**: ο κατάλογος επιστρέφει
  //    **ονομασμένη άγνοια** (η οθόνη έχει λέξεις γι' αυτήν)· εδώ χρειάζεται
  //    **συμβολοσειρά πάντα**, γιατί μπαίνει σε σώμα email. Κοινός **κριτής**, όχι
  //    κοινή έξοδος.
  const named = clientNameFrom(getContactDisplayName(contact));
  return named.kind === CLIENT_NAME_KNOWN ? named.name : clientContactId;
}

/**
 * **Ο ιδιοκτήτης απάντησε** — και το γραφείο το μαθαίνει, αν άλλαξε κάτι.
 *
 * @returns `true` όταν στάλθηκε ειδοποίηση· `false` όταν παραλείφθηκε (ίδια απάντηση,
 *   κλειστός διακόπτης, ή αποτυχία που καταγράφηκε). **Κανένα πέταγμα.**
 */
export async function announceMandateDecision(
  adminDb: AdminFirestore,
  event: MandateDecisionEvent,
): Promise<boolean> {
  // 🔴 Ο φρουρός αλλαγής, **πρώτος**: μηδέν ανάγνωση επαφής, μηδέν κλήση αγωγού για
  // δέκατη φορά που ο Κώστας πάτησε το ίδιο κουμπί.
  if (event.previous === event.next) return false;

  // `pending` δεν είναι απάντηση ανθρώπου — είναι η **απουσία** απάντησης. Καμία
  // διαδρομή δεν το γράφει σήμερα, αλλά μια μελλοντική «επαναφορά σε εκκρεμή» δεν
  // πρέπει να στείλει «ο Κώστας ενέκρινε» με κενό ρήμα.
  if (event.next === 'pending') return false;

  if (event.tenantId === null) {
    logger.warn('Απόφαση εντολής χωρίς εταιρεία — καμία ειδοποίηση', {
      data: { ownerPropertyId: event.ownerPropertyId },
    });
    return false;
  }

  try {
    const client = await clientNameOf(adminDb, event.clientContactId);
    const confirmed = event.next === 'confirmed';

    const result = await dispatchNotification({
      eventType: NOTIFICATION_EVENT_TYPES.PROPERTIES_MANDATE_DECIDED,
      recipientId: event.recipientUserId,
      tenantId: event.tenantId,
      // ⚠️ **Το `title` είναι το ΘΕΜΑ ΤΟΥ EMAIL· το `titleKey` είναι η αλήθεια.** Το
      // email συντίθεται στον διακομιστή, όπου **δεν υπάρχει** αποδότης i18n — ίδιο
      // ιδίωμα και ίδιο δηλωμένο κενό με το §8.23 (ADR-777 §8.22 ανοιχτό #2).
      title: confirmed
        ? `Ο/Η ${client} ενέκρινε την εντολή για «${event.listingTitle}»`
        : `Ο/Η ${client} αρνήθηκε την εντολή για «${event.listingTitle}»`,
      // ⚠️ **Χωρίς πρόθεμα namespace**: ο `NotificationDrawer` αποδίδει με
      // `COMMON_NAMESPACES`, άρα το κλειδί ζει στο `common-shared`.
      titleKey: confirmed
        ? 'mandateDecision.confirmedTitle'
        : 'mandateDecision.declinedTitle',
      titleParams: { client, title: event.listingTitle },
      // 🔴 **Η ΤΑΥΤΟΤΗΤΑ ΤΟΥ ΓΕΓΟΝΟΤΟΣ ΕΙΝΑΙ Η ΜΕΤΑΒΑΣΗ, ΟΧΙ Η ΩΡΑ — και το βρήκε
      // ΑΓΚΥΡΑ, όχι σκέψη.** Η πρώτη γραφή ήταν `…:${decidedAt}` και **κοκκίνιζε δύο
      // στις τέσσερις εκτελέσεις**: δύο αποφάσεις μέσα στο **ίδιο χιλιοστό** παίρνουν
      // ταυτόσημο κλειδί, οπότε το idempotency του αγωγού καταπίνει τη **δεύτερη** —
      // δηλαδή το γραφείο **δεν μαθαίνει ποτέ** ότι ο πελάτης άλλαξε γνώμη. Ένα
      // «σπάνιο» σιωπηλό χάσιμο είναι ακριβώς το είδος βλάβης που κυνηγά όλο το §8.34.
      //
      // 🔑 Με τη **μετάβαση** μέσα στο κλειδί η σύγκρουση γίνεται **δομικά αδύνατη**:
      // ο φρουρός αλλαγής εγγυάται `previous !== next`, άρα μετά από κάθε ειδοποίηση
      // το `previous` της επόμενης **είναι** το `next` της προηγούμενης. Δύο
      // ταυτόσημες μεταβάσεις στο ίδιο χιλιοστό δεν μπορούν να υπάρξουν.
      eventId: `mandate-decision:${event.ownerPropertyId}:${event.previous}>${event.next}:${event.decidedAt}`,
      entityId: event.ownerPropertyId,
      entityType: NOTIFICATION_ENTITY_TYPES.PROPERTY,
      source: {
        service: SOURCE_SERVICES.PROPERTIES,
        feature: 'mandate-decision',
        env: getCurrentEnvironment(),
      },
    });

    return result.success;
  } catch (error) {
    logger.error('Η ειδοποίηση απόφασης εντολής δεν στάλθηκε', {
      data: { ownerPropertyId: event.ownerPropertyId },
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}
