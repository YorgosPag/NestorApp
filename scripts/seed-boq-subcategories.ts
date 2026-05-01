/**
 * seed-boq-subcategories — Popola Firestore con le 98 sotto-categorie BOQ Level-2
 *
 * Scrive nella collection `boq_system_subcategories` (global, no companyId).
 * Idempotente: usa setDoc() — rieseguire non crea duplicati.
 * IDs generati da enterprise-id.service (generateBoqCategoryId).
 *
 * Usage: npm run seed:boq-subcategories
 *
 * @see ADR-337 §4.5
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { BOQ_SUBCATEGORIES } from '../src/config/boq-subcategories';

// ============================================================================
// INIT
// ============================================================================

if (!getApps().length) {
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
    ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY) as object
    : undefined;

  if (serviceAccount) {
    initializeApp({ credential: cert(serviceAccount as Parameters<typeof cert>[0]) });
  } else {
    initializeApp();
  }
}

const db = getFirestore();
const COLLECTION = process.env.NEXT_PUBLIC_BOQ_SYSTEM_SUBCATEGORIES_COLLECTION ?? 'boq_system_subcategories';

// ============================================================================
// SEED
// ============================================================================

async function seed(): Promise<void> {
  console.log(`Seeding ${BOQ_SUBCATEGORIES.length} sub-categories → ${COLLECTION}…`);

  const now = new Date().toISOString();
  let created = 0;
  let skipped = 0;

  for (const sc of BOQ_SUBCATEGORIES) {
    const docId = `boq-subcat-${sc.code.replace(/\./g, '-')}`;
    const ref = db.collection(COLLECTION).doc(docId);
    const snap = await ref.get();

    if (snap.exists) {
      skipped++;
      continue;
    }

    await ref.set({
      id: docId,
      code: sc.code,
      parentCode: sc.parentCode,
      nameEL: sc.nameEL,
      nameEN: sc.nameEN,
      sortOrder: sc.sortOrder,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
    created++;
  }

  console.log(`Done. Created: ${created}, Skipped (already existed): ${skipped}.`);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
