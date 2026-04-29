import 'server-only';

import admin from 'firebase-admin';
import { safeFirestoreOperation, getAdminFirestore, FieldValue } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { sanitizeForFirestore } from '@/utils/firestore-sanitize';
import { generateSourcingEventId } from '@/services/enterprise-id.service';
import { createModuleLogger } from '@/lib/telemetry';
import { normalizeToDate } from '@/lib/date-local';
import type { AuthContext } from '@/lib/auth';
import type {
  SourcingEvent,
  SourcingEventStatus,
  SourcingEventFilters,
  CreateSourcingEventDTO,
  UpdateSourcingEventDTO,
} from '../types/sourcing-event';
import {
  SOURCING_EVENT_STATUS_TRANSITIONS,
  deriveSourcingEventStatus,
} from '../types/sourcing-event';

const logger = createModuleLogger('SOURCING_EVENT_SERVICE');

// ============================================================================
// CREATE
// ============================================================================

export async function createSourcingEvent(
  ctx: AuthContext,
  dto: CreateSourcingEventDTO,
): Promise<SourcingEvent> {
  return safeFirestoreOperation(async (db) => {
    const id = generateSourcingEventId();
    const now = admin.firestore.Timestamp.now();

    const event: SourcingEvent = {
      id,
      companyId: ctx.companyId,
      projectId: dto.projectId,
      buildingId: dto.buildingId ?? null,
      title: dto.title,
      description: dto.description ?? null,
      status: 'draft',
      rfqIds: [],
      rfqCount: 0,
      closedRfqCount: 0,
      deadlineDate: dto.deadlineDate
        ? admin.firestore.Timestamp.fromDate(normalizeToDate(dto.deadlineDate) ?? new Date())
        : null,
      createdAt: now,
      updatedAt: now,
      createdBy: ctx.uid,
    };

    await db
      .collection(COLLECTIONS.SOURCING_EVENTS)
      .doc(id)
      .set(sanitizeForFirestore(event));
    logger.info('SourcingEvent created', { id, companyId: ctx.companyId });
    return event;
  });
}

// ============================================================================
// READ
// ============================================================================

export async function getSourcingEvent(
  ctx: AuthContext,
  eventId: string,
): Promise<SourcingEvent | null> {
  return safeFirestoreOperation(async (db) => {
    const snap = await db.collection(COLLECTIONS.SOURCING_EVENTS).doc(eventId).get();
    if (!snap.exists) return null;
    const event = { id: snap.id, ...snap.data() } as SourcingEvent;
    if (event.companyId !== ctx.companyId) return null;
    return event;
  }, null);
}

export async function listSourcingEvents(
  ctx: AuthContext,
  filters: SourcingEventFilters = {},
): Promise<SourcingEvent[]> {
  return safeFirestoreOperation(async (db) => {
    let query = db
      .collection(COLLECTIONS.SOURCING_EVENTS)
      .where('companyId', '==', ctx.companyId) as FirebaseFirestore.Query;

    if (filters.status) {
      query = query.where('status', '==', filters.status);
    } else {
      query = query.where('status', '!=', 'archived');
    }
    if (filters.projectId) query = query.where('projectId', '==', filters.projectId);

    const snap = await query.orderBy('createdAt', 'desc').get();
    const events = snap.docs.map((d) => ({ id: d.id, ...d.data() } as SourcingEvent));

    if (filters.search) {
      const q = filters.search.toLowerCase();
      return events.filter((e) => e.title.toLowerCase().includes(q));
    }
    return events;
  }, []);
}

// ============================================================================
// UPDATE
// ============================================================================

export async function updateSourcingEvent(
  ctx: AuthContext,
  eventId: string,
  dto: UpdateSourcingEventDTO,
): Promise<SourcingEvent> {
  return safeFirestoreOperation(async (db) => {
    const ref = db.collection(COLLECTIONS.SOURCING_EVENTS).doc(eventId);
    const snap = await ref.get();
    if (!snap.exists) throw new Error(`SourcingEvent ${eventId} not found`);

    const current = { id: snap.id, ...snap.data() } as SourcingEvent;
    if (current.companyId !== ctx.companyId) throw new Error('Forbidden');

    if (dto.status && dto.status !== current.status) {
      const allowed = SOURCING_EVENT_STATUS_TRANSITIONS[current.status];
      if (!allowed.includes(dto.status)) {
        throw new Error(`Invalid transition: ${current.status} → ${dto.status}`);
      }
    }

    const updates: Partial<SourcingEvent> = {
      title: dto.title ?? current.title,
      description: dto.description !== undefined ? dto.description : current.description,
      status: (dto.status ?? current.status) as SourcingEventStatus,
      deadlineDate:
        dto.deadlineDate !== undefined
          ? dto.deadlineDate
            ? admin.firestore.Timestamp.fromDate(
                normalizeToDate(dto.deadlineDate) ?? new Date(),
              )
            : null
          : current.deadlineDate,
      updatedAt: admin.firestore.Timestamp.now(),
    };

    await ref.update(sanitizeForFirestore(updates));
    return { ...current, ...updates };
  });
}

// ============================================================================
// ARCHIVE
// ============================================================================

export async function archiveSourcingEvent(ctx: AuthContext, eventId: string): Promise<void> {
  await updateSourcingEvent(ctx, eventId, { status: 'archived' });
  logger.info('SourcingEvent archived', { eventId, uid: ctx.uid });
}

// ============================================================================
// RFQ LINKAGE — atomic transactions, idempotent
// ============================================================================

export async function addRfqToSourcingEvent(
  ctx: AuthContext,
  eventId: string,
  rfqId: string,
): Promise<void> {
  const db = getAdminFirestore();
  const ref = db.collection(COLLECTIONS.SOURCING_EVENTS).doc(eventId);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new Error(`SourcingEvent ${eventId} not found`);
    const event = { id: snap.id, ...snap.data() } as SourcingEvent;
    if (event.companyId !== ctx.companyId) throw new Error('Forbidden');
    if (event.rfqIds.includes(rfqId)) return;

    const newRfqCount = event.rfqCount + 1;
    const newStatus = deriveSourcingEventStatus(
      newRfqCount,
      event.closedRfqCount,
      event.status,
    );
    tx.update(
      ref,
      sanitizeForFirestore({
        rfqIds: FieldValue.arrayUnion(rfqId),
        rfqCount: newRfqCount,
        status: newStatus,
        updatedAt: admin.firestore.Timestamp.now(),
      }),
    );
  });

  logger.info('RFQ linked to SourcingEvent', { eventId, rfqId });
}

export async function removeRfqFromSourcingEvent(
  ctx: AuthContext,
  eventId: string,
  rfqId: string,
): Promise<void> {
  const db = getAdminFirestore();
  const ref = db.collection(COLLECTIONS.SOURCING_EVENTS).doc(eventId);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new Error(`SourcingEvent ${eventId} not found`);
    const event = { id: snap.id, ...snap.data() } as SourcingEvent;
    if (event.companyId !== ctx.companyId) throw new Error('Forbidden');
    if (!event.rfqIds.includes(rfqId)) return;

    const newRfqCount = Math.max(0, event.rfqCount - 1);
    const newStatus = deriveSourcingEventStatus(
      newRfqCount,
      event.closedRfqCount,
      event.status,
    );
    tx.update(
      ref,
      sanitizeForFirestore({
        rfqIds: FieldValue.arrayRemove(rfqId),
        rfqCount: newRfqCount,
        status: newStatus,
        updatedAt: admin.firestore.Timestamp.now(),
      }),
    );
  });

  logger.info('RFQ unlinked from SourcingEvent', { eventId, rfqId });
}

// ============================================================================
// STATUS RECOMPUTE — called by rfq-service when a child RFQ closes
// Atomically increments closedRfqCount and derives new status.
// ============================================================================

export async function recomputeSourcingEventStatus(
  ctx: AuthContext,
  eventId: string,
): Promise<SourcingEventStatus> {
  const db = getAdminFirestore();
  const ref = db.collection(COLLECTIONS.SOURCING_EVENTS).doc(eventId);
  let derivedStatus: SourcingEventStatus = 'draft';

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new Error(`SourcingEvent ${eventId} not found`);
    const event = { id: snap.id, ...snap.data() } as SourcingEvent;
    if (event.companyId !== ctx.companyId) throw new Error('Forbidden');

    const newClosedCount = event.closedRfqCount + 1;
    derivedStatus = deriveSourcingEventStatus(event.rfqCount, newClosedCount, event.status);

    tx.update(
      ref,
      sanitizeForFirestore({
        closedRfqCount: newClosedCount,
        status: derivedStatus,
        updatedAt: admin.firestore.Timestamp.now(),
      }),
    );
  });

  logger.info('SourcingEvent status recomputed', { eventId, newStatus: derivedStatus });
  return derivedStatus;
}
