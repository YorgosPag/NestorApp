/**
 * @fileoverview **ΠΟΥ ΟΔΗΓΕΙ Η ΕΙΔΟΠΟΙΗΣΗ ΤΟΥ ΔΙΚΤΥΟΥ — ΚΑΙ ΠΟΙΑ ΕΙΝΑΙ ΤΑ ΣΥΜΦΡΑΖΟΜΕΝΑ ΤΗΣ.**
 * Καθαρός πυρήνας, **μηδέν** I/O.
 * @related ADR-867 Β7 · Β9γ · §8 #9 · ADR-849 Β1 (προορισμός **με** χώρο) · Β2 (ανιχνευτής απόκλισης)
 * @module services/network-messaging/network-destination
 *
 * 🔑 **ΕΝΑΣ τόπος, ΔΥΟ καταναλωτές**: ο αποστολέας (`network-notifier.ts`) τον ρωτά όταν γράφει την
 * ειδοποίηση· ο ανιχνευτής (`notification-destination-rules.ts`) τον ρωτά όταν ελέγχει τι **θα** έγραφε
 * σήμερα. Δεύτερο αντίγραφο θα απέκλινε την ημέρα που μετακομίσει μια σελίδα (ADR-749).
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΔΥΟ ΕΡΩΤΗΣΕΙΣ, ΟΧΙ ΜΙΑ — ΚΑΙ ΤΟ ΕΛΑΤΤΩΜΑ ΗΤΑΝ ΟΤΙ ΤΙΣ ΑΠΑΝΤΟΥΣΕ ΜΑΖΙ (Β9γ)
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Εδώ ζούσε **ένας** πίνακας που απαντούσε ταυτόχρονα *«πού ανοίγει η ειδοποίηση;»* και *«ποια
 * είναι η σελίδα της πράξης;»* — σαν να ήταν το ίδιο ερώτημα. **Δεν είναι**, και το απέδειξε η
 * ζωντανή επαλήθευση (2026-09-21, νήμα `nthr_42f6cdda…`): για αγγελία **ιδιώτη** με εντολή σε
 * γραφείο, η σελίδα της πράξης **στο γραφείο δεν υπάρχει** (`isPersonalCustody ⇒ not-yours`,
 * σωστά — δεύτερος άξονας απομόνωσης απαγορεύεται ονομαστικά στο `tenant-config.ts`). Η ειδοποίηση
 * και ο κατάλογος οδηγούσαν εκεί ⇒ **«Αυτή η εντολή δεν βρέθηκε»**.
 *
 * Πλέον:
 *
 * | Ερώτηση | Απάντηση | Ποιος ρωτά |
 * |---|---|---|
 * | **πού ανοίγει;** | `threadDestination` — **πάντα** η συνομιλία, στον ιδιωτικό χώρο του παραλήπτη | ειδοποιήσεις · κατάλογος |
 * | **ποια είναι η πράξη;** | `actContextDestination` — η σελίδα της, **ανά πλευρά** | η κάρτα συμφραζομένων |
 *
 * 🔑 **Η πρώτη ΔΕΝ διακλαδώνεται**: ο ιδιωτικός χώρος ενός ανθρώπου υπάρχει πάντα ⇒ σπασμένος
 * σύνδεσμος **δομικά αδύνατος**, και το νήμα **σχέσης** (Β8) παίρνει προορισμό δωρεάν — έως τώρα
 * έπαιρνε `null` («δεν έχει οθόνη»).
 * ⚠️ Η δεύτερη λέει **ποια σελίδα είναι**, ποτέ **αν ανοίγει**: την επιμέλεια την ξέρει μόνο το
 * έγγραφο της αγγελίας, και τη ρωτά ο **αναγνώστης** (`thread-context.ts`). Αυτό το αρχείο μένει
 * καθαρό.
 *
 * ⚠️ Ο πυρήνας **δεν ξέρει** τι είναι «εντολή» (ADR-867 §3): ρωτά το **αντικείμενο** της πράξης από το
 * μητρώο πηγών ακμής (`actSubjectOf`)· εδώ ζει **μόνο** «αντικείμενο → σελίδα» ανά πλευρά.
 */

import { mandateThreadHref } from '@/lib/mandate/mandate-routes';
import { threadHref } from '@/lib/network-messaging/network-messaging-routes';
import { actSubjectOf, type ActSubject } from '@/lib/network-edge/edge-sources';
import { viewDestination, type NotificationDestination } from '@/lib/notifications/notification-destination';
import { offerThreadHref } from '@/lib/owner-property/owner-property-routes';
import type { NetworkThreadTopic } from '@/types/network-thread';
import { orgWorkspace, personalWorkspace } from '@/types/workspace-membership';

// =============================================================================
// 1. ΠΟΥ ΑΝΟΙΓΕΙ — μία απάντηση, καμία διακλάδωση
// =============================================================================

/**
 * **Η συνομιλία, στον ιδιωτικό χώρο ΑΥΤΟΥ του παραλήπτη.**
 *
 * 🔑 Ίδια απάντηση για γραφείο και ιδιοκτήτη, για πράξη και για σχέση. Ο χώρος είναι **προσωπικός**
 * επειδή το νήμα είναι `cross-space-thread`: η εμβέλειά του είναι ο **άνθρωπος** — δες
 * `network-messaging-routes.ts`.
 *
 * ⛔ **ΜΗΝ προσθέσεις εδώ διακλάδωση «αν η πράξη έχει σελίδα»**: ακριβώς αυτή η διακλάδωση γέννησε
 * το ελάττωμα του Β9γ, και θα απαιτούσε **ανάγνωση** μέσα σε καθαρό πυρήνα.
 */
export function threadDestination(threadId: string, recipientUid: string): NotificationDestination {
  return viewDestination(threadHref(threadId), personalWorkspace(recipientUid));
}

// =============================================================================
// 2. ΠΟΙΑ ΕΙΝΑΙ Η ΠΡΑΞΗ — τα συμφραζόμενα της συνομιλίας
// =============================================================================

/**
 * «Αντικείμενο → σελίδα της πράξης» ανά πλευρά. Νέο είδος αντικειμένου χωρίς γραμμή ⇒ δεν μεταγλωττίζεται.
 * ⚠️ Το `viewDestination` καλείται **με τον βοηθό `…Href` απευθείας** (Κ2 της `notification-destination-custody`).
 */
const SURFACES: {
  readonly [K in ActSubject['kind']]: {
    readonly host: (subject: Extract<ActSubject, { kind: K }>, threadId: string, companyId: string) => NotificationDestination;
    readonly counterpart: (subject: Extract<ActSubject, { kind: K }>, threadId: string, uid: string) => NotificationDestination;
  };
} = {
  listing: {
    host: (subject, threadId, companyId) =>
      viewDestination(mandateThreadHref(subject.ownerPropertyId, threadId), orgWorkspace(companyId)),
    counterpart: (subject, threadId, uid) =>
      viewDestination(offerThreadHref(subject.ownerPropertyId, threadId), personalWorkspace(uid)),
  },
};

/**
 * **Η σελίδα της πράξης για ΑΥΤΟΝ τον αναγνώστη** — `null` όταν το νήμα δεν είναι πράξη ή ο σπόρος
 * δεν διαβάζεται.
 *
 * Η πλευρά κρίνεται από το **θέμα** του νήματος (ο αντισυμβαλλόμενος είναι γραμμένος εκεί), ποτέ από
 * τον ρόλο του αναγνώστη — ο ρόλος αλλάζει με την ομάδα, η πλευρά όχι.
 */
export function actContextDestination(
  topic: NetworkThreadTopic,
  threadId: string,
  readerUid: string,
): NotificationDestination | null {
  if (topic.kind !== 'act') return null;
  const subject = actSubjectOf(topic.actKind, topic.actSeed);
  if (subject === null) return null;
  return readerUid === topic.counterpartUid
    ? SURFACES[subject.kind].counterpart(subject, threadId, readerUid)
    : SURFACES[subject.kind].host(subject, threadId, topic.hostCompanyId);
}
