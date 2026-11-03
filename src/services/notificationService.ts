// services/notificationService.ts
// ✅ Firestore-based Notification Service
// 🔄 ADR-214 Phase 5: fetchNotifications migrated to firestoreQueryService (auto userId filter)

import { db, auth } from '@/lib/firebase';
import {
  collection,
  query,
  where,
  orderBy,
  limit as firestoreLimit,
  getDocs,
  updateDoc,
  doc,
  deleteField,
  documentId,
  Timestamp,
  type QueryConstraint,
  startAfter,
  type DocumentSnapshot,
  type DocumentData,
} from 'firebase/firestore';
import type { Notification, Severity } from '@/types/notification';
import { COLLECTIONS } from '@/config/firestore-collections';
import { fieldToISO, normalizeToMillisOrNull } from '@/lib/date-local';
import { nowTimestamp } from '@/lib/firestore-now';
import { firestoreQueryService } from '@/services/firestore';

const COLLECTION_NAME = COLLECTIONS.NOTIFICATIONS;

// --- ADR-214 Phase 5: Transform helper ---

/** Transform raw DocumentData to Notification */
const toNotification = (raw: DocumentData & { id: string }): Notification => ({
  id: raw.id,
  tenantId: (raw.tenantId as string) || 'default',
  userId: raw.userId as string,
  createdAt: fieldToISO(raw as Record<string, unknown>, 'createdAt') || raw.createdAt,
  severity: raw.severity as Severity,
  title: raw.title as string,
  body: raw.body as string,
  channel: (raw.channel as string) || 'inapp',
  delivery: (raw.delivery as Notification['delivery']) || { state: 'delivered', attempts: 1 },
  source: raw.source as Notification['source'],
  actions: raw.actions as Notification['actions'],
  meta: raw.meta as Notification['meta'],
  ...(raw.titleKey ? { titleKey: raw.titleKey as string, titleParams: raw.titleParams as Record<string, string> } : {}),
  ...(raw.bodyKey ? { bodyKey: raw.bodyKey as string, bodyParams: raw.bodyParams as Record<string, string> } : {}),
} as Notification);
// ⚠️ Το `as Notification` μένει: τα πεδία έρχονται από Firestore ως `unknown` και το σχήμα τα επικυρώνει
//    μόνο στον δρόμο REST. Ο ζωντανός δρόμος εμπιστεύεται τους κανόνες (create = μόνο ο διακομιστής).

export interface NotificationQuery {
  userId: string;
  limit?: number;
  unseenOnly?: boolean;
  cursor?: DocumentSnapshot;
}

export interface NotificationListResult {
  items: Notification[];
  cursor?: DocumentSnapshot;
}

/**
 * Fetch notifications from Firestore
 *
 * ADR-214 Phase 5: Uses firestoreQueryService when client auth is available
 * (auto userId filter via NOTIFICATIONS tenant config, mode: 'userId').
 * Falls back to direct query for server contexts (API routes) where auth.currentUser is null.
 */
export async function fetchNotifications(params: NotificationQuery): Promise<NotificationListResult> {
  const { userId, limit = 50, unseenOnly = false, cursor } = params;

  const constraints: QueryConstraint[] = [orderBy('createdAt', 'desc')];
  if (unseenOnly) constraints.push(where('delivery.state', '!=', 'seen'));
  if (cursor) constraints.push(startAfter(cursor));

  // ADR-214 Phase 5: firestoreQueryService path (auto userId filter via tenant config)
  if (auth.currentUser) {
    const result = await firestoreQueryService.getAll<DocumentData & { id: string }>('NOTIFICATIONS', {
      constraints,
      maxResults: limit,
    });

    const items = result.documents.map(toNotification);
    return { items, cursor: result.lastDocument ?? undefined };
  }

  // Server context fallback: explicit userId filter (API routes where auth.currentUser is null)
  const serverConstraints: QueryConstraint[] = [
    where('userId', '==', userId),
    ...constraints,
    firestoreLimit(limit),
  ];

  const q = query(collection(db, COLLECTION_NAME), ...serverConstraints);
  const snapshot = await getDocs(q);

  const items: Notification[] = snapshot.docs.map(d => {
    const data = d.data();
    return toNotification({ id: d.id, ...data });
  });

  const lastDoc = snapshot.docs[snapshot.docs.length - 1];
  return { items, cursor: lastDoc };
}

/**
 * Mark notifications as read
 */
export async function markNotificationsAsRead(notificationIds: string[]): Promise<void> {
  const updatePromises = notificationIds.map(id =>
    updateDoc(doc(db, COLLECTION_NAME, id), {
      'delivery.state': 'seen',
      seenAt: nowTimestamp()
    })
  );

  await Promise.all(updatePromises);
}

/**
 * Dismiss a notification (hide from panel without deleting from Firestore)
 * The email/business record remains intact — only the notification is dismissed
 */
export async function dismissNotification(notificationId: string): Promise<void> {
  await updateDoc(doc(db, COLLECTION_NAME, notificationId), {
    'delivery.state': 'dismissed',
    dismissedAt: nowTimestamp()
  });
}

/**
 * Καταστάσεις στις οποίες ο **άνθρωπος** μπορεί να επαναφέρει μια ειδοποίηση: «μη αναγνωσμένη» (`delivered`)
 * και η αναίρεση μιας απόρριψης (πίσω στην κατάσταση που είχε). Το `withdrawn` το γράφει **μόνο** η πηγή.
 */
export type RestorableDeliveryState = Extract<Notification['delivery']['state'], 'delivered' | 'seen' | 'acted'>;

/**
 * Γράφει ρητά την κατάσταση παράδοσης — «σήμανση ως μη αναγνωσμένη» και «αναίρεση απόρριψης».
 * Σβήνει το `dismissedAt`, ώστε το ίχνος να μη λέει «απορρίφθηκε» για ειδοποίηση που φαίνεται.
 */
export async function setNotificationDeliveryState(
  notificationId: string,
  state: RestorableDeliveryState,
): Promise<void> {
  await updateDoc(doc(db, COLLECTION_NAME, notificationId), {
    'delivery.state': state,
    dismissedAt: deleteField(),
  });
}

/** Το μέγεθος του ζωντανού παραθύρου **και** κάθε παλαιότερης σελίδας — ένας αριθμός, όχι δύο. */
export const NOTIFICATION_PAGE_SIZE = 50;

/** Ο δρομέας σελιδοποίησης: η παλαιότερη ειδοποίηση που ήδη έχει ο πελάτης. */
export interface NotificationPageAnchor {
  readonly createdAt: string;
  readonly id: string;
}

/**
 * **Η επόμενη παλαιότερη σελίδα** — δρομέας-τιμή `(createdAt, id)`, όχι στιγμιότυπο εγγράφου.
 *
 * 🔑 Το `id` είναι ο ισοπαλαιστής: δύο ειδοποιήσεις στο ίδιο χιλιοστό (ίδιο γεγονός σε δύο
 * παραλήπτες, ή μαζική αποστολή) με σκέτο `startAfter(createdAt)` θα έχαναν τη μία. Ο δείκτης
 * `userId ↑ · createdAt ↓` καλύπτει το `__name__ ↓` εμμέσως (ο Firestore τον προσθέτει σε κάθε δείκτη).
 * Το φίλτρο `userId` το βάζει η υπηρεσία ερωτημάτων (λειτουργία `userId`, ADR-214).
 */
export async function fetchNotificationsBefore(anchor: NotificationPageAnchor): Promise<Notification[]> {
  // Άκυρη ημερομηνία στον δρομέα ⇒ καμία σελίδα, όχι ερώτημα από την αρχή της συλλογής.
  const anchorMs = normalizeToMillisOrNull(anchor.createdAt);
  if (anchorMs === null) return [];
  const result = await firestoreQueryService.getAll<DocumentData & { id: string }>('NOTIFICATIONS', {
    constraints: [
      orderBy('createdAt', 'desc'),
      orderBy(documentId(), 'desc'),
      startAfter(Timestamp.fromMillis(anchorMs), anchor.id),
    ],
    maxResults: NOTIFICATION_PAGE_SIZE,
  });
  return result.documents.map(toNotification);
}

/**
 * Subscribe to real-time notification updates — το ζωντανό παράθυρο των πιο πρόσφατων.
 *
 * ⚠️ Η μετατροπή είναι η **ΜΙΑ** `toNotification`. Εδώ ζούσε δεύτερο, χειρόγραφο αντίγραφό της που
 * είχε ξεχάσει τα `bodyKey`/`bodyParams` (ADR-892 §13): κάθε ειδοποίηση που έφτανε ζωντανά έχανε το
 * μεταφρασμένο σώμα της και έδειχνε το παγωμένο κείμενο του παραγωγού.
 */
export function subscribeToNotifications(
  userId: string,
  onUpdate: (notifications: Notification[]) => void,
  onError?: (error: Error) => void
): () => void {
  // 🏢 ENTERPRISE: Canonical pattern via firestoreQueryService.subscribe (ADR-227 Phase 2)
  // Auto tenant isolation + consistent subscription management
  return firestoreQueryService.subscribe<DocumentData & { id: string }>(
    'NOTIFICATIONS',
    (result) => onUpdate(result.documents.map(toNotification)),
    (error) => {
      if (onError) onError(error);
    },
    {
      constraints: [
        where('userId', '==', userId),
        orderBy('createdAt', 'desc'),
      ],
      maxResults: NOTIFICATION_PAGE_SIZE,
    }
  );
}

