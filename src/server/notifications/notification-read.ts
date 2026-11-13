/**
 * =============================================================================
 * ΤΟ «ΔΙΑΒΑΣΤΗΚΕ» ΜΙΑΣ ΕΙΔΟΠΟΙΗΣΗΣ — ΕΝΑΣ ΣΥΓΓΡΑΦΕΑΣ (ADR-848)
 * =============================================================================
 *
 * Δύο πόρτες σημειώνουν μια ειδοποίηση ως διαβασμένη: το **κουδούνι** της
 * εφαρμογής (`POST /api/notifications/ack`) και ο **σύνδεσμος του email**
 * (`/n/{id}`). Αν η καθεμιά έγραφε τα δικά της πεδία, η πρώτη αλλαγή σχήματος θα
 * έφτανε στη μία — και μια ειδοποίηση ανοιγμένη από το email θα φαινόταν
 * **αδιάβαστη** στο κουδούνι, για πάντα, χωρίς τίποτα να κοκκινίσει.
 *
 * 🔴 **Και ακριβώς αυτό συνέβαινε ως 2026-11-13 (ADR-939 §6.1 6Γ)**: ο ένας συγγραφέας υπήρχε, αλλά έγραφε
 * `seen: true` ενώ το κουδούνι (πελάτης) έγραφε και διάβαζε `delivery.state`. Το σχήμα είναι πλέον **ένα**,
 * ορισμένο στο `lib/notifications/notification-state.ts`, κοινό για πελάτη και διακομιστή.
 *
 * ⚠️ **Ανάγνωση ΑΝΑ ΚΛΕΙΔΙ, όχι ερώτημα.** Η πρώτη εκδοχή (στο route) έκανε
 * `where('__name__', 'in', ids.slice(0, 10))`: ερώτημα χωρίς φίλτρο ιδιοκτήτη που
 * **πετούσε σιωπηλά** κάθε ταυτότητα μετά τη δέκατη (όριο του `in`). Το `getAll`
 * διαβάζει έγγραφα **με το όνομά τους** — καμία σιωπηλή περικοπή, καμία ανάγκη για
 * ευρετήριο, και η ιδιοκτησία κρίνεται **ανά έγγραφο**.
 *
 * @module server/notifications/notification-read
 * @see app/api/notifications/ack/route — το κουδούνι
 * @see server/notifications/notification-permalink — το email
 */

import 'server-only';

import { FieldValue } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { SEEN_DELIVERY_STATE, canMarkSeen } from '@/lib/notifications/notification-state';
import { DeliveryState as DeliveryStateSchema } from '@/schemas/notification';
import type { DeliveryState } from '@/types/notification';

/**
 * Πάνω από αυτό δεν είναι «σημείωσε ό,τι είδα», είναι φορτίο. Το κουδούνι στέλνει
 * όσες ειδοποιήσεις έχει στη λίστα του — δεκάδες, όχι χιλιάδες.
 */
export const MAX_IDS_PER_MARK = 50;

/** Τα πεδία του «διαβάστηκε» — το **ίδιο** σχήμα με τον πελάτη (`notification-state.ts` › `SEEN_DELIVERY_STATE`). */
export interface SeenUpdate {
  readonly 'delivery.state': typeof SEEN_DELIVERY_STATE;
  readonly seenAt: FieldValue;
}

/** Η κατάσταση παράδοσης όπως είναι γραμμένη· έγγραφο χωρίς `delivery` διαβάζεται `delivered` (όπως στο `toNotification`). */
function storedDeliveryState(raw: unknown): DeliveryState {
  if (typeof raw !== 'object' || raw === null) return 'delivered';
  const delivery: unknown = Reflect.get(raw, 'delivery');
  if (typeof delivery !== 'object' || delivery === null) return 'delivered';
  const parsed = DeliveryStateSchema.safeParse(Reflect.get(delivery, 'state'));
  return parsed.success ? parsed.data : 'delivered';
}

/**
 * **Τα πεδία του «διαβάστηκε» για ΑΥΤΟ το έγγραφο — ή `null` αν δεν επιτρέπεται η μετάβαση** (`canMarkSeen`):
 * ένα άνοιγμα δεν υποβαθμίζει ποτέ το `acted` ούτε αναβιώνει `dismissed`/`withdrawn`. Ώρα **διακομιστή**.
 */
export function seenUpdateFor(raw: unknown): SeenUpdate | null {
  if (!canMarkSeen(storedDeliveryState(raw))) return null;
  return { 'delivery.state': SEEN_DELIVERY_STATE, seenAt: FieldValue.serverTimestamp() };
}

/**
 * Καταστάσεις του `delivery.state` που σημαίνουν «ο άνθρωπος δεν χρειάζεται πια υπενθύμιση»: την είδε, έκανε
 * την ενέργεια, την έκλεισε, ή την απέσυρε η πηγή.
 */
const SETTLED_STATE_LIST: readonly DeliveryState[] = ['seen', 'acted', 'dismissed', 'withdrawn'];
const SETTLED_DELIVERY_STATES: ReadonlySet<string> = new Set<string>(SETTLED_STATE_LIST);

/**
 * **Την είδε ο άνθρωπος;** — ο αναγνώστης της πύλης αποστολής email (ADR-939 §6.1 6Β).
 *
 * Από 2026-11-13 (6Γ) **ένα** σχήμα γράφεται: `delivery.state` ({@link seenUpdateFor} · πελάτης). Το `seen: true`
 * το έγραφε ο διακομιστής ως τότε· μένει αποδεκτό **μόνο για τα παλιά έγγραφα** — δίχτυ, όχι δεύτερο σχήμα.
 * Ανεκτικό: ό,τι δεν είναι αντικείμενο ⇒ `false` (δεν διαβάστηκε — ποτέ μαντεψιά υπέρ της σιωπής).
 */
export function notificationWasSeen(raw: unknown): boolean {
  if (typeof raw !== 'object' || raw === null) return false;
  if (Reflect.get(raw, 'seen') === true) return true;
  const delivery: unknown = Reflect.get(raw, 'delivery');
  if (typeof delivery !== 'object' || delivery === null) return false;
  const state: unknown = Reflect.get(delivery, 'state');
  return typeof state === 'string' && SETTLED_DELIVERY_STATES.has(state);
}

/** Τι απέγινε κάθε ταυτότητα. Ονομασμένο, ποτέ πλήθος μόνο. */
export interface SeenOutcome {
  readonly marked: readonly string[];
  /** Υπάρχουν, αλλά ανήκουν σε **άλλον** — δεν αγγίζονται ποτέ. */
  readonly refused: readonly string[];
}

/**
 * **Σημείωσε ως διαβασμένες όσες από αυτές ανήκουν στον `uid`.**
 *
 * Ανύπαρκτες ταυτότητες αγνοούνται σιωπηλά (το κουδούνι μπορεί να κρατά ειδοποίηση
 * που σβήστηκε)· **ξένες** επιστρέφονται ονομαστικά, ώστε ο καλών να τις καταγράψει.
 */
export async function markNotificationsSeen(
  uid: string,
  ids: readonly string[],
): Promise<SeenOutcome> {
  const unique = [...new Set(ids)].filter((id) => id.length > 0).slice(0, MAX_IDS_PER_MARK);
  if (unique.length === 0) return { marked: [], refused: [] };

  const db = getAdminFirestore();
  const collection = db.collection(COLLECTIONS.NOTIFICATIONS);

  // 🔑 Ανάγνωση και εγγραφή στην ΙΔΙΑ συναλλαγή: μια παράλληλη «απόρριψη» ή «ενέργεια» δεν μπορεί να χαθεί κάτω
  //    από ένα «διαβάστηκε» που κρίθηκε πάνω σε μπαγιάτικη κατάσταση. ≤ MAX_IDS_PER_MARK έγγραφα ⇒ μέσα στα όρια.
  return db.runTransaction(async (transaction) => {
    const snapshots = await transaction.getAll(...unique.map((id) => collection.doc(id)));
    const marked: string[] = [];
    const refused: string[] = [];
    for (const snapshot of snapshots) {
      if (!snapshot.exists) continue;
      const data = snapshot.data();
      if (data?.userId !== uid) {
        refused.push(snapshot.id);
        continue;
      }
      // Ιδεμποτικό: ήδη διαβασμένη / με ενέργεια / κρυφή ⇒ καμία εγγραφή, αλλά μετρά ως δική σου.
      const update = seenUpdateFor(data);
      if (update !== null) transaction.update(snapshot.ref, { ...update });
      marked.push(snapshot.id);
    }
    return { marked, refused };
  });
}
