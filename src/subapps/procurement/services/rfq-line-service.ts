import 'server-only';

import admin from 'firebase-admin';
import { safeFirestoreOperation, getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { sanitizeForFirestore } from '@/utils/firestore-sanitize';
import { generateRfqLineId } from '@/services/enterprise-id.service';
import { EntityAuditService } from '@/services/entity-audit.service';
import { createModuleLogger } from '@/lib/telemetry';
import type { AuthContext } from '@/lib/auth';
import type { BOQItem } from '@/types/boq/boq';
import { getTradeCodeForAtoeCategory } from '../data/trades';
import type { TradeCode } from '../types/trade';
import type {
  RfqLine,
  CreateRfqLineDTO,
  UpdateRfqLineDTO,
  PublicRfqLine,
} from '../types/rfq-line';
import { toPublicRfqLine } from '../types/rfq-line';

const logger = createModuleLogger('RFQ_LINE_SERVICE');

const BOQ_IN_LIMIT = 30;

// ============================================================================
// HELPERS
// ============================================================================

function linesRef(
  db: FirebaseFirestore.Firestore,
  rfqId: string,
): FirebaseFirestore.CollectionReference {
  return db.collection(COLLECTIONS.RFQS).doc(rfqId).collection('lines');
}

async function assertRfqOwnership(
  db: FirebaseFirestore.Firestore,
  rfqId: string,
  companyId: string,
): Promise<void> {
  const snap = await db.collection(COLLECTIONS.RFQS).doc(rfqId).get();
  if (!snap.exists) throw new Error(`RFQ ${rfqId} not found`);
  const rfqCompanyId = (snap.data() as { companyId: string }).companyId;
  if (rfqCompanyId !== companyId) throw new Error('Forbidden');
}

async function getNextDisplayOrder(
  db: FirebaseFirestore.Firestore,
  rfqId: string,
): Promise<number> {
  const snap = await linesRef(db, rfqId).count().get();
  return snap.data().count;
}

// ============================================================================
// CREATE — SINGLE
// ============================================================================

export async function addRfqLine(
  ctx: AuthContext,
  rfqId: string,
  dto: CreateRfqLineDTO,
): Promise<RfqLine> {
  return safeFirestoreOperation(async (db) => {
    await assertRfqOwnership(db, rfqId, ctx.companyId);

    const id = generateRfqLineId();
    const now = admin.firestore.Timestamp.now();
    const order = dto.displayOrder ?? (await getNextDisplayOrder(db, rfqId));

    const line: RfqLine = {
      id,
      rfqId,
      companyId: ctx.companyId,
      source: dto.source,
      boqItemId: dto.boqItemId ?? null,
      description: dto.description,
      trade: dto.trade,
      categoryCode: dto.categoryCode ?? null,
      quantity: dto.quantity ?? null,
      unit: dto.unit ?? null,
      unitPrice: dto.unitPrice ?? null,
      notes: dto.notes ?? null,
      displayOrder: order,
      createdAt: now,
      updatedAt: now,
    };

    await linesRef(db, rfqId).doc(id).set(sanitizeForFirestore(line));
    logger.info('RfqLine created', { id, rfqId, companyId: ctx.companyId });
    return line;
  });
}

// ============================================================================
// CREATE — BULK (batch, max 500 per Firestore limit)
// ============================================================================

export async function addRfqLinesBulk(
  ctx: AuthContext,
  rfqId: string,
  dtos: CreateRfqLineDTO[],
): Promise<RfqLine[]> {
  if (dtos.length === 0) return [];

  return safeFirestoreOperation(async (db) => {
    await assertRfqOwnership(db, rfqId, ctx.companyId);

    const startOrder = await getNextDisplayOrder(db, rfqId);
    const now = admin.firestore.Timestamp.now();

    const lines: RfqLine[] = dtos.map((dto, idx) => ({
      id: generateRfqLineId(),
      rfqId,
      companyId: ctx.companyId,
      source: dto.source,
      boqItemId: dto.boqItemId ?? null,
      description: dto.description,
      trade: dto.trade,
      categoryCode: dto.categoryCode ?? null,
      quantity: dto.quantity ?? null,
      unit: dto.unit ?? null,
      unitPrice: dto.unitPrice ?? null,
      notes: dto.notes ?? null,
      displayOrder: dto.displayOrder ?? startOrder + idx,
      createdAt: now,
      updatedAt: now,
    }));

    const batch = db.batch();
    for (const line of lines) {
      batch.set(linesRef(db, rfqId).doc(line.id), sanitizeForFirestore(line));
    }
    await batch.commit();

    void EntityAuditService.recordChange({
      entityType: 'purchase_order',
      entityId: rfqId,
      entityName: null,
      action: 'updated',
      changes: [{ field: 'lines', oldValue: null, newValue: `${lines.length} lines added (bulk)` }],
      performedBy: ctx.uid,
      performedByName: null,
      companyId: ctx.companyId,
    });

    logger.info('RfqLines bulk created', { rfqId, count: lines.length, companyId: ctx.companyId });
    return lines;
  });
}

// ============================================================================
// CREATE — BOQ SNAPSHOT (Q29 — copy-on-create, never live-update from BOQ)
// ============================================================================

export async function snapshotFromBoq(
  ctx: AuthContext,
  rfqId: string,
  boqItemIds: string[],
  trade: TradeCode,
): Promise<RfqLine[]> {
  if (boqItemIds.length === 0) return [];

  return safeFirestoreOperation(async (db) => {
    await assertRfqOwnership(db, rfqId, ctx.companyId);

    const startOrder = await getNextDisplayOrder(db, rfqId);
    const now = admin.firestore.Timestamp.now();

    // Firestore `in` max 30 — take first batch
    const ids = boqItemIds.slice(0, BOQ_IN_LIMIT);
    const boqSnap = await db
      .collection(COLLECTIONS.BOQ_ITEMS)
      .where(admin.firestore.FieldPath.documentId(), 'in', ids)
      .get();

    const items = boqSnap.docs
      .map((d) => ({ id: d.id, ...d.data() } as BOQItem))
      .filter((item) => item.companyId === ctx.companyId); // CHECK 3.10 tenant guard

    if (items.length === 0) return [];

    const lines: RfqLine[] = items.map((item, idx) => {
      const unitPrice =
        (item.materialUnitCost ?? 0) +
        (item.laborUnitCost ?? 0) +
        (item.equipmentUnitCost ?? 0);
      return {
        id: generateRfqLineId(),
        rfqId,
        companyId: ctx.companyId,
        source: 'boq' as const,
        boqItemId: item.id,
        description: item.title,
        trade: getTradeCodeForAtoeCategory(item.categoryCode) ?? trade,
        categoryCode: item.categoryCode,
        quantity: item.estimatedQuantity,
        unit: item.unit as string,
        unitPrice: unitPrice > 0 ? unitPrice : null,
        notes: item.description ?? null,
        displayOrder: startOrder + idx,
        createdAt: now,
        updatedAt: now,
      };
    });

    const batch = db.batch();
    for (const line of lines) {
      batch.set(linesRef(db, rfqId).doc(line.id), sanitizeForFirestore(line));
    }
    await batch.commit();

    logger.info('RfqLines snapshotted from BOQ', { rfqId, boqItemCount: items.length });
    return lines;
  });
}

// ============================================================================
// READ
// ============================================================================

export async function listRfqLines(
  ctx: AuthContext,
  rfqId: string,
): Promise<RfqLine[]> {
  return safeFirestoreOperation(async (db) => {
    await assertRfqOwnership(db, rfqId, ctx.companyId);

    const snap = await linesRef(db, rfqId)
      .orderBy('displayOrder', 'asc')
      .get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as RfqLine));
  }, []);
}

export async function listRfqLinesPublic(
  ctx: AuthContext,
  rfqId: string,
): Promise<PublicRfqLine[]> {
  const lines = await listRfqLines(ctx, rfqId);
  return lines.map(toPublicRfqLine);
}

// ============================================================================
// UPDATE
// ============================================================================

export async function updateRfqLine(
  ctx: AuthContext,
  rfqId: string,
  lineId: string,
  dto: UpdateRfqLineDTO,
): Promise<RfqLine> {
  return safeFirestoreOperation(async (db) => {
    const lineRef = linesRef(db, rfqId).doc(lineId);
    const snap = await lineRef.get();
    if (!snap.exists) throw new Error(`RfqLine ${lineId} not found`);

    const current = { id: snap.id, ...snap.data() } as RfqLine;
    if (current.companyId !== ctx.companyId) throw new Error('Forbidden');

    const updates: Partial<RfqLine> = {
      description: dto.description ?? current.description,
      trade: dto.trade ?? current.trade,
      categoryCode: dto.categoryCode !== undefined ? dto.categoryCode : current.categoryCode,
      quantity: dto.quantity !== undefined ? dto.quantity : current.quantity,
      unit: dto.unit !== undefined ? dto.unit : current.unit,
      unitPrice: dto.unitPrice !== undefined ? dto.unitPrice : current.unitPrice,
      notes: dto.notes !== undefined ? dto.notes : current.notes,
      displayOrder: dto.displayOrder ?? current.displayOrder,
      updatedAt: admin.firestore.Timestamp.now(),
    };

    await lineRef.update(sanitizeForFirestore(updates));
    return { ...current, ...updates };
  });
}

// ============================================================================
// DELETE
// ============================================================================

export async function deleteRfqLine(
  ctx: AuthContext,
  rfqId: string,
  lineId: string,
): Promise<void> {
  await safeFirestoreOperation<void>(async (db) => {
    const lineRef = linesRef(db, rfqId).doc(lineId);
    const snap = await lineRef.get();
    if (!snap.exists) throw new Error(`RfqLine ${lineId} not found`);
    const data = snap.data() as { companyId: string };
    if (data.companyId !== ctx.companyId) throw new Error('Forbidden');
    await lineRef.delete();
    logger.info('RfqLine deleted', { lineId, rfqId, uid: ctx.uid });
  }, undefined);
}
