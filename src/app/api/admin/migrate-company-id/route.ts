/**
 * =============================================================================
 * MIGRATE COMPANY ID — Legacy pzNUy8ksddGCtcQMqumR → Enterprise comp_xxx
 * =============================================================================
 *
 * @purpose One-time migration of the legacy Firestore auto-ID to enterprise format
 * @since 2026-03-13
 * @protection withAuth + super_admin only
 * @classification System-level migration operation
 *
 * @method GET  - Dry-run: shows what WOULD change without modifying anything
 * @method POST - Execute: performs the full migration
 *
 * Steps:
 *  1. Generate new enterprise company ID (comp_xxx)
 *  2. Create new company document at companies/{newId}
 *  3. Update Firebase custom claims for all users
 *  4. Update companyId field across ALL Firestore collections
 *  5. Migrate RBAC subcollections (audit_logs, members, grants)
 *  6. Delete old phantom company document
 *
 * @see ADR-210: Enterprise ID Standardization
 * =============================================================================
 */

import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore, getAdminAuth, FieldValue } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { FIELDS } from '@/config/firestore-field-constants';
import { LEGACY_TENANT_COMPANY_ID } from '@/config/tenant';
import { generateCompanyId } from '@/services/enterprise-id.service';
import { withAuth, logSystemOperation, extractRequestMetadata } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';

const logger = createModuleLogger('MigrateCompanyId');

/** Maximum operations per Firestore batch write */
const BATCH_LIMIT = 450; // Conservative, Firestore max is 500

// =============================================================================
// TYPES
// =============================================================================

interface CollectionMigrationResult {
  collection: string;
  documentsFound: number;
  documentsUpdated: number;
  errors: string[];
}

interface SubcollectionMigrationResult {
  path: string;
  documentsCopied: number;
  documentsDeleted: number;
  errors: string[];
}

interface MigrationReport {
  oldCompanyId: string;
  newCompanyId: string;
  dryRun: boolean;
  timestamp: string;
  steps: {
    companyDocument: { status: string; details: string };
    customClaims: { status: string; usersUpdated: number; details: string };
    collections: CollectionMigrationResult[];
    subcollections: SubcollectionMigrationResult[];
    cleanup: { status: string; details: string };
  };
  totalDocumentsUpdated: number;
  errors: string[];
}

// =============================================================================
// COLLECTIONS TO MIGRATE (companyId field)
// =============================================================================

/** Collections where documents have a `companyId` field to update */
const COLLECTIONS_WITH_COMPANY_ID = [
  { key: 'PROJECTS' as const, name: 'projects' },
  { key: 'BUILDINGS' as const, name: 'buildings' },
  { key: 'CONTACTS' as const, name: 'contacts' },
  { key: 'UNITS' as const, name: 'units' },
  { key: 'FILES' as const, name: 'files' },
  { key: 'CONVERSATIONS' as const, name: 'conversations' },
  { key: 'MESSAGES' as const, name: 'messages' },
  { key: 'TASKS' as const, name: 'tasks' },
  { key: 'OBLIGATIONS' as const, name: 'obligations' },
  { key: 'LEADS' as const, name: 'leads' },
  { key: 'OPPORTUNITIES' as const, name: 'opportunities' },
  { key: 'ACTIVITIES' as const, name: 'activities' },
  { key: 'COMMUNICATIONS' as const, name: 'communications' },
  { key: 'AI_PIPELINE_QUEUE' as const, name: 'ai_pipeline_queue' },
  { key: 'FLOORS' as const, name: 'floors' },
  { key: 'PARKING_SPACES' as const, name: 'parking_spots' },
  { key: 'STORAGE' as const, name: 'storage_units' },
] as const;

/** navigation_companies uses `contactId` instead of `companyId` */
const NAVIGATION_COLLECTION = COLLECTIONS.NAVIGATION; // 'navigation_companies'

// =============================================================================
// HELPER: Batch update companyId in a collection
// =============================================================================

async function migrateCollection(
  db: FirebaseFirestore.Firestore,
  collectionName: string,
  oldId: string,
  newId: string,
  dryRun: boolean,
  fieldName: string = 'companyId'
): Promise<CollectionMigrationResult> {
  const result: CollectionMigrationResult = {
    collection: collectionName,
    documentsFound: 0,
    documentsUpdated: 0,
    errors: [],
  };

  try {
    const snapshot = await db
      .collection(collectionName)
      .where(fieldName, '==', oldId)
      .get();

    result.documentsFound = snapshot.size;

    if (dryRun || snapshot.empty) {
      return result;
    }

    // Batch write in chunks of BATCH_LIMIT
    const docs = snapshot.docs;
    for (let i = 0; i < docs.length; i += BATCH_LIMIT) {
      const batch = db.batch();
      const chunk = docs.slice(i, i + BATCH_LIMIT);

      for (const doc of chunk) {
        batch.update(doc.ref, { [fieldName]: newId });
      }

      await batch.commit();
      result.documentsUpdated += chunk.length;
    }

    logger.info(`[MigrateCompanyId] Collection "${collectionName}": ${result.documentsUpdated}/${result.documentsFound} docs updated`);
  } catch (error) {
    const msg = `Collection "${collectionName}": ${getErrorMessage(error)}`;
    result.errors.push(msg);
    logger.error(`[MigrateCompanyId] ${msg}`);
  }

  return result;
}

// =============================================================================
// HELPER: Copy subcollection documents from old path to new path, delete old
// =============================================================================

async function migrateSubcollection(
  db: FirebaseFirestore.Firestore,
  oldParentPath: string,
  newParentPath: string,
  subcollectionName: string,
  dryRun: boolean
): Promise<SubcollectionMigrationResult> {
  const oldPath = `${oldParentPath}/${subcollectionName}`;
  const newPath = `${newParentPath}/${subcollectionName}`;

  const result: SubcollectionMigrationResult = {
    path: oldPath,
    documentsCopied: 0,
    documentsDeleted: 0,
    errors: [],
  };

  try {
    const snapshot = await db.collection(oldPath).get();
    result.documentsCopied = snapshot.size;

    if (dryRun || snapshot.empty) {
      return result;
    }

    // Copy to new path in batches
    const docs = snapshot.docs;
    for (let i = 0; i < docs.length; i += BATCH_LIMIT) {
      const batch = db.batch();
      const chunk = docs.slice(i, i + BATCH_LIMIT);

      for (const doc of chunk) {
        const newDocRef = db.collection(newPath).doc(doc.id);
        batch.set(newDocRef, doc.data());
      }

      await batch.commit();
    }

    // Delete old documents in batches
    for (let i = 0; i < docs.length; i += BATCH_LIMIT) {
      const batch = db.batch();
      const chunk = docs.slice(i, i + BATCH_LIMIT);

      for (const doc of chunk) {
        batch.delete(doc.ref);
      }

      await batch.commit();
      result.documentsDeleted += chunk.length;
    }

    logger.info(`[MigrateCompanyId] Subcollection "${oldPath}": ${result.documentsCopied} docs copied, ${result.documentsDeleted} deleted`);
  } catch (error) {
    const msg = `Subcollection "${oldPath}": ${getErrorMessage(error)}`;
    result.errors.push(msg);
    logger.error(`[MigrateCompanyId] ${msg}`);
  }

  return result;
}

// =============================================================================
// HELPER: Recursively find and migrate nested subcollections
// =============================================================================

async function migrateNestedSubcollections(
  db: FirebaseFirestore.Firestore,
  oldParentPath: string,
  newParentPath: string,
  parentSubcollection: string,
  childSubcollection: string,
  dryRun: boolean
): Promise<SubcollectionMigrationResult[]> {
  const results: SubcollectionMigrationResult[] = [];

  try {
    // Get all documents in the parent subcollection (e.g., /companies/{old}/projects/*)
    const parentSnapshot = await db.collection(`${oldParentPath}/${parentSubcollection}`).get();

    for (const parentDoc of parentSnapshot.docs) {
      // For each parent doc, migrate the child subcollection
      // e.g., /companies/{old}/projects/{projId}/members/* → /companies/{new}/projects/{projId}/members/*
      const oldNestedPath = `${oldParentPath}/${parentSubcollection}/${parentDoc.id}`;
      const newNestedPath = `${newParentPath}/${parentSubcollection}/${parentDoc.id}`;

      // First copy the parent document itself
      if (!dryRun) {
        const newParentDocRef = db.doc(`${newParentPath}/${parentSubcollection}/${parentDoc.id}`);
        await newParentDocRef.set(parentDoc.data());
      }

      const childResult = await migrateSubcollection(
        db, oldNestedPath, newNestedPath, childSubcollection, dryRun
      );
      results.push(childResult);
    }

    // Clean up parent docs in old path
    if (!dryRun && !parentSnapshot.empty) {
      for (let i = 0; i < parentSnapshot.docs.length; i += BATCH_LIMIT) {
        const batch = db.batch();
        const chunk = parentSnapshot.docs.slice(i, i + BATCH_LIMIT);
        for (const doc of chunk) {
          batch.delete(doc.ref);
        }
        await batch.commit();
      }
    }
  } catch (error) {
    results.push({
      path: `${oldParentPath}/${parentSubcollection}/.../${childSubcollection}`,
      documentsCopied: 0,
      documentsDeleted: 0,
      errors: [`Nested migration failed: ${getErrorMessage(error)}`],
    });
  }

  return results;
}

// =============================================================================
// CORE MIGRATION LOGIC
// =============================================================================

async function executeMigration(
  ctx: AuthContext,
  dryRun: boolean
): Promise<MigrationReport> {
  const oldId = LEGACY_TENANT_COMPANY_ID;
  const newId = generateCompanyId(); // comp_xxx

  const report: MigrationReport = {
    oldCompanyId: oldId,
    newCompanyId: newId,
    dryRun,
    timestamp: new Date().toISOString(),
    steps: {
      companyDocument: { status: 'pending', details: '' },
      customClaims: { status: 'pending', usersUpdated: 0, details: '' },
      collections: [],
      subcollections: [],
      cleanup: { status: 'pending', details: '' },
    },
    totalDocumentsUpdated: 0,
    errors: [],
  };

  const db = getAdminFirestore();

  // =========================================================================
  // STEP 1: Create new company document
  // =========================================================================

  try {
    // Read data from the old contacts document (the company contact)
    const contactSnap = await db.collection(COLLECTIONS.CONTACTS).doc(oldId).get();
    const contactData = contactSnap.exists ? contactSnap.data() : null;

    const companyName = contactData?.name ?? contactData?.displayName ?? 'ΠΑΓΩΝΗΣ';

    if (!dryRun) {
      // Check if old company doc exists and read its data
      const oldCompanySnap = await db.collection(COLLECTIONS.COMPANIES).doc(oldId).get();
      const oldCompanyData = oldCompanySnap.exists ? oldCompanySnap.data() : null;

      const newCompanyDoc = {
        name: oldCompanyData?.name ?? companyName,
        contactId: oldId, // FK to contacts collection
        status: oldCompanyData?.status ?? 'active',
        plan: oldCompanyData?.plan ?? 'free',
        settings: oldCompanyData?.settings ?? {
          defaultLocale: 'el',
          timezone: 'Europe/Athens',
          features: {},
        },
        createdAt: oldCompanyData?.createdAt ?? FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        createdBy: oldCompanyData?.createdBy ?? ctx.uid,
        migratedFrom: oldId,
        migratedAt: FieldValue.serverTimestamp(),
      };

      await db.collection(COLLECTIONS.COMPANIES).doc(newId).set(newCompanyDoc);
    }

    report.steps.companyDocument = {
      status: 'success',
      details: `Company document ${dryRun ? 'would be' : 'was'} created at companies/${newId} (name: ${companyName})`,
    };
  } catch (error) {
    const msg = `Step 1 (company document): ${getErrorMessage(error)}`;
    report.steps.companyDocument = { status: 'error', details: msg };
    report.errors.push(msg);
    // Non-fatal — continue with migration
  }

  // =========================================================================
  // STEP 2: Update Firebase custom claims for ALL users in this company
  // =========================================================================

  try {
    const auth = getAdminAuth();

    // Find all users with this companyId in their claims
    const usersSnap = await db
      .collection(COLLECTIONS.USERS)
      .where(FIELDS.COMPANY_ID, '==', oldId)
      .get();

    let usersUpdated = 0;

    for (const userDoc of usersSnap.docs) {
      const uid = userDoc.id;

      if (!dryRun) {
        // Get current claims
        const firebaseUser = await auth.getUser(uid);
        const currentClaims = firebaseUser.customClaims ?? {};

        // Update companyId in claims
        await auth.setCustomUserClaims(uid, {
          ...currentClaims,
          companyId: newId,
        });

        // Update Firestore /users/{uid} document
        await db.collection(COLLECTIONS.USERS).doc(uid).update({
          companyId: newId,
          updatedAt: FieldValue.serverTimestamp(),
        });
      }

      usersUpdated++;
    }

    report.steps.customClaims = {
      status: 'success',
      usersUpdated,
      details: `${usersUpdated} user(s) ${dryRun ? 'would be' : 'were'} updated with new companyId in claims + Firestore`,
    };
  } catch (error) {
    const msg = `Step 2 (custom claims): ${getErrorMessage(error)}`;
    report.steps.customClaims = { status: 'error', usersUpdated: 0, details: msg };
    report.errors.push(msg);
  }

  // =========================================================================
  // STEP 3: Update companyId across ALL collections
  // =========================================================================

  for (const col of COLLECTIONS_WITH_COMPANY_ID) {
    const collectionName = COLLECTIONS[col.key];
    const result = await migrateCollection(db, collectionName, oldId, newId, dryRun);
    report.steps.collections.push(result);
    report.totalDocumentsUpdated += result.documentsUpdated;
  }

  // Special: navigation_companies uses `contactId` instead of `companyId`
  const navResult = await migrateCollection(
    db, NAVIGATION_COLLECTION, oldId, newId, dryRun, 'contactId'
  );
  report.steps.collections.push(navResult);
  report.totalDocumentsUpdated += navResult.documentsUpdated;

  // =========================================================================
  // STEP 4: Migrate RBAC subcollections
  // =========================================================================

  const oldCompanyPath = `${COLLECTIONS.COMPANIES}/${oldId}`;
  const newCompanyPath = `${COLLECTIONS.COMPANIES}/${newId}`;

  // 4a: Direct subcollections — audit_logs
  const auditResult = await migrateSubcollection(
    db, oldCompanyPath, newCompanyPath, 'audit_logs', dryRun
  );
  report.steps.subcollections.push(auditResult);

  // 4b: Nested — /companies/{id}/projects/{projId}/members/*
  const projectMemberResults = await migrateNestedSubcollections(
    db, oldCompanyPath, newCompanyPath, 'projects', 'members', dryRun
  );
  report.steps.subcollections.push(...projectMemberResults);

  // 4c: Nested — /companies/{id}/units/{unitId}/grants/*
  const unitGrantResults = await migrateNestedSubcollections(
    db, oldCompanyPath, newCompanyPath, 'units', 'grants', dryRun
  );
  report.steps.subcollections.push(...unitGrantResults);

  // =========================================================================
  // STEP 5: Cleanup — delete old company document
  // =========================================================================

  try {
    if (!dryRun) {
      const oldCompanyRef = db.collection(COLLECTIONS.COMPANIES).doc(oldId);
      const oldDoc = await oldCompanyRef.get();
      if (oldDoc.exists) {
        await oldCompanyRef.delete();
      }
    }

    report.steps.cleanup = {
      status: 'success',
      details: `Old company document companies/${oldId} ${dryRun ? 'would be' : 'was'} deleted`,
    };
  } catch (error) {
    const msg = `Step 5 (cleanup): ${getErrorMessage(error)}`;
    report.steps.cleanup = { status: 'error', details: msg };
    report.errors.push(msg);
  }

  // Collect all errors from sub-steps
  for (const col of report.steps.collections) {
    report.errors.push(...col.errors);
  }
  for (const sub of report.steps.subcollections) {
    report.errors.push(...sub.errors);
  }

  // Count dry-run totals
  if (dryRun) {
    report.totalDocumentsUpdated = report.steps.collections.reduce(
      (sum, c) => sum + c.documentsFound, 0
    );
  }

  return report;
}

// =============================================================================
// GET — Dry Run
// =============================================================================

export const GET = withSensitiveRateLimit(
  withAuth(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      if (ctx.globalRole !== 'super_admin') {
        return NextResponse.json(
          { success: false, error: 'Forbidden: super_admin required' },
          { status: 403 }
        );
      }

      logger.info('[MigrateCompanyId] DRY RUN started', { callerEmail: ctx.email });

      const report = await executeMigration(ctx, true);

      return NextResponse.json({
        success: true,
        message: 'DRY RUN complete — no changes were made',
        report,
      });
    },
    { permissions: 'admin_access' }
  )
);

// =============================================================================
// POST — Execute Migration
// =============================================================================

export const maxDuration = 60; // Vercel: allow up to 60s for migration

export const POST = withSensitiveRateLimit(
  withAuth(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      if (ctx.globalRole !== 'super_admin') {
        return NextResponse.json(
          { success: false, error: 'Forbidden: super_admin required' },
          { status: 403 }
        );
      }

      logger.info('[MigrateCompanyId] EXECUTE started', { callerEmail: ctx.email });

      const report = await executeMigration(ctx, false);

      // Audit log
      try {
        const metadata = extractRequestMetadata(req);
        await logSystemOperation(
          ctx,
          'company_id_migration',
          `Migrated company ID from ${report.oldCompanyId} to ${report.newCompanyId}. ` +
          `${report.totalDocumentsUpdated} documents updated across ${report.steps.collections.length} collections. ` +
          `${report.errors.length} errors.`,
          metadata
        );
      } catch {
        logger.warn('[MigrateCompanyId] Audit logging failed (non-blocking)');
      }

      const hasErrors = report.errors.length > 0;

      return NextResponse.json({
        success: !hasErrors,
        message: hasErrors
          ? `Migration completed with ${report.errors.length} error(s)`
          : 'Migration completed successfully',
        report,
        nextSteps: [
          `1. Update src/config/tenant.ts: change LEGACY_TENANT_COMPANY_ID to '${report.newCompanyId}'`,
          `2. Rename constant to TENANT_COMPANY_ID (no longer legacy)`,
          '3. Update scripts with hardcoded old ID',
          '4. Commit + push',
          '5. Logout + Login to refresh Firebase token with new companyId',
          '6. Verify at /debug/token-info',
        ],
      });
    },
    { permissions: 'admin_access' }
  )
);
