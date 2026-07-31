import 'server-only';

import admin from 'firebase-admin';
import { safeFirestoreOperation, getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { sanitizeForFirestore } from '@/utils/firestore-sanitize';
import { generateRfqLineId } from '@/services/enterprise-id.service';
import { EntityAuditService } from '@/services/entity-audit.service';
import { createModuleLogger } from '@/lib/telemetry';
import type { AuthContext } from '@/lib/auth';
import { PROCUREMENT_RESOURCE, loadOwnedProcurementDoc } from './procurement-owned-doc';
import { assertOwnedRfq } from './rfq-ownership';
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
  return db.collection(COLLECTIONS.RFQS).doc(rfqId).collection(COLLECTIONS.RFQ_LINES_SUB);
}

/** Ο πόρος αυτού του αρχείου· ο πόρος «RFQ» ζει στο `rfq-ownership`. */
const lineSubject = (lineId: string) =>
  ({ resource: PROCUREMENT_RESOURCE.RFQ_LINE, resourceId: lineId }) as const;

/**
 * Το **ένα** εργοστάσιο γραμμής RFQ.
 *
 * Το ίδιο αντικείμενο χτιζόταν **τρεις** φορές (μία γραμμή · μαζική · στιγμιότυπο
 * από ΒΟΜ) — και το `jscpd` το μετρούσε ως κλώνο **ήδη στο HEAD**.
 *
 * 🔴 **Δεν είναι θέμα μήκους.** Η γραμμή 3 του σώματος είναι
 * `companyId: ctx.companyId` — η **αποκανονικοποίηση tenant** που ελέγχει το
 * CHECK 3.10 και ένα υπάρχον test («denormalizes companyId on every line»).
 * Γραμμένη σε τρία σημεία, αρκεί ένα νέο μονοπάτι δημιουργίας που την ξεχνά
 * για να γεννηθεί γραμμή **χωρίς tenant** — και έγγραφο χωρίς tenant δεν ανήκει
 * σε κανέναν (ADR-742 §4), δηλαδή γίνεται αόρατο στον ίδιο του τον ιδιοκτήτη.
 * Ένα εργοστάσιο = η αποκανονικοποίηση δεν μπορεί να παραλειφθεί.
 */
function buildRfqLine(spec: {
  readonly rfqId: string;
  readonly companyId: string;
  readonly dto: CreateRfqLineDTO;
  readonly displayOrder: number;
  readonly now: FirebaseFirestore.Timestamp;
}): RfqLine {
  const { rfqId, companyId, dto, displayOrder, now } = spec;
  return {
    id: generateRfqLineId(),
    rfqId,
    companyId,
    source: dto.source,
    boqItemId: dto.boqItemId ?? null,
    description: dto.description,
    trade: dto.trade,
    categoryCode: dto.categoryCode ?? null,
    quantity: dto.quantity ?? null,
    unit: dto.unit ?? null,
    unitPrice: dto.unitPrice ?? null,
    notes: dto.notes ?? null,
    displayOrder,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Το **κοινό προοίμιο** κάθε μαζικής εισαγωγής γραμμών.
 *
 * 🔴 Το πρώτο βήμα είναι ο **φύλακας ιδιοκτησίας**, και γι' αυτό ζει εδώ: όταν
 * η σειρά «έλεγξε → μέτρησε → γράψε» είναι αντιγραμμένη, ένα νέο μονοπάτι
 * μαζικής εισαγωγής μπορεί να τη γράψει με τον φύλακα **μετά** τη μέτρηση —
 * ή καθόλου. Δεν υπάρχει τρόπος να πάρεις `startOrder` χωρίς να έχει
 * απαντηθεί «ανήκει ΑΥΤΟ το RFQ;» (ADR-742 §3.4).
 */
async function beginBulkInsert(
  db: FirebaseFirestore.Firestore,
  rfqId: string,
  companyId: string,
): Promise<{ startOrder: number; now: FirebaseFirestore.Timestamp }> {
  await assertOwnedRfq(db, rfqId, companyId);
  return {
    startOrder: await getNextDisplayOrder(db, rfqId),
    now: admin.firestore.Timestamp.now(),
  };
}

/** Η μαζική εγγραφή γραμμών — ένα batch, ένα σημείο. */
async function writeLinesBatch(
  db: FirebaseFirestore.Firestore,
  rfqId: string,
  lines: readonly RfqLine[],
): Promise<void> {
  const batch = db.batch();
  for (const line of lines) {
    batch.set(linesRef(db, rfqId).doc(line.id), sanitizeForFirestore(line));
  }
  await batch.commit();
}

/**
 * Η μετάφραση ενός στοιχείου ΒΟΜ σε DTO γραμμής — το **μόνο** που είναι
 * ιδιαίτερο στο στιγμιότυπο (Q29). Η τιμή αθροίζεται από τα τρία κόστη και
 * μηδενικό άθροισμα γράφεται ως `null` (άγνωστη τιμή, όχι «δωρεάν»).
 */
function boqItemToLineDto(item: BOQItem, fallbackTrade: TradeCode): CreateRfqLineDTO {
  const unitPrice =
    (item.materialUnitCost ?? 0) + (item.laborUnitCost ?? 0) + (item.equipmentUnitCost ?? 0);
  return {
    source: 'boq',
    boqItemId: item.id,
    description: item.title,
    trade: getTradeCodeForAtoeCategory(item.categoryCode) ?? fallbackTrade,
    categoryCode: item.categoryCode,
    quantity: item.estimatedQuantity,
    unit: item.unit as string,
    unitPrice: unitPrice > 0 ? unitPrice : null,
    notes: item.description ?? null,
  };
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
    await assertOwnedRfq(db, rfqId, ctx.companyId);

    const line = buildRfqLine({
      rfqId,
      companyId: ctx.companyId,
      dto,
      displayOrder: dto.displayOrder ?? (await getNextDisplayOrder(db, rfqId)),
      now: admin.firestore.Timestamp.now(),
    });

    await linesRef(db, rfqId).doc(line.id).set(sanitizeForFirestore(line));
    logger.info('RfqLine created', { id: line.id, rfqId, companyId: ctx.companyId });
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
    const { startOrder, now } = await beginBulkInsert(db, rfqId, ctx.companyId);

    const lines: RfqLine[] = dtos.map((dto, idx) =>
      buildRfqLine({
        rfqId,
        companyId: ctx.companyId,
        dto,
        displayOrder: dto.displayOrder ?? startOrder + idx,
        now,
      }),
    );

    await writeLinesBatch(db, rfqId, lines);

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
    const { startOrder, now } = await beginBulkInsert(db, rfqId, ctx.companyId);

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

    // Το στιγμιότυπο είναι **παγωμένο αντίγραφο** (Q29): η μετάφραση
    // BOQ → DTO γίνεται εδώ, η κατασκευή της γραμμής στο ένα εργοστάσιο.
    const lines: RfqLine[] = items.map((item, idx) =>
      buildRfqLine({
        rfqId,
        companyId: ctx.companyId,
        dto: boqItemToLineDto(item, trade),
        displayOrder: startOrder + idx,
        now,
      }),
    );

    await writeLinesBatch(db, rfqId, lines);

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
    await assertOwnedRfq(db, rfqId, ctx.companyId);

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
    const { ref: lineRef, current } = await loadOwnedProcurementDoc<RfqLine>(
      linesRef(db, rfqId).doc(lineId),
      ctx.companyId,
      lineSubject(lineId),
    );

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
    // Το προηγούμενο `snap.data() as { companyId: string }` ήταν υπόσχεση χωρίς
    // απόδειξη· ο φορτωτής ρωτά το ωμό φορτίο (ADR-742 §7.5).
    const { ref: lineRef } = await loadOwnedProcurementDoc<RfqLine>(
      linesRef(db, rfqId).doc(lineId),
      ctx.companyId,
      lineSubject(lineId),
    );
    await lineRef.delete();
    logger.info('RfqLine deleted', { lineId, rfqId, uid: ctx.uid });
  }, undefined);
}
