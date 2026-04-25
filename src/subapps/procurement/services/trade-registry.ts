import 'server-only';

import { safeFirestoreOperation } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { sanitizeForFirestore } from '@/utils/firestore-sanitize';
import { generateTradeId } from '@/services/enterprise-id.service';
import { TRADE_SEED_DATA } from '../data/trades';
import type { Trade, TradeCode, TradeGroup, TradeFilters } from '../types/trade';
import { createModuleLogger } from '@/lib/telemetry';
import admin from 'firebase-admin';

const logger = createModuleLogger('TRADE_REGISTRY');

// ============================================================================
// SEED (idempotent — call once per company to populate `trades` collection)
// ============================================================================

export async function seedSystemTrades(): Promise<void> {
  await safeFirestoreOperation(async (db) => {
    const batch = db.batch();
    for (const seed of TRADE_SEED_DATA) {
      const ref = db.collection(COLLECTIONS.TRADES).doc(seed.code);
      const snap = await ref.get();
      if (!snap.exists) {
        const trade: Omit<Trade, 'id'> = {
          ...seed,
          isActive: true,
          companyId: null,
          createdAt: admin.firestore.Timestamp.now(),
          updatedAt: admin.firestore.Timestamp.now(),
        };
        batch.set(ref, sanitizeForFirestore({ id: seed.code, ...trade }));
      }
    }
    await batch.commit();
    logger.info('Trades seeded');
  }, undefined);
}

// ============================================================================
// READ — LIST
// ============================================================================

export async function listTrades(
  companyId: string,
  filters: TradeFilters = {}
): Promise<Trade[]> {
  return safeFirestoreOperation(async (db) => {
    let query = db.collection(COLLECTIONS.TRADES)
      .where('isActive', '==', true) as FirebaseFirestore.Query;

    if (filters.group) {
      query = query.where('group', '==', filters.group);
    }

    const snap = await query.orderBy('sortOrder').get();
    const trades = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Trade));

    if (filters.search) {
      const q = filters.search.toLowerCase();
      return trades.filter(
        (t) => t.labelEl.toLowerCase().includes(q) || t.labelEn.toLowerCase().includes(q)
      );
    }

    return trades;
  }, []);
}

// ============================================================================
// READ — GET BY CODE
// ============================================================================

export async function getTradeByCode(code: string): Promise<Trade | null> {
  return safeFirestoreOperation(async (db) => {
    const snap = await db.collection(COLLECTIONS.TRADES).doc(code).get();
    if (!snap.exists) return null;
    return { id: snap.id, ...snap.data() } as Trade;
  }, null);
}

// ============================================================================
// WRITE — CREATE CUSTOM TRADE (company_admin only)
// ============================================================================

export async function createCustomTrade(
  companyId: string,
  data: Pick<Trade, 'labelEl' | 'labelEn' | 'group' | 'sortOrder' | 'relatedAtoeCategories' | 'defaultUnits'>
): Promise<Trade> {
  return safeFirestoreOperation(async (db) => {
    const id = generateTradeId();
    const now = admin.firestore.Timestamp.now();
    const trade: Trade = {
      id,
      code: id as TradeCode,
      ...data,
      isActive: true,
      companyId,
      createdAt: now,
      updatedAt: now,
    };
    await db.collection(COLLECTIONS.TRADES).doc(id).set(sanitizeForFirestore(trade));
    logger.info('Custom trade created', { id, companyId });
    return trade;
  });
}

// ============================================================================
// WRITE — SOFT DELETE (immutable if used in RFQ)
// ============================================================================

export async function deactivateTrade(
  id: string,
  companyId: string
): Promise<void> {
  await safeFirestoreOperation(async (db) => {
    await db.collection(COLLECTIONS.TRADES).doc(id).update(
      sanitizeForFirestore({
        isActive: false,
        updatedAt: admin.firestore.Timestamp.now(),
      })
    );
    logger.info('Trade deactivated', { id, companyId });
  }, undefined);
}
