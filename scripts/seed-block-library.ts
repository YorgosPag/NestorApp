/**
 * ADR-652 M3 — seed της ΕΤΟΙΜΗΣ (system/partner) βιβλιοθήκης block.
 *
 * Γράφει, για κάθε εγγραφή του `SYSTEM_BLOCKS_SEED`:
 *   1. το «αρχείο» του block → Storage `system/block-library/{blklib_sys_*}.json`
 *      (το ίδιο blob schema v1 που γράφει ο client — `serializeBlockGeometry`),
 *   2. το metadata doc → Firestore `block_library/{blklib_sys_*}` με `scope:'system'`,
 *      `builtin:true`, `companyId:null` (δεν ανήκει σε πελάτη — το βλέπουν ΟΛΟΙ).
 *
 * Idempotent: ντετερμινιστικά ids (`blklib_sys_<preset>`) + ντετερμινιστικό blob ⇒
 * ξανατρέξιμο = update, ποτέ διπλότυπα. Mirror του `seed-bim-materials.ts`.
 *
 * ΣΕΙΡΑ (ίδια με τον client `saveBlock`): ΠΡΩΤΑ το blob, ΜΕΤΑ το doc — ένα doc χωρίς
 * γεωμετρία θα ήταν σπασμένη κάρτα στο palette· ένα ορφανό blob είναι απλώς αόρατο.
 *
 * Το περιεχόμενο είναι δικής μας παραμετρικής συγγραφής (ADR-415 Δ1) ⇒ `cc0` /
 * `redistributable: true` — γι' αυτό επιτρέπεται σε κοινόχρηστο scope.
 *
 * Usage: `npm run seed:block-library`
 *
 * @see docs/centralized-systems/reference/adrs/ADR-652-block-library.md §M3
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { randomUUID } from 'node:crypto';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

import {
  SYSTEM_BLOCKS_SEED,
  SYSTEM_BLOCK_LICENSE,
  SYSTEM_BLOCK_PROVENANCE,
} from '../src/subapps/dxf-viewer/bim/data/system-blocks-seed';
import { buildSystemBlockMembers } from '../src/subapps/dxf-viewer/bim/block-library/system-block-geometry';
import { computeBlockLocalBoundsMm } from '../src/subapps/dxf-viewer/bim/block-library/block-local-bounds';
import { serializeBlockGeometry } from '../src/subapps/dxf-viewer/bim/block-library/block-geometry-blob';
import { buildBlockThumbnail } from '../src/subapps/dxf-viewer/bim/block-library/block-thumbnail';
import { buildBlockLibraryGeometryPath } from '../src/services/upload/utils/storage-path';

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
const COLLECTION = 'block_library';
const BUCKET_NAME = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
const SEED_USER_ID = 'system_seed';
/** Σταθερό «πότε» — το seeded περιεχόμενο δεν έχει στιγμή εισαγωγής χρήστη. */
const SEED_IMPORTED_AT = 0;

if (!BUCKET_NAME) {
  console.error('Missing NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET — cannot upload geometry blobs.');
  process.exit(1);
}

const bucket = getStorage().bucket(BUCKET_NAME);

// ============================================================================
// STORAGE
// ============================================================================

/**
 * Ανεβάζει το blob και επιστρέφει download URL. Ο client ΔΕΝ διαβάζει το URL για να
 * κατεβάσει (χτίζει το path ντετερμινιστικά) — το κρατάμε στο doc για εξωτερική χρήση,
 * ακριβώς όπως και στη user διαδρομή.
 */
async function uploadGeometryBlob(storagePath: string, json: string): Promise<string> {
  const token = randomUUID();
  const file = bucket.file(storagePath);

  await file.save(Buffer.from(json, 'utf8'), {
    contentType: 'application/json',
    metadata: { metadata: { firebaseStorageDownloadTokens: token } },
  });

  return (
    `https://firebasestorage.googleapis.com/v0/b/${BUCKET_NAME}/o/` +
    `${encodeURIComponent(storagePath)}?alt=media&token=${token}`
  );
}

// ============================================================================
// SEED
// ============================================================================

async function seed(): Promise<void> {
  console.log(`Seeding ${SYSTEM_BLOCKS_SEED.length} system blocks → ${COLLECTION}…`);

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const entry of SYSTEM_BLOCKS_SEED) {
    const localMembers = buildSystemBlockMembers(entry.preset, entry.id);
    const boundsMm = computeBlockLocalBoundsMm(localMembers);

    if (!boundsMm || localMembers.length === 0) {
      console.warn(`  ⚠ ${entry.name}: δεν παρήχθη γεωμετρία — skip.`);
      skipped++;
      continue;
    }

    // 1) blob (system path: companyId = null)
    const storagePath = buildBlockLibraryGeometryPath({ companyId: null, blockId: entry.id });
    const geometryUrl = await uploadGeometryBlob(
      storagePath,
      serializeBlockGeometry({ name: entry.name, boundsMm, localMembers }),
    );

    // 2) metadata doc — ΜΕ το preview μέσα (ADR-652 M4). ΓΙ' ΑΥΤΟ το thumbnail είναι
    // διανυσματικό και όχι PNG: εδώ είμαστε σε Node (Admin SDK) — δεν υπάρχει DOM canvas.
    // Ο builder είναι καθαρά μαθηματικά ⇒ ΙΔΙΟΣ κώδικας με τον browser (μία υλοποίηση).
    const { thumbnail } = buildBlockThumbnail(localMembers);

    const ref = db.collection(COLLECTION).doc(entry.id);
    const snap = await ref.get();

    const payload = {
      id: entry.id,
      scope: 'system' as const,
      builtin: true,
      companyId: null,
      projectId: null,
      name: entry.name,
      labelKey: entry.labelKey,
      category: entry.category,
      boundsMm,
      geometryUrl,
      ...(thumbnail ? { thumbnail } : {}),
      provenance: { ...SYSTEM_BLOCK_PROVENANCE, importedAt: SEED_IMPORTED_AT },
      license: SYSTEM_BLOCK_LICENSE,
      createdBy: SEED_USER_ID,
      updatedBy: SEED_USER_ID,
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (snap.exists) {
      await ref.set(payload, { merge: true });
      updated++;
    } else {
      await ref.set({ ...payload, createdAt: FieldValue.serverTimestamp() });
      created++;
    }
  }

  console.log(`Done. Created: ${created}, Updated: ${updated}, Skipped: ${skipped}.`);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
