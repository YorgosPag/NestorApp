/**
 * ISO 19650 Enrichment Slot Service — ADR-373 P2.4
 *
 * Distributed token bucket για concurrency control του AI enrichment.
 * Firestore-backed counter per company — max MAX_SLOTS ταυτόχρονα.
 *
 * Fail-open: αν το service είναι down → true (proceed without limit).
 * Admin SDK only — client access απαγορευμένο από Firestore rules.
 *
 * @module services/iso19650/enrichment-slot-service
 * @see ADR-373 §P2.4 — Distributed Token Bucket
 */

// 🚨 ADR-373 hotfix (memory: feedback_server_only_dynamic_import) — firebaseAdmin
// imports `server-only`. Static import poisons the client bundle via the
// file-record.service.ts → file-mutation-gateway.ts → useFileDownload chain.
// Dynamic import keeps this module safe to reference from client-reachable code;
// the actual server-only load happens only when these async functions execute.
import { COLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('Iso19650SlotService');

const MAX_SLOTS = 5;
const SLOT_TTL_MS = 5 * 60 * 1000;

async function getDb() {
  const { getAdminFirestore } = await import('@/lib/firebaseAdmin');
  return getAdminFirestore();
}

// ============================================================================
// INTERNAL TYPES
// ============================================================================

interface SlotDoc {
  activeSlots: number;
  updatedAt: FirebaseFirestore.Timestamp;
}

// ============================================================================
// SLOT OPERATIONS
// ============================================================================

/**
 * Try to acquire one enrichment slot for this company.
 * Atomic Firestore transaction — reset stale docs (>TTL) before counting.
 * @returns true if slot acquired, false if at capacity
 */
export async function acquireSlot(companyId: string): Promise<boolean> {
  // Runtime server-only guard (ADR-373 §D9). Mirrors triggerPostFinalizeHooks.
  // Fail-open if accidentally called client-side — same as the catch branch.
  if (typeof window !== 'undefined') return true;
  try {
    const db = await getDb();
    const ref = db.collection(COLLECTIONS.ISO19650_ENRICHMENT_SLOTS).doc(companyId);

    return await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);

      if (!snap.exists) {
        tx.set(ref, { activeSlots: 1, updatedAt: new Date() });
        return true;
      }

      const data = snap.data() as SlotDoc;
      const ageMs = Date.now() - data.updatedAt.toMillis();
      const current = ageMs > SLOT_TTL_MS ? 0 : data.activeSlots;

      if (current >= MAX_SLOTS) {
        logger.info('ISO19650 enrichment slots at capacity', { companyId, current, MAX_SLOTS });
        return false;
      }

      tx.update(ref, { activeSlots: current + 1, updatedAt: new Date() });
      return true;
    });
  } catch (err) {
    logger.warn('acquireSlot failed — fail-open', { companyId, error: String(err) });
    return true;
  }
}

/**
 * Release one enrichment slot. Floors at 0.
 * Non-throwing — slot leaks are self-healing via TTL in acquireSlot.
 */
export async function releaseSlot(companyId: string): Promise<void> {
  // Runtime server-only guard (ADR-373 §D9). Mirrors triggerPostFinalizeHooks.
  if (typeof window !== 'undefined') return;
  try {
    const db = await getDb();
    const ref = db.collection(COLLECTIONS.ISO19650_ENRICHMENT_SLOTS).doc(companyId);

    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) return;
      const data = snap.data() as SlotDoc;
      tx.update(ref, {
        activeSlots: Math.max(0, data.activeSlots - 1),
        updatedAt: new Date(),
      });
    });
  } catch (err) {
    logger.warn('releaseSlot failed — slot will self-heal via TTL', { companyId, error: String(err) });
  }
}
