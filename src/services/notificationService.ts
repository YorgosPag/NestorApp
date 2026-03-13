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
  setDoc,
  updateDoc,
  doc,
  Timestamp,
  type QueryConstraint,
  startAfter,
  type DocumentSnapshot,
  type DocumentData,
} from 'firebase/firestore';
import type { Notification, Severity } from '@/types/notification';
import { COLLECTIONS } from '@/config/firestore-collections';
import { generateNotificationId } from '@/services/enterprise-id.service';
import { fieldToISO } from '@/lib/date-local';
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
} as Notification);

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
 * Create a new notification in Firestore
 */
export async function createNotification(notification: Omit<Notification, 'id'>): Promise<string> {
  // 🏢 ADR-210: Enterprise ID generation — setDoc with pre-generated ID
  const id = generateNotificationId();
  await setDoc(doc(db, COLLECTION_NAME, id), {
    ...notification,
    id,
    createdAt: Timestamp.now()
  });

  return id;
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
  // 🏢 ENTERPRISE: Canonical pattern via firestoreQueryService.subscribe (ADR-227 Phase 2)
  // Auto tenant isolation + consistent subscription management
  return firestoreQueryService.subscribe<DocumentData>(
    'NOTIFICATIONS',
    (result) => {
      const notifications: Notification[] = result.documents.map(doc => ({
        id: doc.id,
        tenantId: (doc.tenantId as string) || 'default',
        userId: doc.userId as string,
        createdAt: fieldToISO(doc, 'createdAt') || doc.createdAt,
        severity: doc.severity as Severity,
        title: doc.title as string,
        body: doc.body as string,
        channel: (doc.channel as string) || 'inapp',
        delivery: (doc.delivery as Notification['delivery']) || { state: 'delivered', attempts: 1 },
        source: doc.source as Notification['source'],
        actions: doc.actions as Notification['actions'],
        meta: doc.meta as Notification['meta'],
        ...(doc.titleKey ? { titleKey: doc.titleKey as string, titleParams: doc.titleParams as Record<string, string> } : {}),
      } as Notification));

      onUpdate(notifications);
    },
    (error) => {
      if (onError) onError(error);
    },
    {
      constraints: [
        where('userId', '==', userId),
        orderBy('createdAt', 'desc'),
      ],
      maxResults: 50,
    }
  );
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
