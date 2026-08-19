/**
 * @fileoverview **Η ΕΙΔΗΣΗ ΦΤΑΝΕΙ ΣΕ ΑΝΘΡΩΠΟ** — το δόλωμα του §12.6, ως ειδοποίηση.
 * @related ADR-777 §7 (Α9 · Α14) · SPEC-777B §12.6 · ADR-026 (orchestrator ειδοποιήσεων)
 * @module services/demand/interest-notifier.service
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ΤΙ ΔΕΝ ΧΤΙΣΤΗΚΕ ΕΔΩ — **και είναι ο λόγος που το αρχείο είναι μικρό**
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η επιλογή του Giorgio (2026-08-12) ήταν *«email που τον ξυπνά»*. Το SSoT audit βρήκε
 * ότι **όλα** τα κομμάτια υπάρχουν και ήταν ασύνδετα:
 *
 * | Χρειαζόταν | Υπήρχε ήδη |
 * |---|---|
 * | αποστολή email | `server/comms/orchestrator` (Resend → Mailgun) |
 * | προτιμήσεις χρήστη | `UserNotificationSettings` (+ διακόπτης ανά κατηγορία) |
 * | ειδοποίηση εντός εφαρμογής | `notifications` + `NotificationDrawer` |
 * | **αντι-spam** | `dispatchNotification` → **ατομικό `create()` σε ντετερμινιστικό `dedupeKey`** |
 *
 * 🔑 **Άρα δεν γράφτηκε ΚΑΝΕΝΑΣ μηχανισμός αποστολής, κανένα «last notified at», καμία
 * ουρά.** Γράφτηκε **ένα κλειδί** ({@link announcementEventId}) — και το υπάρχον
 * idempotency έγινε ο αντι-spam φρουρός. Ένα δεύτερο πεδίο «πότε του το είπαμε» θα
 * ήταν δεύτερη αλήθεια για κάτι που το σύστημα **ήδη ξέρει** (ADR-749), με τη χειρότερη
 * συνέπεια: απόκλιση ⇒ διπλό email ή **κανένα**.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔶 **ΔΗΛΩΜΕΝΟ ΟΡΙΟ: ΕΙΔΟΠΟΙΟΥΝΤΑΙ ΟΙ ΙΔΙΩΤΕΣ. ΤΑ ΓΡΑΦΕΙΑ ΒΛΕΠΟΥΝ ΤΟ ΠΑΝΕΛ.**
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το `owner_properties` έχει **έναν, μονοσήμαντο** παραλήπτη (`ownerUserId`). Το
 * `properties` ανήκει σε **εταιρεία**, και ο παραλήπτης μιας ειδοποίησης πρέπει να
 * είναι **άνθρωπος**: ποιος από τους δέκα υπαλλήλους; Ο δημιουργός; Ο υπεύθυνος;
 * Όλοι;
 *
 * ⚠️ **Δεν επινοήθηκε απάντηση.** Είναι **απόφαση τομέα** — και μια αυθαίρετη επιλογή
 * εδώ θα ήταν χειρότερη από την απουσία: θα έστελνε ειδοποιήσεις σε λάθος άνθρωπο και
 * θα **φαινόταν** ότι το χαρακτηριστικό δουλεύει. Η διαδρομή `/api/demand/interest`
 * απαντά **και για τα δύο** μονοπάτια (το πάνελ δουλεύει παντού)· μόνο η **ώθηση**
 * περιμένει την απόφαση. Δες ADR-777 §8.22 (ανοιχτό #1).
 *
 * **Layering**: service — Admin SDK + orchestrator. Η **κρίση** ζει στο `lib/demand/`.
 */

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { nowISO, todayLocalDate } from '@/lib/date-local';
import { createModuleLogger } from '@/lib/telemetry';
import { NOTIFICATION_EVENT_TYPES, SOURCE_SERVICES, getCurrentEnvironment } from '@/config/notification-events';
import { dispatchNotification } from '@/server/notifications/notification-orchestrator';
import { discloseInterest } from '@/lib/demand/demand-interest';
import {
  announcementBand,
  announcementEventId,
  type AnnouncementBand,
} from '@/lib/demand/demand-announcement';
import { readLiveDemands } from '@/services/demand/live-demands.reader';
import { ownerPropertyFactsOf } from './place-interest.service';
import type { OwnerProperty } from '@/types/owner-property';
import type { PropertyDemand } from '@/types/property-demand';

const logger = createModuleLogger('demand/interest-notifier');

/**
 * 🔴 **Πόσα ακίνητα ιδιωτών εξετάζονται σε ένα πέρασμα.**
 *
 * Ίδιο συμβόλαιο με το `MAX_DEMAND_CANDIDATES`: το ταίριασμα είναι **τομή ευρών**, άρα
 * δεν εκφράζεται ως ερώτημα Firestore και απαιτεί κρίση στη μνήμη. Το όριο
 * **δηλώνεται** στο αποτέλεσμα όταν αγγιχτεί — σιωπηλό κόψιμο θα σήμαινε ιδιοκτήτες
 * που **δεν ειδοποιήθηκαν ποτέ** και κανείς δεν το ξέρει.
 */
export const MAX_ANNOUNCE_PROPERTIES = 500;

/** Τι έκανε το πέρασμα. **Κλειστή λογιστική** — κάθε ακίνητο σε έναν κάδο. */
export interface AnnouncementReport {
  /** Στάλθηκε **νέα** είδηση (πέρασε ζώνη που δεν του είχαμε πει). */
  readonly announced: number;
  /** Είχε ζώνη, **του το είχαμε ήδη πει** — το `dedupeKey` το σταμάτησε. */
  readonly alreadyKnown: number;
  /** Δεν υπάρχει είδηση (κάτω από την πρώτη ζώνη ή λογοκριμένο). */
  readonly noNews: number;
  /** Ο χρήστης έχει κλείσει αυτή την ειδοποίηση — **σεβαστό, και μετρημένο**. */
  readonly optedOut: number;
  /** Πόσα ακίνητα εξετάστηκαν. */
  readonly considered: number;
  /** `true` όταν αγγίχθηκε το {@link MAX_ANNOUNCE_PROPERTIES}. */
  readonly truncated: boolean;
}

/** Κλείνει το άθροισμα; Υπάρχει **για να αποτύχει θορυβωδώς**. */
export function announcementReportBalances(report: AnnouncementReport): boolean {
  return (
    report.announced + report.alreadyKnown + report.noNews + report.optedOut ===
    report.considered
  );
}

/**
 * **Πες σε κάθε ιδιώτη ιδιοκτήτη ό,τι είναι είδηση για εκείνον.**
 *
 * ⚠️ **Idempotent.** Δύο διαδοχικές κλήσεις χωρίς αλλαγή στην αγορά στέλνουν **μηδέν**
 * δεύτερα μηνύματα: το `create()` του orchestrator πάνω στο ντετερμινιστικό κλειδί
 * αποτυγχάνει, και επιστρέφει `skipped: true`.
 */
export async function announceInterestToOwners(
  db: AdminFirestore,
): Promise<AnnouncementReport> {
  const { demands } = await readLiveDemands(db, 'demand/interest-notifier');
  const snapshot = await db
    .collection(COLLECTIONS.OWNER_PROPERTIES)
    .limit(MAX_ANNOUNCE_PROPERTIES)
    .get();

  const properties = snapshot.docs.map((doc) => ({
    ...(doc.data() as OwnerProperty),
    id: doc.id,
  }));

  const report = await tallyAnnouncements(properties, demands);

  // 🔴 Άγνωστη κατάσταση ⇒ σφάλμα **με όνομα**, ποτέ σιωπηλή απώλεια κάδου.
  if (!announcementReportBalances(report)) {
    throw new Error(
      `interest-notifier: ασυνεπής λογιστική — ${report.announced}+${report.alreadyKnown}+` +
        `${report.noNews}+${report.optedOut} ≠ ${report.considered}`,
    );
  }

  if (report.truncated) {
    logger.warn('Το όριο ακινήτων αγγίχθηκε — κάποιοι ιδιοκτήτες ΔΕΝ εξετάστηκαν', {
      data: { limit: String(MAX_ANNOUNCE_PROPERTIES) },
    });
  }

  return report;
}

/**
 * Ο βρόχος που **μετράει και στέλνει** — χωριστά από τη λογιστική που **κλείνει**.
 *
 * ⚠️ **Μία ανάγνωση ρολογιού για όλο το πέρασμα**: δύο κλήσεις θα έκριναν τα πρώτα
 * ακίνητα σε άλλη στιγμή από τα τελευταία, δηλαδή η φρεσκάδα μιας ζήτησης θα μπορούσε
 * να λήξει **στη μέση** της ίδιας σάρωσης. Ίδιο συμβόλαιο με το `writeListingProjection`.
 */
async function tallyAnnouncements(
  properties: readonly OwnerProperty[],
  demands: readonly PropertyDemand[],
): Promise<AnnouncementReport> {
  const nowIso = nowISO();
  const todayDate = todayLocalDate();
  let announced = 0;
  let alreadyKnown = 0;
  let noNews = 0;
  let optedOut = 0;

  for (const property of properties) {
    const facts = ownerPropertyFactsOf(property, nowIso);
    const { interest } = discloseInterest(facts, demands, nowIso, todayDate);
    const band = announcementBand(interest.disclosure.count);

    if (band === null) {
      noNews += 1;
      continue;
    }

    const outcome = await announceOne(property, band, interest.disclosure.count ?? 0);
    if (outcome === 'announced') announced += 1;
    else if (outcome === 'already-known') alreadyKnown += 1;
    else optedOut += 1;
  }

  return {
    announced,
    alreadyKnown,
    noNews,
    optedOut,
    considered: properties.length,
    truncated: properties.length === MAX_ANNOUNCE_PROPERTIES,
  };
}

/** Τι απέγινε **ένα** ακίνητο. Ονομασμένο, ποτέ boolean. */
type AnnounceOutcome = 'announced' | 'already-known' | 'opted-out';

/**
 * Το θέμα του email — **μία** διατύπωση, σε **μία** θέση.
 *
 * ⚠️ Δεν είναι παράβαση της N.11 «κρυμμένη σε σταθερά»: είναι το **μόνο** σημείο όπου
 * ο διακομιστής συνθέτει κείμενο χωρίς αποδότη i18n, και είναι γραμμένο **έτσι ώστε ο
 * μελλοντικός αποδότης να το αντικαταστήσει με μία γραμμή** αντί να το κυνηγήσει μέσα
 * σε κλήση 12 ορισμάτων.
 */
const EMAIL_SUBJECT = (count: number): string =>
  `${count} άτομα ψάχνουν ακίνητο σαν το δικό σας — ΝΕΣΤΩΡ`;

/**
 * Μία ειδοποίηση.
 *
 * ⚠️ **Ο τίτλος ταξιδεύει ως κλειδί i18n** (`titleKey` + `titleParams`), όχι ως
 * ελληνικό κείμενο: το έγγραφο ειδοποίησης ζει για πάντα και ο χρήστης μπορεί να
 * αλλάξει γλώσσα (N.11). Το `title` δίνεται ως **εφεδρεία** γιατί το ίδιο πεδίο
 * γίνεται και **θέμα του email**.
 */
async function announceOne(
  property: OwnerProperty,
  band: AnnouncementBand,
  count: number,
): Promise<AnnounceOutcome> {
  const result = await dispatchNotification({
    eventType: NOTIFICATION_EVENT_TYPES.PROPERTIES_DEMAND_INTEREST,
    recipientId: property.ownerUserId,
    // Ο ιδιώτης **δεν έχει εταιρεία** — το επίπεδο απομόνωσής του είναι ο εαυτός του
    // (`tenant-config.ts`, `mode: 'userId'`). Ο μισθωτής της ειδοποίησης είναι ο ίδιος.
    tenantId: property.ownerUserId,
    // ⚠️ **Το `titleKey` είναι η αλήθεια· το `title` είναι το ΘΕΜΑ ΤΟΥ EMAIL.** Το
    // έγγραφο ειδοποίησης ζει για πάντα και ο χρήστης μπορεί να αλλάξει γλώσσα, οπότε
    // η οθόνη αποδίδει **το κλειδί** (N.11). Το email όμως συντίθεται στον διακομιστή,
    // όπου **δεν υπάρχει** αποδότης i18n — γι' αυτό το θέμα γράφεται εδώ, με το ίδιο
    // ιδίωμα που ήδη χρησιμοποιεί ο `channels/email-channel.ts` για τις προσκλήσεις
    // προμηθευτών. 🔶 Ο **αποδότης i18n διακομιστή** είναι υπαρκτό, ονομασμένο κενό
    // (ADR-777 §8.22 ανοιχτό #2) — **κοινό** με το ADR-327, όχι δικό μας.
    title: EMAIL_SUBJECT(count),
    // ⚠️ **Χωρίς πρόθεμα namespace, και είναι μετρημένο**: ο `NotificationDrawer`
    // αποδίδει με `useTranslation(COMMON_NAMESPACES)`, οπότε το κλειδί ζει στο
    // `common-shared` — ένα `search-results:` πρόθεμα εδώ **δεν θα έλυνε**, γιατί
    // εκείνο το namespace δεν είναι φορτωμένο στον drawer.
    titleKey: 'demandInterest.notificationTitle',
    titleParams: { count: String(count), title: property.title },
    // 🔑 **Η ΖΩΝΗ, ποτέ το ωμό πλήθος** — αυτό, και μόνο αυτό, κάνει την επανάληψη
    // δομικά αδύνατη. Δες `lib/demand/demand-announcement.ts`.
    eventId: announcementEventId(property.id, band),
    entityId: property.id,
    source: { service: SOURCE_SERVICES.CRM, feature: 'demand-interest', env: getCurrentEnvironment() },
  });

  if (!result.success) return 'opted-out';
  if (result.skipped) {
    // ⚠️ Δύο **διαφορετικοί** λόγοι παράλειψης, και η διάκριση έχει σημασία: «του το
    // είπαμε ήδη» είναι επιτυχία του αντι-spam· «το έκλεισε» είναι επιλογή ανθρώπου.
    return result.reason?.includes('Duplicate') === true ? 'already-known' : 'opted-out';
  }
  return 'announced';
}
