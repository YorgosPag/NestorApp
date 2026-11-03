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
import { validateQuoteIntake, validateSupplierProfile } from '@/subapps/catalog/schema/validate-supplier-profile';
import { storedQuoteIntakeOf } from '@/subapps/catalog/schema/zod/supplier-profile.schema';
import type { CatalogAssetDefinition } from '@/subapps/catalog/types/asset';
import {
  EMPTY_SUPPLIER_PROFILE,
  type CatalogQuoteIntake,
  type CatalogSupplierProfileDefinition,
  type CatalogSupplierProfileStored,
} from '@/subapps/catalog/types/supplier-profile';
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

type StoredProfile = StoredCatalogRecord<CatalogSupplierProfileStored>;

async function unknownAssetIssues(scope: CatalogTx, definition: CatalogSupplierProfileDefinition): Promise<readonly CatalogIssue[]> {
  const assetIds = definition.projects.flatMap((project) => project.assetIds);
  const known = await readActiveByIds<CatalogAssetDefinition>(scope, 'asset', assetIds);
  return definition.projects.flatMap((project, index) => project.assetIds.flatMap((assetId, position) =>
    known.has(assetId) ? [] : [{ code: 'unknownReference' as const, path: `projects[${index}].assetIds[${position}]` }]));
}

/**
 * Ένα CAS, δύο πράξεις: καθεμία φέρνει το δικό της κομμάτι και κρατά το άλλο από το τρέχον έγγραφο. Έτσι ένας πελάτης που
 * αποθηκεύει το προφίλ δεν σβήνει ποτέ το opt-in, ούτε αντίστροφα.
 */
async function stageProfile(
  scope: CatalogTx,
  expectedRevision: number,
  build: (current: CatalogSupplierProfileStored | null) => Promise<CatalogSupplierProfileStored>,
): Promise<StoredProfile> {
  const { target, current } = await readSingleton<CatalogSupplierProfileStored>(scope, 'supplierProfile');
  assertRevision({ revision: current?.revision ?? 0 }, expectedRevision);
  const stored = await build(current);
  enrolCompanyInPublicSweepInTx(scope.tx, scope.db, scope.ctx.companyId);
  return current ? stageReplace(scope, 'supplierProfile', current, stored) : stageCreate(scope, 'supplierProfile', target, stored);
}

export async function saveSupplierProfile(ctx: AuthContext, expectedRevision: number, definition: CatalogSupplierProfileDefinition): Promise<StoredProfile> {
  assertNoIssues(validateSupplierProfile(definition));
  return runCatalogTransaction(ctx, (scope) => stageProfile(scope, expectedRevision, async (current) => {
    assertNoIssues(await unknownAssetIssues(scope, definition));
    return { description: definition.description, projects: definition.projects, quoteIntake: storedQuoteIntakeOf(current?.quoteIntake) };
  }));
}

/** Η ρύθμιση αιτημάτων προσφοράς (ADR-923 §5.13 Ε6β). Η δημόσια προβολή παίρνει μόνο το «δέχεται», από το `noteWrite`. */
export async function saveQuoteIntake(ctx: AuthContext, expectedRevision: number, intake: CatalogQuoteIntake): Promise<StoredProfile> {
  assertNoIssues(validateQuoteIntake(intake));
  return runCatalogTransaction(ctx, (scope) => stageProfile(scope, expectedRevision, async (current) => {
    const content = current ?? EMPTY_SUPPLIER_PROFILE;
    return { description: content.description, projects: content.projects, quoteIntake: { enabled: intake.enabled, recipientEmail: intake.recipientEmail } };
  }));
}
