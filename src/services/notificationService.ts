// services/notificationService.ts
// ✅ Firestore-based Notification Service

import { db } from '@/lib/firebase';
import {
  collection,
  query,
  where,
  orderBy,
  limit as firestoreLimit,
  getDocs,
  addDoc,
  updateDoc,
  doc,
  onSnapshot,
  Timestamp,
  QueryConstraint,
  startAfter,
  DocumentSnapshot
} from 'firebase/firestore';
import type { Notification, Severity } from '@/types/notification';
import { COLLECTIONS } from '@/config/firestore-collections';

const COLLECTION_NAME = COLLECTIONS.NOTIFICATIONS;

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
 */
export async function fetchNotifications(params: NotificationQuery): Promise<NotificationListResult> {
  const { userId, limit = 50, unseenOnly = false, cursor } = params;

  const constraints: QueryConstraint[] = [
    where('userId', '==', userId),
    orderBy('createdAt', 'desc'),
    firestoreLimit(limit)
  ];

  if (unseenOnly) {
    constraints.push(where('delivery.state', '!=', 'seen'));
  }

  if (cursor) {
    constraints.push(startAfter(cursor));
  }

  const q = query(collection(db, COLLECTION_NAME), ...constraints);
  const snapshot = await getDocs(q);

  const items: Notification[] = snapshot.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      tenantId: data.tenantId || 'default',
      userId: data.userId,
      createdAt: data.createdAt instanceof Timestamp
        ? data.createdAt.toDate().toISOString()
        : data.createdAt,
      severity: data.severity as Severity,
      title: data.title,
      body: data.body,
      channel: data.channel || 'inapp',
      delivery: data.delivery || { state: 'delivered', attempts: 1 },
      source: data.source,
      actions: data.actions,
      meta: data.meta
    } as Notification;
  });

  const lastDoc = snapshot.docs[snapshot.docs.length - 1];

  return {
    items,
    cursor: lastDoc
  };
}

/**
 * Create a new notification in Firestore
 */
export async function createNotification(notification: Omit<Notification, 'id'>): Promise<string> {
  const docRef = await addDoc(collection(db, COLLECTION_NAME), {
    ...notification,
    createdAt: Timestamp.now()
  });

  return docRef.id;
}

/**
 * Mark notifications as read
 */
export async function markNotificationsAsRead(notificationIds: string[]): Promise<void> {
  const updatePromises = notificationIds.map(id =>
    updateDoc(doc(db, COLLECTION_NAME, id), {
      'delivery.state': 'seen',
      seenAt: Timestamp.now()
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
    dismissedAt: Timestamp.now()
  });
}

/**
 * Record notification action
 */
export async function recordNotificationAction(
  notificationId: string,
  actionId: string
): Promise<void> {
  await updateDoc(doc(db, COLLECTION_NAME, notificationId), {
    'delivery.state': 'acted',
    actedAt: Timestamp.now(),
    actionId
  });
}

/**
 * Subscribe to real-time notification updates
 */
export function subscribeToNotifications(
  userId: string,
  onUpdate: (notifications: Notification[]) => void,
  onError?: (error: Error) => void
): () => void {
  const q = query(
    collection(db, COLLECTION_NAME),
    where('userId', '==', userId),
    orderBy('createdAt', 'desc'),
    firestoreLimit(50)
  );

  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      const notifications: Notification[] = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          tenantId: data.tenantId || 'default',
          userId: data.userId,
          createdAt: data.createdAt instanceof Timestamp
            ? data.createdAt.toDate().toISOString()
            : data.createdAt,
          severity: data.severity as Severity,
          title: data.title,
          body: data.body,
          channel: data.channel || 'inapp',
          delivery: data.delivery || { state: 'delivered', attempts: 1 },
          source: data.source,
          actions: data.actions,
          meta: data.meta
        } as Notification;
      });

      onUpdate(notifications);
    },
    (error) => {
      // Error logging removed
      if (onError) onError(error);
    }
  );

  return unsubscribe;
}

/**
 * Helper: Create sample notifications for testing
 */
export async function createSampleNotifications(userId: string): Promise<void> {
  const sampleNotifications: Omit<Notification, 'id' | 'createdAt'>[] = [
    {
      tenantId: 'default',
      userId,
      severity: 'info',
      title: 'Welcome to Enterprise Notifications',
      body: 'This is a real notification from Firestore!',
      channel: 'inapp',
      delivery: { state: 'delivered', attempts: 1 },
      source: { service: 'firestore', env: 'dev' },
      actions: [
        { id: 'view-details', label: 'View Details', url: 'https://example.com/details' },
        { id: 'dismiss', label: 'Dismiss', destructive: false }
      ],
      meta: {
        correlationId: 'corr-' + Date.now(),
        traceId: 'trace-' + Date.now()
      }
    },
    {
      tenantId: 'default',
      userId,
      severity: 'success',
      title: 'System Deployed Successfully',
      body: 'Version 2.0 has been deployed to production',
      channel: 'inapp',
      delivery: { state: 'delivered', attempts: 1 },
      source: { service: 'deployment', env: 'prod' },
      actions: [
        { id: 'open-dashboard', label: 'Open DXF Viewer', url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dxf/viewer` }
      ]
    },
    {
      tenantId: 'default',
      userId,
      severity: 'warning',
      title: 'High Memory Usage',
      body: 'Server memory usage is above 80%',
      channel: 'inapp',
      delivery: { state: 'delivered', attempts: 1 },
      source: { service: 'monitoring', env: 'prod' },
      actions: [
        { id: 'view-metrics', label: 'View Metrics', url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dxf/viewer` },
        { id: 'restart-service', label: 'Restart Service', destructive: true }
      ]
    }
  ];

  for (const notification of sampleNotifications) {
    await createNotification(notification as Omit<Notification, 'id'>);
  }
}
