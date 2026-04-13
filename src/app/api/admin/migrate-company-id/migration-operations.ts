/**
 * @fileoverview Migration operations for company ID migration (ADR-210)
 * @description Batch helpers + core executeMigration logic.
 */

import 'server-only';

import { getAdminFirestore, getAdminAuth, FieldValue } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { FIELDS } from '@/config/firestore-field-constants';
import { LEGACY_TENANT_COMPANY_ID } from '@/config/tenant';
import { generateCompanyId } from '@/services/enterprise-id.service';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';
import type { AuthContext } from '@/lib/auth';
import { EntityAuditService } from '@/services/entity-audit.service';
import { ENTITY_TYPES } from '@/config/domain-constants';
import type {
  CollectionMigrationResult,
  SubcollectionMigrationResult,
  MigrationReport,
} from './migration-config';
import {
  BATCH_LIMIT,
  COLLECTIONS_WITH_COMPANY_ID,
  NAVIGATION_COLLECTION,
} from './migration-config';

const logger = createModuleLogger('MigrateCompanyId');

// =============================================================================
// BATCH HELPERS
// =============================================================================

export async function migrateCollection(
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

    logger.info(`Collection "${collectionName}": ${result.documentsUpdated}/${result.documentsFound} docs updated`);
  } catch (error) {
    const msg = `Collection "${collectionName}": ${getErrorMessage(error)}`;
    result.errors.push(msg);
    logger.error(msg);
  }

  return result;
}

export async function migrateSubcollection(
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

    for (let i = 0; i < docs.length; i += BATCH_LIMIT) {
      const batch = db.batch();
      const chunk = docs.slice(i, i + BATCH_LIMIT);

      for (const doc of chunk) {
        batch.delete(doc.ref);
      }

      await batch.commit();
      result.documentsDeleted += chunk.length;
    }

    logger.info(`Subcollection "${oldPath}": ${result.documentsCopied} docs copied, ${result.documentsDeleted} deleted`);
  } catch (error) {
    const msg = `Subcollection "${oldPath}": ${getErrorMessage(error)}`;
    result.errors.push(msg);
    logger.error(msg);
  }

  return result;
}

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
    const parentSnapshot = await db.collection(`${oldParentPath}/${parentSubcollection}`).get();

    for (const parentDoc of parentSnapshot.docs) {
      const oldNestedPath = `${oldParentPath}/${parentSubcollection}/${parentDoc.id}`;
      const newNestedPath = `${newParentPath}/${parentSubcollection}/${parentDoc.id}`;

      if (!dryRun) {
        const newParentDocRef = db.doc(`${newParentPath}/${parentSubcollection}/${parentDoc.id}`);
        await newParentDocRef.set(parentDoc.data());
      }

      const childResult = await migrateSubcollection(
        db, oldNestedPath, newNestedPath, childSubcollection, dryRun
      );
      results.push(childResult);
    }

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

export async function executeMigration(
  ctx: AuthContext,
  dryRun: boolean
): Promise<MigrationReport> {
  const oldId = LEGACY_TENANT_COMPANY_ID;
  const newId = generateCompanyId();

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

  // STEP 1: Create new company document
  try {
    const contactSnap = await db.collection(COLLECTIONS.CONTACTS).doc(oldId).get();
    const contactData = contactSnap.exists ? contactSnap.data() : null;
    const companyName = contactData?.name ?? contactData?.displayName ?? 'ΠΑΓΩΝΗΣ';

    if (!dryRun) {
      const oldCompanySnap = await db.collection(COLLECTIONS.COMPANIES).doc(oldId).get();
      const oldCompanyData = oldCompanySnap.exists ? oldCompanySnap.data() : null;

      const newCompanyDoc = {
        name: oldCompanyData?.name ?? companyName,
        contactId: oldId,
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
      EntityAuditService.recordChange({
        entityType: ENTITY_TYPES.COMPANY as 'company',
        entityId: newId,
        entityName: typeof newCompanyDoc.name === 'string' ? newCompanyDoc.name : null,
        action: 'created',
        changes: [{ field: 'migratedFrom', oldValue: oldId, newValue: newId, label: 'Company ID Migration' }],
        performedBy: ctx.uid,
        performedByName: ctx.email ?? null,
        companyId: newId,
      }).catch(() => {});
    }

    report.steps.companyDocument = {
      status: 'success',
      details: `Company document ${dryRun ? 'would be' : 'was'} created at companies/${newId} (name: ${companyName})`,
    };
  } catch (error) {
    const msg = `Step 1 (company document): ${getErrorMessage(error)}`;
    report.steps.companyDocument = { status: 'error', details: msg };
    report.errors.push(msg);
  }

  // STEP 2: Update Firebase custom claims
  try {
    const auth = getAdminAuth();
    const usersSnap = await db
      .collection(COLLECTIONS.USERS)
      .where(FIELDS.COMPANY_ID, '==', oldId)
      .get();

    let usersUpdated = 0;

    for (const userDoc of usersSnap.docs) {
      const uid = userDoc.id;

      if (!dryRun) {
        const firebaseUser = await auth.getUser(uid);
        const currentClaims = firebaseUser.customClaims ?? {};

        await auth.setCustomUserClaims(uid, {
          ...currentClaims,
          companyId: newId,
        });

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
      details: `${usersUpdated} user(s) ${dryRun ? 'would be' : 'were'} updated with new companyId`,
    };
  } catch (error) {
    const msg = `Step 2 (custom claims): ${getErrorMessage(error)}`;
    report.steps.customClaims = { status: 'error', usersUpdated: 0, details: msg };
    report.errors.push(msg);
  }

  // STEP 3: Update companyId across ALL collections
  for (const col of COLLECTIONS_WITH_COMPANY_ID) {
    const collectionName = COLLECTIONS[col.key];
    const result = await migrateCollection(db, collectionName, oldId, newId, dryRun);
    report.steps.collections.push(result);
    report.totalDocumentsUpdated += result.documentsUpdated;
  }

  const navResult = await migrateCollection(
    db, NAVIGATION_COLLECTION, oldId, newId, dryRun, 'contactId'
  );
  report.steps.collections.push(navResult);
  report.totalDocumentsUpdated += navResult.documentsUpdated;

  // STEP 4: Migrate RBAC subcollections
  const oldCompanyPath = `${COLLECTIONS.COMPANIES}/${oldId}`;
  const newCompanyPath = `${COLLECTIONS.COMPANIES}/${newId}`;

  const auditResult = await migrateSubcollection(
    db, oldCompanyPath, newCompanyPath, 'audit_logs', dryRun
  );
  report.steps.subcollections.push(auditResult);

  const projectMemberResults = await migrateNestedSubcollections(
    db, oldCompanyPath, newCompanyPath, 'projects', 'members', dryRun
  );
  report.steps.subcollections.push(...projectMemberResults);

  const unitGrantResults = await migrateNestedSubcollections(
    db, oldCompanyPath, newCompanyPath, 'units', 'grants', dryRun
  );
  report.steps.subcollections.push(...unitGrantResults);

  // STEP 5: Cleanup — delete old company document
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

  for (const col of report.steps.collections) {
    report.errors.push(...col.errors);
  }
  for (const sub of report.steps.subcollections) {
    report.errors.push(...sub.errors);
  }

  if (dryRun) {
    report.totalDocumentsUpdated = report.steps.collections.reduce(
      (sum, c) => sum + c.documentsFound, 0
    );
  }

  return report;
}
