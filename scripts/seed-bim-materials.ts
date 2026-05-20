/**
 * ADR-363 Phase 6.5 — seed `bim_materials` με 25 system entries.
 *
 * Wipes existing `bim_materials WHERE scope='system'` και ξαναγράφει από τη
 * canonical pure-data list `SYSTEM_MATERIALS_SEED`. Idempotent. Deterministic
 * doc IDs (`bmat_sys_<slug>`) ώστε ξανατρέξιμο να μην παράγει duplicates.
 *
 * Doc ID format: `bmat_sys_<lowercase-en-slug>`. Mirror του seed-boq-subcategories
 * deterministic-ID pattern για system data — admin-provisioned, όχι από app
 * runtime, οπότε δεν περνά από `validateEnterpriseId`.
 *
 * Usage: `pnpm run seed:bim-materials`
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §Q8
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { SYSTEM_MATERIALS_SEED } from '../src/subapps/dxf-viewer/bim/data/system-materials-seed';

// ============================================================================
// INIT
// ============================================================================

if (!getApps().length) {
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
    ? (JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY) as object)
    : undefined;

  if (serviceAccount) {
    initializeApp({ credential: cert(serviceAccount as Parameters<typeof cert>[0]) });
  } else {
    initializeApp();
  }
}

const db = getFirestore();
const COLLECTION =
  process.env.NEXT_PUBLIC_BIM_MATERIALS_COLLECTION ?? 'bim_materials';
const SEED_USER_ID = 'system_seed';

// ============================================================================
// HELPERS
// ============================================================================

/** Lowercase + non-alphanum → `_`, collapsed. */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function deterministicId(nameEn: string): string {
  return `bmat_sys_${slugify(nameEn)}`;
}

// ============================================================================
// SEED
// ============================================================================

async function seed(): Promise<void> {
  console.log(`Seeding ${SYSTEM_MATERIALS_SEED.length} system materials → ${COLLECTION}…`);

  let created = 0;
  let updated = 0;

  for (const m of SYSTEM_MATERIALS_SEED) {
    const docId = deterministicId(m.nameEn);
    const ref = db.collection(COLLECTION).doc(docId);
    const snap = await ref.get();

    const payload = {
      id: docId,
      scope: 'system' as const,
      nameEl: m.nameEl,
      nameEn: m.nameEn,
      category: m.category,
      density: m.density,
      defaultThickness: m.defaultThickness,
      fireRating: m.fireRating,
      atoeCategory: m.atoeCategory,
      atoeArticle: m.atoeArticle,
      defaultUnitCost: null,
      defaultUnit: m.defaultUnit,
      brand: null,
      brandModel: null,
      notes: m.notes,
      builtin: true,
      companyId: null,
      projectId: null,
      createdBy: SEED_USER_ID,
      updatedBy: SEED_USER_ID,
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (snap.exists) {
      await ref.set(payload, { merge: true });
      updated++;
    } else {
      await ref.set({
        ...payload,
        createdAt: FieldValue.serverTimestamp(),
      });
      created++;
    }
  }

  console.log(`Done. Created: ${created}, Updated: ${updated}.`);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
