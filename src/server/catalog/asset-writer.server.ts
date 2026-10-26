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
 * - 🗂️ **Σύνδεση αρχείου** (2γ, §5.10.3): `fileId` γράφεται **μόνο** εδώ, μόνο αν το `FileRecord` ανήκει σε **αυτό** το
 *   μέσο, ταιριάζει στο είδος, χωρά στο όριο και (για εικόνες) έχει έτοιμες αποδόσεις — `judgeAssetFile`. Νέα έκδοση
 *   αρχείου = νέο `FileRecord` + ξανά σύνδεση· τα προϊόντα δείχνουν το `assetId` και δεν ξαναγράφονται.
 * - Αλλαγή **είδους** με συνδεδεμένο αρχείο ⇒ το αρχείο ξανακρίνεται για το νέο είδος (ένα μέσο «εικόνα» δεν γίνεται
 *   σιωπηλά «έγγραφο» με μια φωτογραφία μέσα).
 * @module server/catalog/asset-writer.server
 */

import { COLLECTIONS } from '@/config/firestore-collections';
import type { AuthContext } from '@/lib/auth';
import { assetFileTypeFactsOf, attachedFileKindIssues, judgeAssetFile, type AssetFileMeasurement } from '@/subapps/catalog/schema/judge-asset-file';
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
  type CatalogTx,
  type StoredCatalogRecord,
} from './catalog-store.server';
import { assertNoIssues, CatalogWriteError } from './catalog-write-error';

type StoredAsset = StoredCatalogRecord<CatalogAssetDefinition>;

/** Το έγγραφο του αρχείου, μέσα στη συναλλαγή — η κρίση πάνω σε ό,τι διαβάστηκε **μαζί** με το μέσο. */
async function readFileRecord(scope: CatalogTx, fileId: string): Promise<Readonly<Record<string, unknown>> | null> {
  const snap = await scope.tx.get(scope.db.collection(COLLECTIONS.FILES).doc(fileId));
  return snap.exists ? (snap.data() ?? null) : null;
}

/** Αλλαγή είδους με συνδεδεμένο αρχείο: το αρχείο πρέπει να ταιριάζει και στο **νέο** είδος. */
async function assertAttachedFileFitsKind(scope: CatalogTx, current: StoredAsset, next: CatalogAssetDefinition): Promise<void> {
  if (current.fileId === null || next.kind === current.kind) return;
  const data = await readFileRecord(scope, current.fileId);
  const issues = data === null ? [] : attachedFileKindIssues(next.kind, assetFileTypeFactsOf(data));
  if (issues.length > 0) throw new CatalogWriteError('invalid', issues);
}

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
    await assertAttachedFileFitsKind(scope, current, definition);
    return stageReplace(scope, 'asset', current, definition);
  });
}

/**
 * **Δένει ένα αρχείο στο μέσο** (ή μια νέα έκδοσή του). Ιδεμπότητο: ίδιο `fileId` ⇒ καμία εγγραφή, καμία νέα αναθεώρηση.
 * @param measurement το μέγεθος του αντικειμένου όπως το **μέτρησε** ο διακομιστής (όχι η δήλωση του πελάτη).
 */
export async function attachCatalogAssetFile(
  ctx: AuthContext,
  id: string,
  expectedRevision: number,
  fileId: string,
  measurement: AssetFileMeasurement,
): Promise<StoredAsset> {
  return runCatalogTransaction(ctx, async (scope) => {
    const current = await readOwned<CatalogAssetDefinition>(scope, 'asset', id);
    if (current.fileId === fileId) return current;
    assertRevision(current, expectedRevision);
    const target = { companyId: scope.ctx.companyId, assetId: id, kind: current.kind };
    assertNoIssues(judgeAssetFile(target, fileId, await readFileRecord(scope, fileId), measurement));
    const { code, role, kind, labels, description, rights } = current;
    return stageReplace(scope, 'asset', current, { code, role, kind, labels, description, rights, fileId });
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
