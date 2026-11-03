/**
 * @fileoverview **Η ΜΙΑ ΡΟΗ ΕΙΔΟΠΟΙΗΣΕΩΝ ΑΝΑ ΧΡΗΣΤΗ** — ο μόνος γραφέας του `notificationCenter` από τη βάση.
 * @related ADR-927 · stores/notificationCenter.ts · hooks/useFirestoreNotifications.ts · services/notificationService.ts
 * @module stores/notification-feed
 *
 * 🔴 **ΤΟ ΕΛΑΤΤΩΜΑ (μετρημένο 2026-11-03)**: δύο ακροατές για τα ίδια έγγραφα — το κουδούνι γέμιζε το store,
 *    η σελίδα `/crm/notifications` κρατούσε δική της μνήμη. Δύο αναγνώσεις, δύο αλήθειες, δύο αριθμοί.
 *
 * 🔑 **Η ΛΥΣΗ — μέτρηση αναφορών** (όπως το `onSnapshot` του ίδιου του Firestore μοιράζει έναν ακροατή
 *    στόχου ανάμεσα σε πολλά queries): όποιος θέλει ειδοποιήσεις **δανείζεται** τη ροή (`acquire`) και την
 *    **επιστρέφει** (`release`). Ο πρώτος δανειζόμενος την ανοίγει, ο τελευταίος την κλείνει και **αδειάζει**
 *    τη μνήμη (κανένα ίχνος του προηγούμενου χρήστη μετά από αποσύνδεση). Αλλαγή χρήστη ⇒ κλείσιμο + άδειασμα
 *    **πριν** ανοίξει η νέα: η μνήμη δεν ανακατεύει ποτέ δύο ανθρώπους.
 *
 * Ιδεμποτικό: το `release` που καλείται δύο φορές μετρά μία (React Strict Mode τρέχει το effect δύο φορές).
 */

import { isMissingTenantError } from '@/services/firestore/auth-context';
import {
  NOTIFICATION_PAGE_SIZE,
  fetchNotificationsBefore,
  subscribeToNotifications,
} from '@/services/notificationService';
import { useNotificationCenter } from '@/stores/notificationCenter';
import type { Notification } from '@/types/notification';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('notification-feed');

interface ActiveFeed {
  readonly uid: string;
  refs: number;
  unsubscribe: () => void;
  /** Έχει φορτωθεί έστω μία παλαιότερη σελίδα; — τότε το `hasMore` το αποφασίζει εκείνη, όχι το παράθυρο. */
  paged: boolean;
  /**
   * Η γενιά της **σύνδεσης**. Το «Δοκιμή ξανά» αλλάζει σύνδεση, **όχι** ροή: οι δανειζόμενοι κρατούν το ίδιο
   * αντικείμενο (αλλιώς η επιστροφή τους δεν θα έβρισκε τίποτα να κλείσει — ο ακροατής θα έμενε ανοιχτός για
   * πάντα· το έπιασε το test). Καθυστερημένες απαντήσεις παλιάς γενιάς πετιούνται.
   */
  generation: number;
}

let feed: ActiveFeed | null = null;

const store = () => useNotificationCenter.getState();

const isCurrent = (active: ActiveFeed, generation: number): boolean =>
  feed === active && active.generation === generation;

function applyWindow(active: ActiveFeed, notifications: Notification[]): void {
  const s = store();
  s.ingest(notifications);
  s.setError(undefined);
  s.setStatus('ready');
  if (!active.paged) s.setPaging({ hasMore: notifications.length >= NOTIFICATION_PAGE_SIZE });
}

function onFeedError(error: Error): void {
  // 🔴 «ΔΕΝ ΕΧΕΙΣ ΕΤΑΙΡΕΙΑ» ΔΕΝ ΕΙΝΑΙ ΒΛΑΒΗ (ADR-807 · ADR-813 Φάση Β): ο αυτόνομος επαγγελματίας νόμιμα δεν
  //    ανήκει σε οργανισμό. Έλεγχος με το brand (`isMissingTenantError`), ποτέ με σύγκριση κειμένου.
  if (isMissingTenantError(error)) {
    store().setStatus('ready');
    return;
  }
  logger.error('Firestore listener error', { error });
  store().setError(error.message);
  store().setStatus('error');
}

/** Νέα σύνδεση για την ίδια ροή — νέα γενιά. */
function connect(active: ActiveFeed): void {
  const generation = ++active.generation;
  if (store().order.length === 0) store().setStatus('loading');
  active.unsubscribe = subscribeToNotifications(
    active.uid,
    (ns) => { if (isCurrent(active, generation)) applyWindow(active, ns); },
    (err) => { if (isCurrent(active, generation)) onFeedError(err); },
  );
}

function open(uid: string): ActiveFeed {
  const active: ActiveFeed = { uid, refs: 0, unsubscribe: () => undefined, paged: false, generation: 0 };
  feed = active;
  connect(active);
  return active;
}

function close(): void {
  if (!feed) return;
  feed.unsubscribe();
  feed = null;
  store().reset();
}

/**
 * Δανείζεται τη ροή του `uid`. Επιστρέφει τη συνάρτηση επιστροφής (ιδεμποτική).
 */
export function acquireNotificationFeed(uid: string): () => void {
  if (feed && feed.uid !== uid) close();
  const active = feed ?? open(uid);
  active.refs += 1;

  let released = false;
  return () => {
    if (released) return;
    released = true;
    if (feed !== active) return;
    active.refs -= 1;
    if (active.refs === 0) close();
  };
}

/**
 * Ξανανοίγει την τρέχουσα ροή — το «Δοκιμή ξανά» μετά από σφάλμα. Κρατά τους δανειζόμενους.
 */
export function restartNotificationFeed(): void {
  if (!feed) return;
  feed.unsubscribe();
  store().setError(undefined);
  connect(feed);
}

/**
 * Φέρνει την **επόμενη παλαιότερη** σελίδα, από την παλαιότερη ειδοποίηση που έχει ήδη ο πελάτης.
 * Ένα αίτημα τη φορά· αποτέλεσμα κλεισμένης ροής (αλλαγή χρήστη στο μεταξύ) **πετιέται**.
 */
export async function loadOlderNotifications(): Promise<void> {
  const active = feed;
  const s = store();
  if (!active || s.loadingOlder || !s.hasMore) return;
  const oldestId = s.order[s.order.length - 1];
  const oldest = oldestId ? s.items.get(oldestId) : undefined;
  if (!oldest) return;

  s.setPaging({ loadingOlder: true });
  try {
    const older = await fetchNotificationsBefore({ createdAt: oldest.createdAt, id: oldest.id });
    if (feed !== active) return;
    active.paged = true;
    store().ingest(older);
    store().setPaging({ hasMore: older.length >= NOTIFICATION_PAGE_SIZE });
  } catch (error) {
    logger.error('Load older notifications failed', { error });
    throw error;
  } finally {
    if (feed === active) store().setPaging({ loadingOlder: false });
  }
}

/** Μόνο για tests: επαναφορά της κατάστασης του module. */
export function __resetNotificationFeedForTests(): void {
  feed?.unsubscribe();
  feed = null;
}
