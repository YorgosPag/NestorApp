import 'server-only';

/**
 * Ο **γραφέας του προφίλ παρόχου** (ADR-923 §22 Υ8): ένα έγγραφο ανά χώρο, με CAS, από τη μηχανή του καταλόγου.
 *
 * 🔑 Η μηχανή σημειώνει το scope `profile` από το `noteWrite`, άρα δημόσια προβολή και ιστορικό δεν γράφονται εδώ.
 * 🔒 Μέσο που δεν είναι ενεργό στον ίδιο χώρο απορρίπτεται με εύρημα. Το αν επιτρέπεται να φανεί δημόσια το κρίνει η προβολή, κάθε
 *    φορά: άδεια που λήγει αργότερα δεν είναι λάθος αποθήκευσης.
 *
 * @module server/catalog/supplier-profile-writer.server
 */

import type { AuthContext } from '@/lib/auth';
import type { CatalogIssue } from '@/subapps/catalog/schema/catalog-issues';
import { validateSupplierProfile } from '@/subapps/catalog/schema/validate-supplier-profile';
import type { CatalogAssetDefinition } from '@/subapps/catalog/types/asset';
import type { CatalogSupplierProfileDefinition } from '@/subapps/catalog/types/supplier-profile';
import { readActiveByIds } from './catalog-library-reads.server';
import {
  assertRevision,
  readSingleton,
  runCatalogTransaction,
  stageCreate,
  stageReplace,
  type CatalogTx,
  type StoredCatalogRecord,
} from './catalog-store.server';
import { assertNoIssues } from './catalog-write-error';
import { enrolCompanyInPublicSweepInTx } from './public/public-outbox.server';

type StoredProfile = StoredCatalogRecord<CatalogSupplierProfileDefinition>;

async function unknownAssetIssues(scope: CatalogTx, definition: CatalogSupplierProfileDefinition): Promise<readonly CatalogIssue[]> {
  const assetIds = definition.projects.flatMap((project) => project.assetIds);
  const known = await readActiveByIds<CatalogAssetDefinition>(scope, 'asset', assetIds);
  return definition.projects.flatMap((project, index) => project.assetIds.flatMap((assetId, position) =>
    known.has(assetId) ? [] : [{ code: 'unknownReference' as const, path: `projects[${index}].assetIds[${position}]` }]));
}

export async function saveSupplierProfile(ctx: AuthContext, expectedRevision: number, definition: CatalogSupplierProfileDefinition): Promise<StoredProfile> {
  assertNoIssues(validateSupplierProfile(definition));
  return runCatalogTransaction(ctx, async (scope) => {
    const { target, current } = await readSingleton<CatalogSupplierProfileDefinition>(scope, 'supplierProfile');
    assertRevision({ revision: current?.revision ?? 0 }, expectedRevision);
    assertNoIssues(await unknownAssetIssues(scope, definition));
    enrolCompanyInPublicSweepInTx(scope.tx, scope.db, scope.ctx.companyId);
    const stored: CatalogSupplierProfileDefinition = { description: definition.description, projects: definition.projects };
    return current ? stageReplace(scope, 'supplierProfile', current, stored) : stageCreate(scope, 'supplierProfile', target, stored);
  });
}
