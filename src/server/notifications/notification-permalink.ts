/**
 * =============================================================================
 * Ο ΜΟΝΙΜΟΣ ΣΥΝΔΕΣΜΟΣ ΤΗΣ ΕΙΔΟΠΟΙΗΣΗΣ — «πού πάει αυτό το κλικ;» (ADR-848)
 * =============================================================================
 *
 * Ο σύνδεσμος μέσα στο email είναι `/n/{id}`, όχι ο προορισμός. Εδώ λύνεται,
 * **τη στιγμή του κλικ**, για τον άνθρωπο που τον πάτησε.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΤΡΙΑ ΠΡΑΓΜΑΤΑ ΠΟΥ ΚΑΝΕΙ ΚΑΛΥΤΕΡΑ ΑΠΟ ΤΟΝ ΣΚΕΤΟ ΣΥΝΔΕΣΜΟ
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
 *
 * @module server/notifications/notification-permalink
 * @see lib/notifications/notification-permalink-route — πώς χτίζεται ο σύνδεσμος
 * @see app/(auth)/n/[notificationId]/page — η σελίδα
 */

import 'server-only';

import { COLLECTIONS } from '@/config/firestore-collections';
import { nowISO } from '@/lib/date-local';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { safeReturnPath } from '@/lib/routes/return-path';
import { createModuleLogger } from '@/lib/telemetry';
import {
  workspaceDestinationFor,
  type SignedInPageIdentity,
} from '@/lib/workspace/workspace-destination';
import { isInsideWorkspace } from '@/lib/workspace/workspace-scope';

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

/** Το `url` της πρώτης ενέργειας — ό,τι κι αν έγραψε κάποτε η βάση. */
function firstActionUrl(actions: unknown): unknown {
  if (!Array.isArray(actions)) return undefined;
  const first: unknown = actions[0];
  if (typeof first !== 'object' || first === null) return undefined;
  return Reflect.get(first, 'url');
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
): string | null {
  if (!data || data.userId !== uid) return null;
  return safeReturnPath(firstActionUrl(data.actions));
}

/**
 * Γράφει το «ανοίχτηκε από email».
 *
 * ⚠️ **Αποτυχία εδώ ΔΕΝ εμποδίζει την πλοήγηση.** Ο άνθρωπος ζήτησε να δει την
 * αγγελία, όχι να ενημερωθεί ένα πεδίο· μια πεσμένη εγγραφή καταγράφεται και
 * προχωράμε (N.7.2 #6 — η σημείωση είναι παρενέργεια, ο προορισμός είναι ο σκοπός).
 */
async function recordOpenedFromEmail(notificationId: string): Promise<void> {
  try {
    await getAdminFirestore()
      .collection(COLLECTIONS.NOTIFICATIONS)
      .doc(notificationId)
      .update({ ...seenFields(), actionTaken: 'view', actionTakenAt: nowISO(), openedVia: 'email' });
  } catch (error) {
    logger.warn('Η ειδοποίηση άνοιξε από email αλλά ΔΕΝ σημειώθηκε ως διαβασμένη', {
      data: { notificationId, error: error instanceof Error ? error.message : String(error) },
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

  await recordOpenedFromEmail(notificationId);

  const to = isInsideWorkspace(destination)
    ? await workspaceDestinationFor(identity, destination)
    : destination;
  return { kind: 'redirect', to };
}
