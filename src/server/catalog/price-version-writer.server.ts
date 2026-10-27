import 'server-only';

/**
 * Ο **γραφέας εκδόσεων τιμοκαταλόγου** (ADR-923 §5.11 «3β») — ο κύκλος ζωής `draft → published → superseded`
 * (+ `discarded`) χωρίς τη δημοσίευση (αυτή ζει στο `price-publication.server.ts`).
 *
 * - **Αριθμός** = μεγαλύτερος + 1, διαβασμένος **μέσα** στη συναλλαγή· η ταυτότητα (λίστα + αριθμός) κάνει δύο
 *   ταυτόχρονες «έκδοση 3» να συγκρούονται (`duplicateCode`), όχι να συνυπάρχουν.
 * - «**Από την τρέχουσα**» = σπορά από την **τελευταία δημοσιευμένη**, σε τμήματα, ιδεμπότητα· διακοπή ⇒ η
 *   επανάληψη (`seedPriceListVersion`) συνεχίζει από τον δρομέα.
 * - Μόνο η **πρόχειρη** αλλάζει (ημερομηνία ισχύος · απόρριψη)· δημοσιευμένη ⇒ `versionNotDraft`.
 * @module server/catalog/price-version-writer.server
 */

import type { AuthContext } from '@/lib/auth';
import { priceListVersionKey } from '@/subapps/catalog/pricing/pricing-keys';
import { publishedTimeline } from '@/subapps/catalog/pricing/version-timeline';
import type { CreatePriceVersionRequest, UpdatePriceVersionRequest } from '@/subapps/catalog/types/price-list-requests';
import type { PriceListDefinition, StoredPriceListVersionDefinition } from '@/subapps/catalog/types/price-list';
import {
  assertRevision,
  readForCreate,
  readOwned,
  runCatalogTransaction,
  stageCreate,
  stageReplace,
  type CatalogTx,
} from './catalog-store.server';
import { assertNoIssues, CatalogWriteError } from './catalog-write-error';
import {
  initialVersionDerived,
  readSeedPage,
  stageSeedChunk,
  versionDefinitionOf,
  type StoredPriceVersion,
} from './price-version-aggregate.server';
import { readListVersions, versionRefOf } from './price-version-reads.server';

/** Ασφάλεια βρόχου σποράς: 10.000 τμήματα × 400 = 4 εκατ. γραμμές — πολύ πάνω από κάθε πραγματικό τιμοκατάλογο. */
const MAX_SEED_CHUNKS = 10_000;

/** Η τελευταία δημοσιευμένη έκδοση (η βάση της «νέας από την τρέχουσα»). */
function latestPublishedId(versions: readonly StoredPriceVersion[]): string | null {
  const timeline = publishedTimeline(versions.map(versionRefOf));
  return timeline.length === 0 ? null : timeline[timeline.length - 1].version.id;
}

async function planNewVersion(scope: CatalogTx, priceListId: string, request: CreatePriceVersionRequest) {
  await readOwned<PriceListDefinition>(scope, 'priceList', priceListId);
  const versions = await readListVersions(scope, priceListId);
  const number = versions.reduce((max, version) => Math.max(max, version.number), 0) + 1;
  const basedOnVersionId = request.basedOn === 'latestPublished' ? latestPublishedId(versions) : null;
  if (request.basedOn === 'latestPublished' && basedOnVersionId === null) {
    assertNoIssues([{ code: 'unknownReference', path: 'basedOn' }]);
  }
  return { number, basedOnVersionId };
}

/** `POST /api/catalog/price-lists/[id]/versions` — νέα πρόχειρη· με βάση ⇒ η σπορά τρέχει αμέσως μετά. */
export async function createPriceListVersion(
  ctx: AuthContext,
  priceListId: string,
  request: CreatePriceVersionRequest,
): Promise<StoredPriceVersion> {
  const created = await runCatalogTransaction(ctx, async (scope) => {
    const { number, basedOnVersionId } = await planNewVersion(scope, priceListId, request);
    const target = await readForCreate(scope, 'priceListVersion', priceListVersionKey(priceListId, number));
    const definition: StoredPriceListVersionDefinition = {
      priceListId,
      number,
      status: 'draft',
      validFrom: request.validFrom,
      basedOnVersionId,
      seal: null,
      derived: initialVersionDerived(basedOnVersionId),
    };
    return stageCreate(scope, 'priceListVersion', target, definition);
  });
  return created.derived.seed === null ? created : seedPriceListVersion(ctx, created.id);
}

/** Ένα τμήμα σποράς στη δική του συναλλαγή· επιστρέφει την έκδοση μετά το τμήμα. */
function seedOneChunk(ctx: AuthContext, versionId: string): Promise<StoredPriceVersion> {
  return runCatalogTransaction(ctx, async (scope) => {
    const version = await readOwned<StoredPriceListVersionDefinition>(scope, 'priceListVersion', versionId);
    const seed = version.derived.seed;
    if (version.status !== 'draft' || seed === null || seed.done) return version;
    const page = await readSeedPage(scope, seed.fromVersionId, seed.cursor);
    return stageSeedChunk(scope, version, page);
  });
}

/** `POST /api/catalog/price-list-versions/[id]/seed` — ιδεμπότητη: συνεχίζει από τον δρομέα μέχρι το τέλος. */
export async function seedPriceListVersion(ctx: AuthContext, versionId: string): Promise<StoredPriceVersion> {
  for (let chunk = 0; chunk < MAX_SEED_CHUNKS; chunk++) {
    const version = await seedOneChunk(ctx, versionId);
    if (version.status !== 'draft' || version.derived.seed === null || version.derived.seed.done) return version;
  }
  throw new Error(`price list version ${versionId}: seed did not finish within ${MAX_SEED_CHUNKS} chunks`);
}

async function readDraft(scope: CatalogTx, id: string, expectedRevision: number): Promise<StoredPriceVersion> {
  const current = await readOwned<StoredPriceListVersionDefinition>(scope, 'priceListVersion', id);
  assertRevision(current, expectedRevision);
  if (current.status !== 'draft') throw new CatalogWriteError('immutable', [{ code: 'versionNotDraft', path: 'status' }]);
  return current;
}

/** Ο ορισμός της έκδοσης όπως είναι, με αλλαγμένα **μόνο** όσα επιτρέπει η πράξη. */
function versionWith(
  current: StoredPriceVersion,
  patch: Pick<StoredPriceListVersionDefinition, 'status' | 'validFrom'>,
): StoredPriceListVersionDefinition {
  return { ...versionDefinitionOf(current), ...patch };
}

/** `PUT /api/catalog/price-list-versions/[id]` — από πότε ισχύει (μόνο πρόχειρη). */
export async function updatePriceListVersion(
  ctx: AuthContext,
  id: string,
  request: UpdatePriceVersionRequest,
): Promise<StoredPriceVersion> {
  return runCatalogTransaction(ctx, async (scope) => {
    const current = await readDraft(scope, id, request.expectedRevision);
    return stageReplace(scope, 'priceListVersion', current, versionWith(current, { status: 'draft', validFrom: request.validFrom }));
  });
}

/** `POST /api/catalog/price-list-versions/[id]/discard` — η πρόχειρη εγκαταλείπεται (μένει στο ιστορικό). */
export async function discardPriceListVersion(ctx: AuthContext, id: string, expectedRevision: number): Promise<StoredPriceVersion> {
  return runCatalogTransaction(ctx, async (scope) => {
    const current = await readDraft(scope, id, expectedRevision);
    return stageReplace(scope, 'priceListVersion', current, versionWith(current, { status: 'discarded', validFrom: current.validFrom }));
  });
}
