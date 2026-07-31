import 'server-only';

import admin from 'firebase-admin';
import { safeFirestoreOperation, getAdminFirestore, FieldValue } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { sanitizeForFirestore } from '@/utils/firestore-sanitize';
import { generateSourcingEventId } from '@/services/enterprise-id.service';
import { createModuleLogger } from '@/lib/telemetry';
import { normalizeToDate } from '@/lib/date-local';
import type { AuthContext } from '@/lib/auth';
import {
  PROCUREMENT_RESOURCE,
  loadOwnedProcurementDoc,
  readOwnedProcurementDoc,
  requireOwnedSnapshot,
} from './procurement-owned-doc';
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

/** Ο πόρος αυτού του αρχείου — ένα σημείο, ώστε το όνομα να μη διαφωνήσει ποτέ. */
const subjectOf = (eventId: string) =>
  ({ resource: PROCUREMENT_RESOURCE.SOURCING_EVENT, resourceId: eventId }) as const;

/** Η αναφορά του γεγονότος — γράφεται μία φορά αντί για πέντε. */
const eventRef = (db: FirebaseFirestore.Firestore, eventId: string) =>
  db.collection(COLLECTIONS.SOURCING_EVENTS).doc(eventId);

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
  // Δ — σιωπηλή πολιτική (ADR-742 §3.3): ξένο ≡ ανύπαρκτο.
  return safeFirestoreOperation(
    async (db) =>
      readOwnedProcurementDoc<SourcingEvent>(
        eventRef(db, eventId),
        ctx.companyId,
        subjectOf(eventId),
      ),
    null,
  );
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
    const { ref, current } = await loadOwnedProcurementDoc<SourcingEvent>(
      eventRef(db, eventId),
      ctx.companyId,
      subjectOf(eventId),
    );

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

/**
 * Η **μία** ατομική μεταβολή του συνδέσμου RFQ ↔ γεγονότος.
 *
 * Σύνδεση και αποσύνδεση ήταν δύο δίδυμα σώματα με **τρεις** διαφορές (τι
 * ελέγχει η ιδεμποτεντικότητα, `arrayUnion`/`arrayRemove`, `+1`/`-1`). Ό,τι
 * ήταν ίδιο — ο φύλακας ιδιοκτησίας, ο επαναϋπολογισμός κατάστασης, το
 * `updatedAt` — έπρεπε να μείνει ίδιο **δομικά**: μια συναλλαγή που ξεχνά τον
 * επαναϋπολογισμό αφήνει το γεγονός σε κατάσταση που δεν αντιστοιχεί στα
 * παιδιά του, και τίποτα δεν το δείχνει.
 */
async function mutateRfqLink(
  ctx: AuthContext,
  eventId: string,
  rfqId: string,
  link: boolean,
): Promise<void> {
  const db = getAdminFirestore();
  const ref = eventRef(db, eventId);

  await db.runTransaction(async (tx) => {
    const event = requireOwnedSnapshot<SourcingEvent>(
      await tx.get(ref),
      ctx.companyId,
      subjectOf(eventId),
    );
    // Ιδεμποτεντικό: ήδη συνδεδεμένο / ήδη αποσυνδεδεμένο ⇒ καμία εγγραφή.
    if (event.rfqIds.includes(rfqId) === link) return;

    const newRfqCount = link ? event.rfqCount + 1 : Math.max(0, event.rfqCount - 1);
    tx.update(
      ref,
      sanitizeForFirestore({
        rfqIds: link ? FieldValue.arrayUnion(rfqId) : FieldValue.arrayRemove(rfqId),
        rfqCount: newRfqCount,
        status: deriveSourcingEventStatus(newRfqCount, event.closedRfqCount, event.status),
        updatedAt: admin.firestore.Timestamp.now(),
      }),
    );
  });
}

export async function addRfqToSourcingEvent(
  ctx: AuthContext,
  eventId: string,
  rfqId: string,
): Promise<void> {
  await mutateRfqLink(ctx, eventId, rfqId, true);
  logger.info('RFQ linked to SourcingEvent', { eventId, rfqId });
}

export async function removeRfqFromSourcingEvent(
  ctx: AuthContext,
  eventId: string,
  rfqId: string,
): Promise<void> {
  await mutateRfqLink(ctx, eventId, rfqId, false);
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
  const ref = eventRef(db, eventId);
  let derivedStatus: SourcingEventStatus = 'draft';

  await db.runTransaction(async (tx) => {
    const event = requireOwnedSnapshot<SourcingEvent>(
      await tx.get(ref),
      ctx.companyId,
      subjectOf(eventId),
    );

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
