import 'server-only';

/**
 * Ο **γραφέας προφίλ αντιστοίχισης** (ADR-923 §5.5): αποθηκευμένη αντιστοίχιση στηλών ανά προμηθευτή/αρχείο. Η αναθεώρησή
 * του μπαίνει στο κλειδί της παρτίδας, άρα διορθωμένο προφίλ ξαναπερνά το ίδιο αρχείο.
 * @module server/catalog/import-profile-writer.server
 */

import type { AuthContext } from '@/lib/auth';
import type { ImportProfileDefinition } from '@/subapps/catalog/types/catalog-import';
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

type StoredProfile = StoredCatalogRecord<ImportProfileDefinition>;

export function createImportProfile(ctx: AuthContext, definition: ImportProfileDefinition): Promise<StoredProfile> {
  return runCatalogTransaction(ctx, async (scope) => {
    const target = await readForCreate(scope, 'importProfile', definition.code);
    return stageCreate(scope, 'importProfile', target, definition);
  });
}

export function updateImportProfile(ctx: AuthContext, id: string, expectedRevision: number, definition: ImportProfileDefinition): Promise<StoredProfile> {
  return runCatalogTransaction(ctx, async (scope) => {
    const current = await readOwned<ImportProfileDefinition>(scope, 'importProfile', id);
    assertRevision(current, expectedRevision);
    assertCodeUnchanged(current, definition.code);
    return stageReplace(scope, 'importProfile', current, definition);
  });
}

export function deleteImportProfile(ctx: AuthContext, id: string, expectedRevision: number): Promise<StoredProfile> {
  return runCatalogTransaction(ctx, async (scope) => {
    const current = await readOwned<ImportProfileDefinition>(scope, 'importProfile', id);
    assertRevision(current, expectedRevision);
    return stageSoftDelete(scope, 'importProfile', current);
  });
}
