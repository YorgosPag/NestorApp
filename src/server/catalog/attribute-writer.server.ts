import 'server-only';

/**
 * Ο **γραφέας ιδιοτήτων** της βιβλιοθήκης (ADR-923 §5.2) — οι κανόνες του τομέα πάνω από τη μηχανή:
 *
 * - `code` **αμετάβλητο** (Akeneo code · Revit GUID)· `type` **αμετάβλητο όσο το χρησιμοποιεί οικογένεια**.
 * - Η ομάδα πρέπει να υπάρχει **στον ίδιο χώρο**.
 * - 🔑 **Καμία αλλαγή δεν σπάει σιωπηλά οικογένεια**: κάθε ενημέρωση ξαναεπικυρώνει **μέσα στη συναλλαγή**
 *   όσες οικογένειες χρησιμοποιούν την ιδιότητα, με τη νέα της μορφή. Π.χ. αφαίρεση της επιλογής `mfp_34`
 *   που χρησιμοποιεί ένα φίλτρο άξονα του πίνακα ⇒ 409 με τα ευρήματα της οικογένειας, όχι κενή γραμμή στον
 *   τυπωμένο κατάλογο (Figma: η αλλαγή component δεν σπάει instances).
 * - Διαγραφή = soft, **μόνο** αν καμία οικογένεια δεν τη χρησιμοποιεί.
 * - 🔒 Από τη Φάση 2 (ADR-923 §5.10 Θωράκιση 3): με **τιμές**, κλειδώνουν `localizable` · `scopable` · `unique` ·
 *   οικογένεια μέτρησης και η αφαίρεση επιλογής σε χρήση (`schema-product-locks.server.ts`).
 * @module server/catalog/attribute-writer.server
 */

import type { AuthContext } from '@/lib/auth';
import type { MeasurementRegistry } from '@/subapps/catalog/measurement/measurement-registry';
import type { CatalogIssue } from '@/subapps/catalog/schema/catalog-issues';
import { validateAttribute } from '@/subapps/catalog/schema/validate-attribute';
import { validateFamily } from '@/subapps/catalog/schema/validate-family';
import {
  deriveAttributeMeasurementFamilyCodes,
  type CatalogAttributeDefinition,
  type StoredCatalogAttributeDefinition,
} from '@/subapps/catalog/types/attribute';
import type { StoredCatalogFamilyDefinition } from '@/subapps/catalog/types/family';
import {
  readAttributesByIds,
  readFamiliesUsingAttribute,
  readMeasurementRegistry,
} from './catalog-library-reads.server';
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
import { assertAttributeChangeKeepsValues } from './schema-product-locks.server';

type StoredAttribute = StoredCatalogRecord<StoredCatalogAttributeDefinition>;

function toStored(definition: CatalogAttributeDefinition): StoredCatalogAttributeDefinition {
  return { ...definition, measurementFamilyCodes: deriveAttributeMeasurementFamilyCodes(definition) };
}

async function validateAgainstLibrary(
  scope: CatalogTx,
  definition: CatalogAttributeDefinition,
): Promise<MeasurementRegistry> {
  await readOwned(scope, 'attributeGroup', definition.groupId);
  const registry = await readMeasurementRegistry(scope);
  assertNoIssues(validateAttribute(definition, registry));
  return registry;
}

/** Ξαναεπικυρώνει κάθε οικογένεια που χρησιμοποιεί την ιδιότητα, με τη **νέα** της μορφή. */
async function assertFamiliesStayValid(
  scope: CatalogTx,
  attributeId: string,
  next: CatalogAttributeDefinition,
  families: readonly StoredCatalogRecord<StoredCatalogFamilyDefinition>[],
  registry: MeasurementRegistry,
): Promise<void> {
  if (families.length === 0) return;
  const library = await readAttributesByIds(scope, families.flatMap((family) => family.attributeIds));
  library.set(attributeId, next);
  const issues: CatalogIssue[] = [];
  for (const family of families) {
    for (const issue of validateFamily(family, library, registry)) {
      issues.push({ ...issue, path: `families.${family.code}.${issue.path}` });
    }
  }
  if (issues.length > 0) throw new CatalogWriteError('inUse', issues, { families: families.length });
}

export async function createCatalogAttribute(ctx: AuthContext, definition: CatalogAttributeDefinition): Promise<StoredAttribute> {
  return runCatalogTransaction(ctx, async (scope) => {
    const target = await readForCreate(scope, 'attribute', definition.code);
    await validateAgainstLibrary(scope, definition);
    return stageCreate(scope, 'attribute', target, toStored(definition));
  });
}

export async function updateCatalogAttribute(
  ctx: AuthContext,
  id: string,
  expectedRevision: number,
  definition: CatalogAttributeDefinition,
): Promise<StoredAttribute> {
  return runCatalogTransaction(ctx, async (scope) => {
    const current = await readOwned<StoredCatalogAttributeDefinition>(scope, 'attribute', id);
    assertRevision(current, expectedRevision);
    assertCodeUnchanged(current, definition.code);
    const families = await readFamiliesUsingAttribute(scope, id);
    if (definition.type !== current.type && families.length > 0) {
      throw new CatalogWriteError('immutable', [{ code: 'typeLockedInUse', path: 'type' }], { families: families.length });
    }
    const registry = await validateAgainstLibrary(scope, definition);
    await assertFamiliesStayValid(scope, id, definition, families, registry);
    await assertAttributeChangeKeepsValues(scope, id, current, definition);
    return stageReplace(scope, 'attribute', current, toStored(definition));
  });
}

export async function deleteCatalogAttribute(ctx: AuthContext, id: string, expectedRevision: number): Promise<StoredAttribute> {
  return runCatalogTransaction(ctx, async (scope) => {
    const current = await readOwned<StoredCatalogAttributeDefinition>(scope, 'attribute', id);
    assertRevision(current, expectedRevision);
    const families = await readFamiliesUsingAttribute(scope, id);
    if (families.length > 0) throw new CatalogWriteError('inUse', [], { families: families.length });
    return stageSoftDelete(scope, 'attribute', current);
  });
}
