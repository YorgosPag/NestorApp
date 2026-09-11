/**
 * =============================================================================
 * Ο ΜΟΝΙΜΟΣ ΣΥΝΔΕΣΜΟΣ ΤΗΣ ΕΙΔΟΠΟΙΗΣΗΣ — «πού πάει αυτό το κλικ;» (ADR-848)
 * =============================================================================
 *
 * Ο σύνδεσμος μέσα στο email **και** στο κουδούνι είναι `/n/{id}`, όχι ο προορισμός.
 * Εδώ λύνεται, **τη στιγμή του κλικ**, για τον άνθρωπο που τον πάτησε.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΤΕΣΣΕΡΑ ΠΡΑΓΜΑΤΑ ΠΟΥ ΚΑΝΕΙ ΚΑΛΥΤΕΡΑ ΑΠΟ ΤΟΝ ΣΚΕΤΟ ΣΥΝΔΕΣΜΟ
 * ────────────────────────────────────────────────────────────────────────────
 * 1. **Ίδια απάντηση για «δεν υπάρχει» και «δεν είναι δική σου».** Ένα
 *    προωθημένο email ή μια μαντεμένη ταυτότητα δεν μαθαίνει **ούτε καν** αν η
 *    ειδοποίηση υπάρχει (δόγμα Ε-5 §4 — ίδιο με το 404 του layout του χώρου).
 * 2. **«Διαβάστηκε» στο πραγματικό κλικ.** Το pixel του GitHub είναι πια
 *    αναξιόπιστο (το Apple Mail Privacy Protection φορτώνει **κάθε** εικόνα). Εδώ
 *    η εγγραφή γίνεται μόνο αφού υπάρχει **συνεδρία του ιδιοκτήτη** — ένας σαρωτής
 *    συνδέσμων (Safe Links) δεν έχει cookie, καταλήγει στη σύνδεση και **δεν γράφει
 *    τίποτα**.
 * 3. **Ο προορισμός ξαναπερνά τον φρουρό.** Διαβάζεται από δεδομένα, άρα
 *    αντιμετωπίζεται όπως κάθε `?next=`: μόνο διαδρομή του ίδιου origin.
 * 4. 🔴 **Ο χώρος είναι του ΓΕΓΟΝΟΤΟΣ, όχι του θεατή** (ADR-849 §6δ Β1). Ήταν το claim
 *    του θεατή — και ο άνθρωπος σε δύο γραφεία, ή ο διαχειριστής πλατφόρμας, άνοιγε
 *    το **λάθος** γραφείο («Το ακίνητο δεν βρέθηκε»). Πλέον ο παραγωγός **δηλώνει**
 *    τον χώρο (`meta.workspace`, πρότυπο Slack `app_redirect?team=`) και εδώ λύνεται
 *    το ψευδώνυμό του. Ο χώρος παραμένει **αίτημα**: τη συμμετοχή την κρίνει ο φύλακας
 *    του `o/[workspace]/layout.tsx` — ξένος χώρος ⇒ 404, ποτέ ξένα δεδομένα.
 *
 * @module server/notifications/notification-permalink
 * @see lib/notifications/notification-permalink-route — πώς χτίζεται ο σύνδεσμος
 * @see lib/notifications/notification-destination — ο χώρος-στόχος
 * @see app/(auth)/n/[notificationId]/page — η σελίδα
 */

import 'server-only';

import { COLLECTIONS } from '@/config/firestore-collections';
import { nowISO } from '@/lib/date-local';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import {
  firstActionUrl,
  readDestinationWorkspace,
} from '@/lib/notifications/notification-destination';
import type { PermalinkChannel } from '@/lib/notifications/notification-permalink-route';
import { safeReturnPath } from '@/lib/routes/return-path';
import { createModuleLogger } from '@/lib/telemetry';
import {
  ownerOfWorkspace,
  workspaceDestinationFor,
  workspaceDestinationOf,
  type SignedInPageIdentity,
} from '@/lib/workspace/workspace-destination';
import { isInsideWorkspace } from '@/lib/workspace/workspace-scope';
import type { WorkspaceRef } from '@/types/workspace-membership';

import { seenFields } from './notification-read';

const logger = createModuleLogger('NotificationPermalink');

/** Τι απέγινε το κλικ. **Δύο** καταστάσεις, επίτηδες — βλ. κεφαλίδα, σημείο 1. */
export type PermalinkVerdict =
  | { readonly kind: 'redirect'; readonly to: string }
  | { readonly kind: 'unavailable' };

const UNAVAILABLE: PermalinkVerdict = { kind: 'unavailable' };

/** Το όριο της Firestore για ταυτότητα εγγράφου — ό,τι το ξεπερνά δεν είναι ταυτότητα. */
const MAX_DOCUMENT_ID_BYTES = 1500;

/** Μπορεί αυτό να είναι όνομα εγγράφου; (`/` θα άλλαζε **συλλογή**, όχι έγγραφο.) */
export function isNotificationId(value: string): boolean {
  if (value.length === 0 || value === '.' || value === '..') return false;
  if (value.includes('/')) return false;
  return Buffer.byteLength(value, 'utf8') <= MAX_DOCUMENT_ID_BYTES;
}

/** Ο προορισμός **και** ο χώρος του, όπως τους δήλωσε ο παραγωγός. */
export interface PermalinkDestination {
  readonly path: string;
  /** `null` ⇒ έγγραφο πριν από το Β1 (ή αλλοιωμένο): ο χώρος λύνεται από τον θεατή. */
  readonly workspace: WorkspaceRef | null;
}

/** Ο χώρος-στόχος από το `meta` — ξανακριμένος (`readDestinationWorkspace`). */
function storedWorkspace(meta: unknown, uid: string): WorkspaceRef | null {
  if (typeof meta !== 'object' || meta === null) return null;
  return readDestinationWorkspace(Reflect.get(meta, 'workspace'), uid);
}

/**
 * **Ο προορισμός αυτής της ειδοποίησης για αυτόν τον άνθρωπο** — ή `null`.
 *
 * Καθαρή κρίση, χωρίς βάση: `null` για ανύπαρκτη, για **ξένη**, και για
 * προορισμό που δεν περνά τον φρουρό του ίδιου origin. Οι τρεις περιπτώσεις
 * **σκόπιμα** δεν ξεχωρίζουν στην έξοδο.
 */
export function permalinkDestination(
  data: Readonly<Record<string, unknown>> | undefined,
  uid: string,
): PermalinkDestination | null {
  if (!data || data.userId !== uid) return null;
  const path = safeReturnPath(firstActionUrl(data.actions));
  if (path === null) return null;
  return { path, workspace: storedWorkspace(data.meta, uid) };
}

/**
 * **Η τελική διεύθυνση.**
 *
 * | Προορισμός | Χώρος | Απάντηση |
 * |---|---|---|
 * | εκτός χώρου (`/offers`, `/listing`, `/admin`…) | — | αυτούσιος |
 * | εντός | δηλωμένος | το ψευδώνυμο **του γεγονότος** |
 * | εντός | λείπει (παλιό έγγραφο) | ο χώρος του **θεατή** — η συμπεριφορά πριν το Β1 |
 *
 * ⚠️ Ο τρίτος κλάδος **δεν είναι μαντεψιά που γράφτηκε τώρα** — είναι η παλιά συμπεριφορά,
 * κρατημένη για έγγραφα που δεν μπορούν να δηλώσουν. Τα συμπληρώνει ο ανιχνευτής
 * απόκλισης (`npm run notifications:destination-drift`), από το SSoT του παραγωγού.
 */
async function addressOf(
  destination: PermalinkDestination,
  identity: SignedInPageIdentity,
): Promise<string> {
  if (!isInsideWorkspace(destination.path)) return destination.path;
  if (destination.workspace === null) {
    return workspaceDestinationFor(identity, destination.path);
  }
  return workspaceDestinationOf(ownerOfWorkspace(destination.workspace), destination.path);
}

/**
 * Γράφει το «ανοίχτηκε» — **με το κανάλι** (`email` · `inapp`).
 *
 * ⚠️ **Αποτυχία εδώ ΔΕΝ εμποδίζει την πλοήγηση.** Ο άνθρωπος ζήτησε να δει την
 * αγγελία, όχι να ενημερωθεί ένα πεδίο· μια πεσμένη εγγραφή καταγράφεται και
 * προχωράμε (N.7.2 #6 — η σημείωση είναι παρενέργεια, ο προορισμός είναι ο σκοπός).
 *
 * 🔑 **Ένας συγγραφέας και για τα δύο κανάλια**: το κουδούνι **δεν** καλεί πια το
 * `act` όταν περνά από εδώ — αλλιώς η ίδια ενέργεια θα γραφόταν δύο φορές, από δύο
 * διαδρομές που μια μέρα θα διαφωνούσαν.
 */
async function recordOpened(notificationId: string, channel: PermalinkChannel): Promise<void> {
  try {
    await getAdminFirestore()
      .collection(COLLECTIONS.NOTIFICATIONS)
      .doc(notificationId)
      .update({ ...seenFields(), actionTaken: 'view', actionTakenAt: nowISO(), openedVia: channel });
  } catch (error) {
    logger.warn('Η ειδοποίηση άνοιξε αλλά ΔΕΝ σημειώθηκε ως διαβασμένη', {
      data: { notificationId, channel, error: error instanceof Error ? error.message : String(error) },
    });
  }
}

/**
 * **Άνοιξε τον μόνιμο σύνδεσμο** για συνδεδεμένο άνθρωπο.
 *
 * Ο ανώνυμος **δεν φτάνει ποτέ εδώ**: η σελίδα τον στέλνει στη σύνδεση πρώτα,
 * χωρίς να ρωτήσει τη βάση — ώστε ούτε ο χρόνος απόκρισης να προδίδει αν η
 * ειδοποίηση υπάρχει.
 */
export async function openNotificationPermalink(
  notificationId: string,
  identity: SignedInPageIdentity,
  channel: PermalinkChannel = 'email',
): Promise<PermalinkVerdict> {
  if (!isNotificationId(notificationId)) return UNAVAILABLE;

  const snapshot = await getAdminFirestore()
    .collection(COLLECTIONS.NOTIFICATIONS)
    .doc(notificationId)
    .get();

  const destination = permalinkDestination(
    snapshot.exists ? snapshot.data() : undefined,
    identity.ctx.uid,
  );
  if (destination === null) {
    logger.info('Μόνιμος σύνδεσμος χωρίς διαθέσιμο προορισμό', {
      data: { notificationId, exists: snapshot.exists },
    });
    return UNAVAILABLE;
  }

  await recordOpened(notificationId, channel);
  return { kind: 'redirect', to: await addressOf(destination, identity) };
}
