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
  CLIENT_NAME_IS_MISSING,
  CLIENT_NAME_KNOWN,
  CLIENT_NAME_MISSING,
  CLIENT_NAME_UNNAMED,
  withEmailAsName,
  type MandateClientName,
} from '@/lib/mandate/mandate-client-name';
import { createModuleLogger } from '@/lib/telemetry';
import { dispatchNotification } from '@/server/notifications/notification-orchestrator';
// 🔑 **Ο ΥΠΑΡΧΩΝ helper, ποτέ χειρόγραφο `/listings/mandates/${id}`** — κουβαλά ήδη το
//    `encodeURIComponent` και είναι το **ένα** σημείο που ξέρει τη διαδρομή (Κ2 της
//    `notification-destination-custody`).
import { mandateDetailHref } from '@/lib/mandate/mandate-routes';
import type { Contact } from '@/types/contacts/contracts';
import { getContactDisplayName, getPrimaryEmail } from '@/types/contacts/helpers';
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
 * **Πώς λέγεται ο πελάτης** — ή **ΠΟΙΑ** από τις δύο άγνοιες ισχύει (ADR-841 §7 Α18.13).
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΕΔΩ ΕΓΡΑΦΕ Η ΕΙΔΟΠΟΙΗΣΗ ΕΝΑ **UUID** ΣΕ ΑΝΘΡΩΠΟ — ΜΕΤΡΗΜΕΝΟ ΖΩΝΤΑΝΑ 05/09
 * ────────────────────────────────────────────────────────────────────────────
 *
 * > *«Ο/Η **cont_da84f8c4-2344-4f0f-b161-d1f795d25d2f** ενέκρινε την εντολή για
 * > «TEST-3…»»*
 *
 * Η γραμμή έλεγε `named.kind === KNOWN ? named.name : clientContactId` — δηλαδή ρωτούσε
 * τον **σωστό** κριτή και μετά **πετούσε την απάντησή του**, ισοπεδώνοντας τους **τρεις**
 * κόσμους σε δύο. Η κεφαλίδα της μάλιστα το **δικαιολογούσε** *(«εφεδρεία το
 * αναγνωριστικό, ποτέ κενό»)* — σωστό ως προς το ότι το **κενό** είναι χειρότερο, και
 * **λάθος** ως προς το ότι αυτές ήταν οι μόνες δύο επιλογές.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ✅ Η ΤΡΙΤΗ ΕΠΙΛΟΓΗ ΥΠΗΡΧΕ, ΚΑΙ ΤΗΝ ΕΧΕΙ Η ΑΓΟΡΑ ΑΠΟ ΤΟ RFC 5322
 * ────────────────────────────────────────────────────────────────────────────
 *
 * **Η διεύθυνση ηλεκτρονικού ταχυδρομείου ΕΙΝΑΙ όνομα.** Το RFC 5322 δέχεται ρητά
 * `mailbox` **χωρίς** `display-name`, και κάθε πελάτης — Gmail, Outlook, Apple Mail —
 * αποδίδει τότε **τη διεύθυνση**. ⇒ {@link withEmailAsName}, που **προάγει** το
 * `unnamed` σε `known` αντί να γεννήσει τέταρτο όνομα.
 *
 * ⚠️ **ΚΑΙ ΤΟ ΑΠΟΤΕΛΕΣΜΑ ΔΕΝ ΕΙΝΑΙ ΠΙΑ ΣΥΜΒΟΛΟΣΕΙΡΑ**: ο καλών χρειάζεται να **ξέρει**
 * ποια περίπτωση ισχύει, γιατί οι τρεις παίρνουν **διαφορετική πρόταση** — όχι το ίδιο
 * κείμενο με άλλο υποκείμενο. Ένα `string` εδώ θα ξανάκρυβε ακριβώς αυτό.
 */
async function clientNameOf(
  adminDb: AdminFirestore,
  clientContactId: string,
): Promise<MandateClientName> {
  const snapshot = await adminDb
    .collection(COLLECTIONS.CONTACTS)
    .doc(clientContactId)
    .get();

  // 🔑 **Σπασμένος δεσμός, και λέγεται.** Ο μεσίτης πρέπει να καταλάβει ότι η δουλειά
  //    του είναι *«ξαναδέσε τον πελάτη»* — άλλη από το *«συμπλήρωσε την καρτέλα»*.
  if (!snapshot.exists) return CLIENT_NAME_IS_MISSING;

  const contact = { ...(snapshot.data() as object), id: snapshot.id } as Contact;

  // ⚠️ Ίδια άμυνα με τον κατάλογο: το `as Contact` πέφτει σε **ωμό έγγραφο**, όπου ο
  // διακριτής μπορεί να λείπει ⇒ `undefined`. Εδώ η συνέπεια θα ήταν χειρότερη από
  // λάθος όνομα: η ειδοποίηση **δεν θα έφευγε καθόλου**, και ο μεσίτης δεν θα μάθαινε
  // ποτέ ότι ο πελάτης απάντησε.
  //
  // 🔑 **Ο κριτής είναι ΕΝΑΣ** (ADR-834 §6.5.δ, N.0.2): το *«μετράει αυτό ως όνομα;»* το
  //    απαντά το {@link clientNameFrom}, ο ίδιος που χρησιμοποιεί ο κατάλογος.
  //
  // 🔑 **Και το email μπαίνει από τον ΕΝΑ αναγνώστη** ({@link getPrimaryEmail}) — ποτέ
  //    χειρόγραφο `emails[0].email`: εκείνος ξέρει τι σημαίνει «πρωτεύον».
  return withEmailAsName(
    clientNameFrom(getContactDisplayName(contact)),
    getPrimaryEmail(contact),
  );
}

/**
 * **Η ΑΠΟΦΑΣΗ ΤΟΥ ΠΕΛΑΤΗ × ΤΟ ΠΩΣ ΤΟΝ ΛΕΜΕ** — έξι προτάσεις, καμία συναρμολογημένη.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΞΕΧΩΡΙΣΤΟ ΚΛΕΙΔΙ ΚΑΙ ΟΧΙ `{client}` ΜΕ ΑΛΛΗ ΤΙΜΗ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Θα ήταν μία γραμμή να μπει στο `{client}` ένα «Πελάτης χωρίς όνομα». Θα σήμαινε ότι
 * η **άγνοια** μπαίνει στη θέση **υποκειμένου**, δηλαδή προτάσεις όπως *«Ο/Η Πελάτης
 * χωρίς όνομα ενέκρινε…»* — και σε **κάθε άλλη γλώσσα** θα έσπαγαν αλλιώς *(γένος,
 * πτώση, άρθρο)*. **Η άγνοια δεν είναι όνομα· είναι άλλη πρόταση.**
 *
 * 🔑 **`Record` δεμένο στη ρίζα του λεξιλογίου** *(ιδίωμα CHECK 3.73)*: μια τέταρτη
 * κατάσταση ονόματος **δεν μεταγλωττίζεται** μέχρι κάποιος να αποφασίσει τι λέει στον
 * άνθρωπο. Ένα δυναμικό ``t(`mandateDecision.${kind}Title`)`` θα «δούλευε» και θα
 * ζωγράφιζε **ωμό κλειδί** — **αόρατο στη CHECK 3.8**, που διαβάζει κυριολεκτικά
 * ορίσματα.
 *
 * ⚠️ **Χωρίς πρόθεμα namespace**: ο `NotificationDrawer` αποδίδει με
 * `COMMON_NAMESPACES`, άρα τα κλειδιά ζουν στο `common-shared`.
 */
const DECISION_TITLE_KEYS: Record<
  'confirmed' | 'declined',
  Record<MandateClientName['kind'], string>
> = {
  confirmed: {
    [CLIENT_NAME_KNOWN]: 'mandateDecision.confirmedTitle',
    [CLIENT_NAME_UNNAMED]: 'mandateDecision.confirmedTitleUnnamed',
    [CLIENT_NAME_MISSING]: 'mandateDecision.confirmedTitleMissing',
  },
  declined: {
    [CLIENT_NAME_KNOWN]: 'mandateDecision.declinedTitle',
    [CLIENT_NAME_UNNAMED]: 'mandateDecision.declinedTitleUnnamed',
    [CLIENT_NAME_MISSING]: 'mandateDecision.declinedTitleMissing',
  },
};

/**
 * **ΤΟ ΘΕΜΑ ΤΟΥ EMAIL** — ελληνικά, στον διακομιστή, και είναι **δηλωμένο κενό**.
 *
 * ⚠️ Το `titleKey` είναι **η αλήθεια**· αυτό είναι το θέμα. Το έγγραφο ειδοποίησης ζει
 * για πάντα και ο άνθρωπος μπορεί να αλλάξει γλώσσα, οπότε η **οθόνη** αποδίδει το
 * κλειδί. Το email όμως συντίθεται **εδώ**, όπου **δεν υπάρχει** αποδότης i18n.
 * 🔶 Ο αποδότης i18n διακομιστή είναι υπαρκτό, **ονομασμένο** κενό (ADR-777 §8.22
 * ανοιχτό #2) — **κοινό** με τους δύο άλλους αγωγούς, όχι δικό μας.
 *
 * 🔑 **Ίδιες έξι προτάσεις με τον πίνακα από πάνω**, ώστε το email και η οθόνη να μην
 * μπορούν να πουν **διαφορετικό πράγμα** για την ίδια απόφαση.
 */
const DECISION_EMAIL_SUBJECTS: Record<
  'confirmed' | 'declined',
  Record<MandateClientName['kind'], (client: string, listing: string) => string>
> = {
  confirmed: {
    [CLIENT_NAME_KNOWN]: (client, listing) =>
      `Ο/Η ${client} ενέκρινε την εντολή για «${listing}»`,
    [CLIENT_NAME_UNNAMED]: (_client, listing) =>
      `Εγκρίθηκε η εντολή για «${listing}» — ο πελάτης δεν έχει όνομα στην καρτέλα του`,
    [CLIENT_NAME_MISSING]: (_client, listing) =>
      `Εγκρίθηκε η εντολή για «${listing}» — η επαφή του πελάτη δεν βρέθηκε`,
  },
  declined: {
    [CLIENT_NAME_KNOWN]: (client, listing) =>
      `Ο/Η ${client} αρνήθηκε την εντολή για «${listing}»`,
    [CLIENT_NAME_UNNAMED]: (_client, listing) =>
      `Απορρίφθηκε η εντολή για «${listing}» — ο πελάτης δεν έχει όνομα στην καρτέλα του`,
    [CLIENT_NAME_MISSING]: (_client, listing) =>
      `Απορρίφθηκε η εντολή για «${listing}» — η επαφή του πελάτη δεν βρέθηκε`,
  },
};

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
    // ⚠️ **Στενεύει σε κλειστό σύνολο, ΟΧΙ σε boolean**: το `event.next` μπορεί να είναι
    //    και `pending`, αλλά ο φρουρός από πάνω το έχει ήδη αποκλείσει. Ένα `confirmed:
    //    boolean` θα έκρυβε αυτή την εξάρτηση· έτσι ο τύπος τη **δηλώνει**.
    const decision: 'confirmed' | 'declined' =
      event.next === 'confirmed' ? 'confirmed' : 'declined';

    const result = await dispatchNotification({
      eventType: NOTIFICATION_EVENT_TYPES.PROPERTIES_MANDATE_DECIDED,
      recipientId: event.recipientUserId,
      tenantId: event.tenantId,
      // ⚠️ **Το `title` είναι το ΘΕΜΑ ΤΟΥ EMAIL· το `titleKey` είναι η αλήθεια.** Το
      // email συντίθεται στον διακομιστή, όπου **δεν υπάρχει** αποδότης i18n — ίδιο
      // ιδίωμα και ίδιο δηλωμένο κενό με το §8.23 (ADR-777 §8.22 ανοιχτό #2).
      title: DECISION_EMAIL_SUBJECTS[decision][client.kind](
        client.kind === CLIENT_NAME_KNOWN ? client.name : '',
        event.listingTitle,
      ),
      titleKey: DECISION_TITLE_KEYS[decision][client.kind],
      // 🔴 **ΤΟ `client` ΤΑΞΙΔΕΥΕΙ ΜΟΝΟ ΟΤΑΝ ΥΠΑΡΧΕΙ.** Στις δύο άγνοιες η πρόταση
      //    **δεν έχει υποκείμενο** — και ένα κενό `{client}` θα ζωγράφιζε «Ο/Η
      //    ενέκρινε», ακριβώς το *«χειρότερο από άσχημο αναγνωριστικό»* που η παλιά
      //    κεφαλίδα φοβόταν σωστά.
      titleParams:
        client.kind === CLIENT_NAME_KNOWN
          ? { client: client.name, title: event.listingTitle }
          : { title: event.listingTitle },
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
      // 🔴 **Η ΔΙΕΥΘΥΝΣΗ ΑΝΗΚΕΙ ΣΤΟΝ ΠΑΡΑΓΩΓΟ** (ADR-841 §7 Α18) — ο μηχανισμός του
      //    `NotificationDrawer` υπήρχε ολόκληρος· έλειπε **η τροφοδοσία**.
      //
      // ═══════════════════════════════════════════════════════════════════════════
      // 🔴 ΑΥΤΗ Η ΓΡΑΜΜΗ ΑΛΛΑΞΕ **ΔΥΟ ΦΟΡΕΣ**, ΚΑΙ ΚΑΘΕ ΦΟΡΑ ΤΗΝ ΑΛΛΑΞΕ ΜΕΤΡΗΣΗ
      // ═══════════════════════════════════════════════════════════════════════════
      //
      // **(1) Ήταν ΚΕΝΗ**, με επιχείρημα διαβασμένο από κεφαλίδα αντί να μετρηθεί:
      //     *«ο παραλήπτης είναι ο υπάλληλος του γραφείου (§8.23), και το `(me)` δίνει
      //     `read` μόνο στον `authorUserId` ⇒ ψεύτικη πόρτα»*. **Η μέτρηση το
      //     ανέτρεψε**, και οι δύο πλευρές είναι μονόγραμμες:
      //
      //       `mandate-consent.service.ts:348`  →  `recipientUserId: property.authorUserId`
      //       `firestore.rules:1237`            →  `allow read: … resource.data.authorUserId == request.auth.uid`
      //
      //     ⇒ Ο παραλήπτης **ΕΙΝΑΙ** ο `authorUserId`. Η πόρτα άνοιγε **εξ ορισμού του
      //     κανόνα**. 🔑 Η κεφαλίδα δεν έλεγε ψέματα — απαντούσε **ΑΛΛΟ ΕΡΩΤΗΜΑ**:
      //     το «το γραφείο μαθαίνει» λέει **ποιος ενδιαφέρεται**, το `authorUserId`
      //     λέει **ποιος κατέχει**.
      //
      // **(2) Ήταν `offerDetailHref` — και ΑΝΟΙΓΕ, αλλά σε ΛΑΘΟΣ ΚΟΣΜΟ** (Α18.12).
      //     Το `(me)/offers/<id>` είναι ο **ιδιωτικός χώρος του ιδιώτη**: ο υπάλληλος
      //     έβλεπε την καταχώρηση *«ως συντάκτης»*, όχι μέσα στο **κέλυφος του
      //     γραφείου** — χωρίς την κατάσταση της εντολής, χωρίς τα κουμπιά της.
      //
      // 🔑 **ΚΑΙ Ο ΚΑΤΑΛΟΓΟΣ ΔΕΝ ΗΤΑΝ Η ΑΠΑΝΤΗΣΗ** *(δύο μετρήσεις, ADR-841 Α18.12.β)*:
      //    · κόβεται στις **500** γραμμές ⇒ η **ανακοινωμένη** εντολή μπορεί να λείπει,
      //      **σιωπηλά** — η κλάση ελαττώματος της Α18.9, χωρίς καν άρνηση·
      //    · ταξινομείται με **επείγον**, και μια μόλις εγκεκριμένη εντολή γίνεται
      //      `live`, **δέκατη και τελευταία** από τις δέκα καταστάσεις ⇒ ο άνθρωπος θα
      //      προσγειωνόταν στο **κάτω μέρος** μιας οθόνης τριάζ.
      //
      // ⚠️ **ΤΟ ΜΑΘΗΜΑ, ΚΑΙ ΤΩΝ ΔΥΟ ΦΟΡΩΝ**: *«ανοίγει;»* και *«είναι ο σωστός
      //    προορισμός;»* είναι **δύο** ερωτήσεις. Η πρώτη απαντιέται από τον κανόνα· η
      //    δεύτερη **μόνο** ρωτώντας τι θέλει να **κάνει** ο άνθρωπος μετά.
      actions: [{ id: 'view', label: 'view', url: mandateDetailHref(event.ownerPropertyId) }],
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
