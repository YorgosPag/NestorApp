import 'server-only';

/**
 * Ο **γραφέας οικογενειών μέτρησης του χώρου** (ADR-923 §5.2) — οι της πλατφόρμας ζουν σε κώδικα και
 * **δεν** γράφονται ποτέ. Κωδικοί πλατφόρμας δεσμευμένοι· η οικογένεια του χώρου είναι **μη συγκρίσιμη**
 * ως την έγκριση του §17 (το `comparable` δεν αποθηκεύεται — παράγεται κατά την ανάγνωση).
 * Όσο τη χρησιμοποιεί ιδιότητα: append-only μονάδες (`validateMeasurementFamilyEvolution`)· διαγραφή απαγορεύεται.
 * @module server/catalog/measurement-family-writer.server
 */

import type { AuthContext } from '@/lib/auth';
import { fromWorkspaceDefinition } from '@/subapps/catalog/measurement/measurement-registry';
import { validateMeasurementFamilyEvolution } from '@/subapps/catalog/measurement/measurement-family-evolution';
import { validateMeasurementFamily } from '@/subapps/catalog/measurement/validate-measurement-family';
import type { WorkspaceMeasurementFamilyDefinition } from '@/subapps/catalog/types/measurement-family';
import { hasAnyLocalizedText } from '@/i18n/localized-text';
import { measurementFamilyInUse } from './catalog-library-reads.server';
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

type StoredFamily = StoredCatalogRecord<WorkspaceMeasurementFamilyDefinition>;

function assertValid(definition: WorkspaceMeasurementFamilyDefinition): void {
  const issues = [...validateMeasurementFamily(fromWorkspaceDefinition(definition), { forbidPlatformCodes: true })];
  if (!hasAnyLocalizedText(definition.labels)) issues.push({ code: 'labelRequired', path: 'labels' });
  assertNoIssues(issues);
}

export async function createCatalogMeasurementFamily(
  ctx: AuthContext,
  definition: WorkspaceMeasurementFamilyDefinition,
): Promise<StoredFamily> {
  assertValid(definition);
  return runCatalogTransaction(ctx, async (scope) => {
    const target = await readForCreate(scope, 'measurementFamily', definition.code);
    return stageCreate(scope, 'measurementFamily', target, definition);
  });
}

export async function updateCatalogMeasurementFamily(
  ctx: AuthContext,
  id: string,
  expectedRevision: number,
  definition: WorkspaceMeasurementFamilyDefinition,
): Promise<StoredFamily> {
  assertValid(definition);
  return runCatalogTransaction(ctx, async (scope) => {
    const current = await readOwned<WorkspaceMeasurementFamilyDefinition>(scope, 'measurementFamily', id);
    assertRevision(current, expectedRevision);
    assertCodeUnchanged(current, definition.code);
    if (await measurementFamilyInUse(scope, current.code)) {
      assertNoIssues(validateMeasurementFamilyEvolution(current, definition));
    }
    return stageReplace(scope, 'measurementFamily', current, definition);
  });
}

export async function deleteCatalogMeasurementFamily(ctx: AuthContext, id: string, expectedRevision: number): Promise<StoredFamily> {
  return runCatalogTransaction(ctx, async (scope) => {
    const current = await readOwned<WorkspaceMeasurementFamilyDefinition>(scope, 'measurementFamily', id);
    assertRevision(current, expectedRevision);
    if (await measurementFamilyInUse(scope, current.code)) throw new CatalogWriteError('inUse');
    return stageSoftDelete(scope, 'measurementFamily', current);
  });
}
