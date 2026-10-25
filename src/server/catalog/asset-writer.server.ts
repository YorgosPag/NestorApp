import 'server-only';

/**
 * Ο **γραφέας μέσων** του καταλόγου (ADR-923 §5.10 Δ9 — Akeneo Asset Manager · Salsify DAM). Το μέσο είναι
 * οντότητα (κωδικός, ρόλος, είδος, δικαιώματα)· τα bytes τα φέρνει η ροή ανεβάσματος (2γ) ως `FileRecord` με κάτοχο
 * το μέσο, και **μόνο** εκείνη γράφει το `fileId`.
 *
 * - Κωδικός **αμετάβλητος**· ρόλος ↔ είδος συμβατά (`validateCatalogAsset`).
 * - Είδος **κλειδωμένο** όσο κάποιο προϊόν δείχνει στο μέσο: ιδιότητα «μόνο εικόνες» δεν μπορεί να βρεθεί
 *   σιωπηλά να δείχνει σε PDF.
 * - Διαγραφή = soft, **μόνο** αν κανείς δεν το χρησιμοποιεί (το «πού χρησιμοποιείται» είναι αντίστροφο).
 * @module server/catalog/asset-writer.server
 */

import type { AuthContext } from '@/lib/auth';
import type { CatalogAssetInput } from '@/subapps/catalog/schema/zod/asset.schema';
import { validateCatalogAsset } from '@/subapps/catalog/schema/validate-catalog-settings';
import type { CatalogAssetDefinition } from '@/subapps/catalog/types/asset';
import { assetInUse } from './catalog-usage-reads.server';
import {
  assertCodeUnchanged,
  assertRevision,
  readForCreate,
  readOwned,
  runCatalogTransaction,
  stageCreate,
  stageReplace,
  stageSoftDelete,
  type StoredCatalogRecord,
} from './catalog-store.server';
import { assertNoIssues, CatalogWriteError } from './catalog-write-error';

type StoredAsset = StoredCatalogRecord<CatalogAssetDefinition>;

export async function createCatalogAsset(ctx: AuthContext, input: CatalogAssetInput): Promise<StoredAsset> {
  return runCatalogTransaction(ctx, async (scope) => {
    const definition: CatalogAssetDefinition = { ...input, fileId: null };
    assertNoIssues(validateCatalogAsset(definition));
    const target = await readForCreate(scope, 'asset', definition.code);
    return stageCreate(scope, 'asset', target, definition);
  });
}

export async function updateCatalogAsset(
  ctx: AuthContext,
  id: string,
  expectedRevision: number,
  input: CatalogAssetInput,
): Promise<StoredAsset> {
  return runCatalogTransaction(ctx, async (scope) => {
    const current = await readOwned<CatalogAssetDefinition>(scope, 'asset', id);
    assertRevision(current, expectedRevision);
    assertCodeUnchanged(current, input.code);
    const definition: CatalogAssetDefinition = { ...input, fileId: current.fileId };
    assertNoIssues(validateCatalogAsset(definition));
    if (definition.kind !== current.kind && (await assetInUse(scope, id))) {
      throw new CatalogWriteError('immutable', [{ code: 'typeLockedInUse', path: 'kind' }]);
    }
    return stageReplace(scope, 'asset', current, definition);
  });
}

export async function deleteCatalogAsset(ctx: AuthContext, id: string, expectedRevision: number): Promise<StoredAsset> {
  return runCatalogTransaction(ctx, async (scope) => {
    const current = await readOwned<CatalogAssetDefinition>(scope, 'asset', id);
    assertRevision(current, expectedRevision);
    if (await assetInUse(scope, id)) throw new CatalogWriteError('inUse');
    return stageSoftDelete(scope, 'asset', current);
  });
}
