import 'server-only';

/**
 * =============================================================================
 * ΛΗΨΗ ΜΕΣΩΝ ΜΙΑΣ ΠΑΡΤΙΔΑΣ — ουρά, διεκδίκηση, conditional GET, καραντίνα, ταυτότητα (ADR-934 §5.2.2 Μ-β4)
 * =============================================================================
 *
 * Η ροή μιας διεύθυνσης (`fetchImportAsset`):
 *   1. Η διεύθυνση **πρέπει** να τη ζητά ζωντανή πρόταση της παρτίδας (`importAssetRequestsOf`) — ποτέ αυθαίρετο URL.
 *   2. Διεκδίκηση με μίσθωση σε μία συναλλαγή με την ανοιχτή παρτίδα (`claimImportAssetFetch`). Έτοιμη ⇒ επιστρέφεται ως έχει.
 *   3. **Conditional GET** μόνο όταν το γνωστό περιεχόμενο είναι ακόμη ζωντανό: 304 ⇒ `unchanged` **χωρίς** bytes.
 *   4. Ροή → καραντίνα (`quarantineDownloadedMedia`: κρίση στα πρώτα bytes, όριο μέσα στη ροή) → ταυτότητα διεύθυνσης
 *      (`recordFetchedMediaSource`: νέο · ίδιο περιεχόμενο · αμετάβλητο · νέα έκδοση).
 *   5. Κλείσιμο με σφραγίδα (`settleImportAssetFetch`). Κάθε αποτυχία = **κωδικός** (Μ9) και ξαναδοκιμάσιμη· δεν αγγίζει τιμές.
 *
 * 🔑 **http → https πρώτα** (`scheme: 'https-upgrade'`): επιστροφή σε http μόνο σε αποτυχία μεταφοράς, με `transport: 'insecure'`.
 * 🔑 **Βλάβη ≠ αποτυχία**: βλάβη βάσης/κάδου πετιέται (ο άνθρωπος βλέπει σφάλμα, η μίσθωση λήγει και η διεύθυνση ξαναμπαίνει
 *   μόνη της στην ουρά) — ποτέ δεν γράφεται ως ψεύτικος κωδικός του προμηθευτή.
 *
 * @module server/catalog/import-asset-fetch.server
 */

import type { AuthContext } from '@/lib/auth';
import { nowISO } from '@/lib/date-local';
import { fetchGuardedStream, type GuardedStreamResult, type OutboundTransport } from '@/lib/security/outbound-fetch';
import { canonicalAssetUri } from '@/subapps/catalog/import/asset-uri';
import { importAssetRequestsOf, importAssetViewOf, type ImportAssetRequest } from '@/subapps/catalog/import/import-asset-queue';
import { downloadByteLimitFor } from '@/subapps/catalog/schema/judge-downloaded-asset';
import type { ImportBatchDefinition } from '@/subapps/catalog/types/catalog-import';
import type { FetchImportAssetRequest, ImportAssetsView } from '@/subapps/catalog/types/catalog-import-requests';
import type { CatalogMediaSourceDefinition, ImportAssetView, MediaContentFacts } from '@/subapps/catalog/types/catalog-media';
import {
  ASSET_FETCH_DEADLINE_MS,
  ASSET_FETCH_HEADERS_TIMEOUT_MS,
  ASSET_FETCH_MAX_REDIRECTS,
  assetFetchFailureOf,
  type AssetFetchFailure,
} from '@/subapps/catalog/vocabulary/asset-fetch';
import { ASSET_ROLE_KINDS, type CatalogAssetRole } from '@/subapps/catalog/vocabulary/asset-roles';
import { readOwned, runCatalogTransaction } from './catalog-store.server';
import { CatalogWriteError } from './catalog-write-error';
import {
  claimImportAssetFetch,
  importAssetFetchIdOf,
  readImportAssetFetches,
  settleImportAssetFetch,
  type ImportAssetFetchOutcome,
} from './import-asset-fetch-store.server';
import { assertPurposeAuthority } from './import-batch-writer.server';
import { readBatchProposals } from './import-reads.server';
import { MediaContentUnavailableError, quarantineDownloadedMedia, readKeptMediaContent } from './media-quarantine.server';
import { readMediaSource, recordFetchedMediaSource, recordRevalidatedMediaSource } from './media-source.server';

type StreamResponse = Extract<GuardedStreamResult, { readonly ok: true; readonly notModified: false }>;

/** Οι διευθύνσεις που ζητά η παρτίδα — με τον ίδιο κριτή δικαιώματος με την ανάγνωσή της (ξένο ≡ ανύπαρκτο). */
async function batchRequests(ctx: AuthContext, batchId: string): Promise<ImportAssetRequest[]> {
  const batch = await runCatalogTransaction(ctx, (scope) => readOwned<ImportBatchDefinition>(scope, 'importBatch', batchId));
  await assertPurposeAuthority(ctx, batch.target.purpose);
  return importAssetRequestsOf(await readBatchProposals(ctx, batchId));
}

/** `GET /api/catalog/imports/[id]/assets` — η ουρά της παρτίδας, με την κατάσταση κάθε διεύθυνσης. */
export async function listImportAssets(ctx: AuthContext, batchId: string): Promise<ImportAssetsView> {
  const requests = await batchRequests(ctx, batchId);
  const stored = await readImportAssetFetches(ctx, batchId, requests.map((request) => request.uri));
  const now = Date.now();
  return { assets: requests.map((request) => importAssetViewOf(request, stored.get(request.uri) ?? null, now)) };
}

const failed = (code: AssetFetchFailure, httpStatus: number | null, transport: OutboundTransport | null): ImportAssetFetchOutcome =>
  ({ status: 'failed', failure: { code, httpStatus }, transport });

/** 304: τίποτα δεν κατέβηκε· ό,τι λέμε για το αρχείο βγαίνει από την ήδη ζωντανή εγγραφή του. */
async function revalidated(ctx: AuthContext, request: ImportAssetRequest, role: CatalogAssetRole, kept: MediaContentFacts | null, transport: OutboundTransport): Promise<ImportAssetFetchOutcome> {
  // 304 σε GET χωρίς validators = λάθος του server του προμηθευτή, όχι «αμετάβλητο».
  if (kept === null) return failed('httpError', 304, transport);
  if (!ASSET_ROLE_KINDS[role].includes(kept.kind)) return failed('kindMismatch', null, transport);
  await recordRevalidatedMediaSource(ctx, request.uri, { transport, checkedAt: nowISO() });
  return { status: 'ready', verdict: 'unchanged', content: kept, transport };
}

/** 200: ροή → καραντίνα → ταυτότητα διεύθυνσης. Οι αποτυχίες περιεχομένου δεν έχουν κωδικό HTTP (ο server απάντησε 200). */
async function quarantined(ctx: AuthContext, request: ImportAssetRequest, role: CatalogAssetRole, response: StreamResponse, attemptKey: string): Promise<ImportAssetFetchOutcome> {
  const { transport } = response;
  try {
    const media = { role, uri: request.uri, filename: request.filename, contentType: response.contentType || null, body: response.body, attemptKey };
    const kept = await quarantineDownloadedMedia(ctx, media);
    if (!kept.ok) return failed(kept.failure, null, transport);
    const { fileId, sha256, sizeBytes, kind, ext, contentType, alreadyKept } = kept.content;
    const verdict = await recordFetchedMediaSource(
      ctx,
      { uri: request.uri, etag: response.etag, lastModified: response.lastModified, contentSha256: sha256, contentFileId: fileId, transport, contentAlreadyKept: alreadyKept },
      nowISO(),
    );
    return { status: 'ready', verdict, content: { fileId, sha256, sizeBytes, kind, ext, contentType }, transport };
  } catch (error) {
    // Τα ίδια bytes είναι ήδη στον κάδο ανακύκλωσης: δηλωμένο, ποτέ υιοθέτηση αρχείου που θα σβηστεί (Μ-β5: επαναφορά).
    if (error instanceof MediaContentUnavailableError) return failed('contentUnavailable', null, transport);
    throw error;
  }
}

/** Τα validators μόνο όταν το γνωστό περιεχόμενο ζει ακόμη — αλλιώς ένα 304 θα έδειχνε σε αρχείο που δεν υπάρχει. */
async function knownContent(ctx: AuthContext, uri: string): Promise<{ source: CatalogMediaSourceDefinition; kept: MediaContentFacts } | null> {
  const source = await readMediaSource(ctx, uri);
  const kept = source === null ? null : await readKeptMediaContent(ctx, source.contentFileId, source.contentSha256);
  return source !== null && kept !== null ? { source, kept } : null;
}

async function downloadAsset(ctx: AuthContext, request: ImportAssetRequest, attemptKey: string): Promise<ImportAssetFetchOutcome> {
  const [role] = request.roles;
  if (role === undefined) throw new Error('Import asset request without a role');
  const known = await knownContent(ctx, request.uri);
  const response = await fetchGuardedStream(request.uri, {
    maxBytes: downloadByteLimitFor(role),
    scheme: 'https-upgrade',
    maxRedirects: ASSET_FETCH_MAX_REDIRECTS,
    timeoutMs: ASSET_FETCH_DEADLINE_MS,
    headersTimeoutMs: ASSET_FETCH_HEADERS_TIMEOUT_MS,
    ifNoneMatch: known?.source.etag ?? null,
    ifModifiedSince: known?.source.lastModified ?? null,
  });
  if (!response.ok) return failed(assetFetchFailureOf(response.rejection, response.status), response.status, null);
  if (response.notModified) return revalidated(ctx, request, role, known?.kept ?? null, response.transport);
  return quarantined(ctx, request, role, response, attemptKey);
}

/** `POST /api/catalog/imports/[id]/assets` — κατέβασε **μία** διεύθυνση της παρτίδας (ιδεμπότητο ανά διεύθυνση). */
export async function fetchImportAsset(ctx: AuthContext, batchId: string, body: FetchImportAssetRequest): Promise<ImportAssetView> {
  const uri = canonicalAssetUri(body.uri);
  const request = uri === null ? undefined : (await batchRequests(ctx, batchId)).find((candidate) => candidate.uri === uri);
  if (uri === null || request === undefined) throw new CatalogWriteError('notFound');
  const claim = await claimImportAssetFetch(ctx, { batchId, request, retry: body.retry === true, now: Date.now() });
  if (claim.kind !== 'claimed') return importAssetViewOf(request, claim.stored, Date.now());
  const attemptKey = `${importAssetFetchIdOf(ctx.companyId, batchId, uri)}/${claim.attempt}`;
  const outcome = await downloadAsset(ctx, request, attemptKey);
  const settled = await settleImportAssetFetch(ctx, { batchId, uri, attempt: claim.attempt }, outcome);
  return importAssetViewOf(request, settled, Date.now());
}
