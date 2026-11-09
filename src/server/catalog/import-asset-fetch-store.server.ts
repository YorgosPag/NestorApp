import 'server-only';

/**
 * =============================================================================
 * Ο ΕΝΑΣ ΓΡΑΦΕΑΣ ΤΟΥ `catalog_import_asset_fetches` — διεκδίκηση με μίσθωση, κλείσιμο με σφραγίδα (ADR-934 §5.2.2 Μ-β4)
 * =============================================================================
 *
 * 🔑 **Διεκδίκηση σε ΜΙΑ συναλλαγή με την παρτίδα**: η παρτίδα ξαναδιαβάζεται και πρέπει να είναι **ανοιχτή**
 *   (`assertImportBatchOpen`) στην ίδια συναλλαγή που γράφει τη μίσθωση ⇒ εγκατάλειψη που προλαβαίνει δεν αφήνει να ξεκινήσει
 *   νέα λήψη. Δύο καρτέλες για την ίδια διεύθυνση: η δεύτερη βλέπει τη ζωντανή μίσθωση (`inFlight`) — ποτέ δύο λήψεις.
 * 🔑 **Σφραγίδα = ο αριθμός προσπάθειας** (fencing token): το κλείσιμο γράφει **μόνο** αν το έγγραφο είναι ακόμη `fetching` με
 *   τον ίδιο αριθμό. Αργή λήψη που έχασε τη μίσθωσή της δεν σβήνει το αποτέλεσμα της νεότερης.
 * 🔑 **Ζωή μίσθωσης** > `maxDuration` της διαδρομής ⇒ αν πέσει ο server στη μέση, η διεύθυνση ξαναμπαίνει μόνη της στην ουρά.
 * Αποτέλεσμα μηχανής (όπως `catalog_import_page_readings`): καμία αναθεώρηση, κανένα ίχνος οντότητας.
 *
 * @module server/catalog/import-asset-fetch-store.server
 */

import type { DocumentReference, Firestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import type { AuthContext } from '@/lib/auth';
import { nowISO } from '@/lib/date-local';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import type { OutboundTransport } from '@/lib/security/outbound-fetch';
import { generateDeterministicCatalogImportAssetFetchId } from '@/services/enterprise-id.service';
import { importAssetFetchFromDocument } from '@/subapps/catalog/import/import-asset-fetch-document';
import { importAssetClaimOf, type ImportAssetRequest } from '@/subapps/catalog/import/import-asset-queue';
import { importAssetFetchKey } from '@/subapps/catalog/import/import-keys';
import type { ImportBatchDefinition } from '@/subapps/catalog/types/catalog-import';
import type { ImportAssetFetchDefinition, ImportAssetFetchFailure, MediaContentFacts, MediaSourceVerdict } from '@/subapps/catalog/types/catalog-media';
import { ASSET_FETCH_LEASE_MS } from '@/subapps/catalog/vocabulary/asset-fetch';
import { readOwned, runCatalogTransaction } from './catalog-store.server';
import { assertImportBatchOpen } from './import-batch-writer.server';

/** Το id της λήψης — ντετερμινιστικό από (χώρος, παρτίδα, κανονικό URI) ⇒ μία λήψη ανά διεύθυνση, δομικά. */
export const importAssetFetchIdOf = (companyId: string, batchId: string, uri: string): string =>
  generateDeterministicCatalogImportAssetFetchId(companyId, importAssetFetchKey(batchId, uri));

const fetchRef = (db: Firestore, ctx: AuthContext, batchId: string, uri: string): DocumentReference =>
  db.collection(COLLECTIONS.CATALOG_IMPORT_ASSET_FETCHES).doc(importAssetFetchIdOf(ctx.companyId, batchId, uri));

/** Οι λήψεις των διευθύνσεων της παρτίδας — με `getAll`, κατά id, χωρίς ερώτημα (άρα χωρίς δείκτη). */
export async function readImportAssetFetches(ctx: AuthContext, batchId: string, uris: readonly string[]): Promise<Map<string, ImportAssetFetchDefinition>> {
  const found = new Map<string, ImportAssetFetchDefinition>();
  if (uris.length === 0) return found;
  const db = getAdminFirestore();
  const snaps = await db.getAll(...uris.map((uri) => fetchRef(db, ctx, batchId, uri)));
  snaps.forEach((snap, index) => {
    const stored = importAssetFetchFromDocument(snap.data(), { companyId: ctx.companyId, batchId, uri: uris[index] });
    if (stored !== null) found.set(uris[index], stored);
  });
  return found;
}

/** Η απάντηση της διεκδίκησης. Μόνο το `claimed` κατεβάζει, με τον αριθμό προσπάθειας ως σφραγίδα. */
export type ImportAssetFetchClaim =
  | { readonly kind: 'claimed'; readonly attempt: number }
  | { readonly kind: 'settled' | 'inFlight'; readonly stored: ImportAssetFetchDefinition };

export interface ImportAssetClaimRequest {
  readonly batchId: string;
  readonly request: ImportAssetRequest;
  readonly retry: boolean;
  readonly now: number;
}

export function claimImportAssetFetch(ctx: AuthContext, claim: ImportAssetClaimRequest): Promise<ImportAssetFetchClaim> {
  const { batchId, request, retry, now } = claim;
  return runCatalogTransaction(ctx, async (scope) => {
    assertImportBatchOpen(await readOwned<ImportBatchDefinition>(scope, 'importBatch', batchId));
    const ref = fetchRef(scope.db, ctx, batchId, request.uri);
    const stored = importAssetFetchFromDocument((await scope.tx.get(ref)).data(), { companyId: ctx.companyId, batchId, uri: request.uri });
    const decision = importAssetClaimOf(stored, now, retry);
    if (decision !== 'claim' && stored !== null) return { kind: decision, stored };
    const attempt = (stored?.attempts ?? 0) + 1;
    const fetching: ImportAssetFetchDefinition = {
      companyId: ctx.companyId, batchId, uri: request.uri, roles: request.roles, status: 'fetching', leaseUntil: now + ASSET_FETCH_LEASE_MS,
      attempts: attempt, failure: null, verdict: null, content: null, transport: null, updatedAt: nowISO(), updatedBy: ctx.uid,
    };
    scope.tx.set(ref, fetching);
    return { kind: 'claimed', attempt };
  });
}

/** Πώς τελείωσε μια λήψη. */
export type ImportAssetFetchOutcome =
  | { readonly status: 'ready'; readonly verdict: MediaSourceVerdict; readonly content: MediaContentFacts; readonly transport: OutboundTransport }
  | { readonly status: 'failed'; readonly failure: ImportAssetFetchFailure; readonly transport: OutboundTransport | null };

/**
 * **Κλείσιμο με σφραγίδα**: γράφει μόνο αν η λήψη είναι ακόμη `fetching` **με αυτόν** τον αριθμό προσπάθειας. Επιστρέφει ό,τι
 * ισχύει μετά (το δικό της αποτέλεσμα, ή της νεότερης προσπάθειας που την πρόλαβε).
 */
export function settleImportAssetFetch(
  ctx: AuthContext,
  target: { readonly batchId: string; readonly uri: string; readonly attempt: number },
  outcome: ImportAssetFetchOutcome,
): Promise<ImportAssetFetchDefinition | null> {
  const db = getAdminFirestore();
  const ref = fetchRef(db, ctx, target.batchId, target.uri);
  return db.runTransaction(async (tx) => {
    const current = importAssetFetchFromDocument((await tx.get(ref)).data(), { companyId: ctx.companyId, batchId: target.batchId, uri: target.uri });
    if (current === null || current.status !== 'fetching' || current.attempts !== target.attempt) return current;
    const settled: ImportAssetFetchDefinition = {
      ...current,
      status: outcome.status,
      leaseUntil: null,
      failure: outcome.status === 'failed' ? outcome.failure : null,
      verdict: outcome.status === 'ready' ? outcome.verdict : null,
      content: outcome.status === 'ready' ? outcome.content : null,
      transport: outcome.transport,
      updatedAt: nowISO(),
      updatedBy: ctx.uid,
    };
    tx.set(ref, settled);
    return settled;
  });
}
