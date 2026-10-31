import 'server-only';

/**
 * Οι **αναγνώσεις** της εισαγωγής (ADR-923 §5.5.1): η ΜΟΝΗ πόρτα, γιατί οι συλλογές είναι `deny_all`. Ο κριτής δικαιώματος
 * τρέχει εδώ για τη ροή τιμών, ώστε παρτίδα τιμών να μην φτάνει σε όποιον δεν βλέπει τιμές.
 * @module server/catalog/import-reads.server
 */

import { COLLECTIONS } from '@/config/firestore-collections';
import type { AuthContext } from '@/lib/auth';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import type { ImportBaseValues } from '@/subapps/catalog/import/build-attribute-proposal';
import { importTargetKey } from '@/subapps/catalog/import/proposal-values';
import type { ImportFieldValue, ImportProposalDefinition } from '@/subapps/catalog/types/catalog-import';
import type { ImportBatchDetailView, ImportBatchWire, ImportProfileWire, ImportProposalWire } from '@/subapps/catalog/types/catalog-import-requests';
import { readOwned, runCatalogTransaction } from './catalog-store.server';
import { assertPurposeAuthority } from './import-batch-writer.server';
import type { ImportBatchDefinition } from '@/subapps/catalog/types/catalog-import';

const BATCHES_PAGE = 50;
const PROFILES_PAGE = 200;
/** Πόσες εφαρμοσμένες προτάσεις μετρούν ως βάση: η τελευταία αρκεί ανά πεδίο, μερικές καλύπτουν προτάσεις ανά σελίδα. */
const BASE_PROPOSALS = 20;

const proposals = () => getAdminFirestore().collection(COLLECTIONS.CATALOG_IMPORT_PROPOSALS);

/** `GET /api/catalog/imports` — οι πρόσφατες παρτίδες του χώρου. */
export async function listImportBatches(ctx: AuthContext): Promise<readonly ImportBatchWire[]> {
  const snap = await getAdminFirestore()
    .collection(COLLECTIONS.CATALOG_IMPORT_BATCHES)
    .where('companyId', '==', ctx.companyId)
    .where('isDeleted', '==', false)
    .orderBy('updatedAt', 'desc')
    .limit(BATCHES_PAGE)
    .get();
  return snap.docs.map((doc) => doc.data() as ImportBatchWire);
}

export async function listImportProfiles(ctx: AuthContext): Promise<readonly ImportProfileWire[]> {
  const snap = await getAdminFirestore()
    .collection(COLLECTIONS.CATALOG_IMPORT_PROFILES)
    .where('companyId', '==', ctx.companyId)
    .where('isDeleted', '==', false)
    .limit(PROFILES_PAGE)
    .get();
  return snap.docs.map((doc) => doc.data() as ImportProfileWire);
}

export async function readBatchProposals(ctx: AuthContext, batchId: string): Promise<readonly ImportProposalWire[]> {
  const snap = await proposals().where('companyId', '==', ctx.companyId).where('batchId', '==', batchId).where('isDeleted', '==', false).get();
  return snap.docs.map((doc) => doc.data() as ImportProposalWire);
}

/** `GET /api/catalog/imports/[id]` — η παρτίδα και οι προτάσεις της. */
export async function readImportBatchDetail(ctx: AuthContext, id: string): Promise<ImportBatchDetailView> {
  const batch = await runCatalogTransaction(ctx, (scope) => readOwned<ImportBatchDefinition>(scope, 'importBatch', id));
  await assertPurposeAuthority(ctx, batch.target.purpose);
  return { batch, proposals: await readBatchProposals(ctx, id) };
}

function acceptedValuesOf(proposal: ImportProposalDefinition, into: Map<string, Map<string, ImportFieldValue>>): void {
  for (const row of proposal.rows) {
    if (row.holderId === null) continue;
    const holder = into.get(row.holderId) ?? new Map<string, ImportFieldValue>();
    for (const field of row.fields) {
      if (field.decision === 'accept' && field.incoming !== null) holder.set(importTargetKey(field.target), field.incoming);
    }
    into.set(row.holderId, holder);
  }
}

/**
 * Η **βάση** της σύγκρισης τριών σημείων: ό,τι έφεραν οι τελευταίες εφαρμοσμένες εισαγωγές του μοντέλου. Ερώτημα έξω από τη
 * συναλλαγή, επίτηδες: η βάση είναι ιστορικό, δεν αλλάζει ανάμεσα στην ανάγνωση και την εγγραφή.
 */
export async function readImportBase(ctx: AuthContext, modelCode: string | null): Promise<ImportBaseValues> {
  if (modelCode === null) return new Map();
  const snap = await proposals()
    .where('companyId', '==', ctx.companyId)
    .where('modelCode', '==', modelCode)
    .where('status', '==', 'applied')
    .orderBy('appliedAt', 'desc')
    .limit(BASE_PROPOSALS)
    .get();
  const base = new Map<string, Map<string, ImportFieldValue>>();
  for (const doc of [...snap.docs].reverse()) acceptedValuesOf(doc.data() as ImportProposalDefinition, base);
  return base;
}
