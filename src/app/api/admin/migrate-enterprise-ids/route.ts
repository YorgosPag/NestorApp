/**
 * =============================================================================
 * MIGRATE ENTERPRISE IDs — Legacy Auto-ID → Enterprise ID Migration
 * =============================================================================
 *
 * Μετονομασία Firestore documents που χρησιμοποιούν auto-generated IDs
 * σε enterprise-prefixed IDs (bldg_, cont_, comp_).
 *
 * @module api/admin/migrate-enterprise-ids
 * @see ADR-210 (Document ID Generation Audit)
 *
 * @method GET  - Dry-run: report legacy documents χωρίς αλλαγές
 * @method POST - Execute: μετονομασία documents + ενημέρωση references
 *
 * @security withAuth + super_admin + audit logging
 */

import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { withAuth, logMigrationExecuted } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import {
  generateBuildingId,
  generateContactId,
  generateCompanyId,
  ENTERPRISE_ID_PREFIXES,
} from '@/services/enterprise-id.service';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('MigrateEnterpriseIds');

// ============================================================================
// TYPES
// ============================================================================

interface LegacyDocument {
  readonly id: string;
  readonly collection: string;
  readonly newId: string;
  readonly type?: string;
}

interface MigrationResult {
  readonly oldId: string;
  readonly newId: string;
  readonly collection: string;
  readonly subcollectionsMigrated: number;
  readonly referencesUpdated: number;
}

interface MigrationReport {
  readonly buildings: ReadonlyArray<LegacyDocument>;
  readonly contacts: ReadonlyArray<LegacyDocument>;
  readonly totalLegacy: number;
}

// ============================================================================
// HELPERS
// ============================================================================

/** Check if an ID has a known enterprise prefix */
function hasEnterprisePrefix(id: string, prefixes: ReadonlyArray<string>): boolean {
  return prefixes.some(prefix => id.startsWith(`${prefix}_`));
}

const BUILDING_PREFIXES = [ENTERPRISE_ID_PREFIXES.BUILDING] as const;
const CONTACT_PREFIXES = [
  ENTERPRISE_ID_PREFIXES.CONTACT,
  ENTERPRISE_ID_PREFIXES.COMPANY,
] as const;

/** Known building subcollections */
const BUILDING_SUBCOLLECTIONS = ['units', 'floors', 'parking', 'storage'] as const;

/**
 * Copy all documents from one subcollection to another (under a new parent).
 * Returns the number of documents copied.
 */
async function migrateSubcollection(
  db: FirebaseFirestore.Firestore,
  parentCollection: string,
  oldParentId: string,
  newParentId: string,
  subcollectionName: string,
): Promise<number> {
  const oldSubRef = db
    .collection(parentCollection)
    .doc(oldParentId)
    .collection(subcollectionName);

  const snapshot = await oldSubRef.get();
  if (snapshot.empty) return 0;

  const batch = db.batch();
  const newSubRef = db
    .collection(parentCollection)
    .doc(newParentId)
    .collection(subcollectionName);

  for (const doc of snapshot.docs) {
    batch.set(newSubRef.doc(doc.id), doc.data());
    batch.delete(oldSubRef.doc(doc.id));
  }

  await batch.commit();
  return snapshot.size;
}

/**
 * Update references to an old ID across related collections.
 * Returns the number of documents updated.
 */
async function updateBuildingReferences(
  db: FirebaseFirestore.Firestore,
  oldId: string,
  newId: string,
): Promise<number> {
  let updated = 0;

  // 1. contact_links: documents with entityId pointing to old building
  const contactLinksSnap = await db
    .collection(COLLECTIONS.CONTACT_LINKS)
    .where('entityId', '==', oldId)
    .get();

  if (!contactLinksSnap.empty) {
    const batch = db.batch();
    for (const doc of contactLinksSnap.docs) {
      batch.update(doc.ref, { entityId: newId });
      updated++;
    }
    await batch.commit();
  }

  // 2. projects: documents with buildings array or buildingIds containing oldId
  const projectsSnap = await db.collection(COLLECTIONS.PROJECTS).get();
  for (const doc of projectsSnap.docs) {
    const data = doc.data();
    let needsUpdate = false;
    const updates: Record<string, unknown> = {};

    // Check buildings array
    if (Array.isArray(data.buildings) && data.buildings.includes(oldId)) {
      updates.buildings = data.buildings.map((id: string) => id === oldId ? newId : id);
      needsUpdate = true;
    }

    // Check buildingIds array
    if (Array.isArray(data.buildingIds) && data.buildingIds.includes(oldId)) {
      updates.buildingIds = data.buildingIds.map((id: string) => id === oldId ? newId : id);
      needsUpdate = true;
    }

    if (needsUpdate) {
      await doc.ref.update(updates);
      updated++;
    }
  }

  return updated;
}

/**
 * Update references to an old contact ID across related collections.
 */
async function updateContactReferences(
  db: FirebaseFirestore.Firestore,
  oldId: string,
  newId: string,
): Promise<number> {
  let updated = 0;

  // 1. contact_links: documents with contactId pointing to old contact
  const contactLinksSnap = await db
    .collection(COLLECTIONS.CONTACT_LINKS)
    .where('contactId', '==', oldId)
    .get();

  if (!contactLinksSnap.empty) {
    const batch = db.batch();
    for (const doc of contactLinksSnap.docs) {
      batch.update(doc.ref, { contactId: newId });
      updated++;
    }
    await batch.commit();
  }

  // 2. buildings: documents with linkedCompanyId pointing to old contact
  const buildingsSnap = await db
    .collection(COLLECTIONS.BUILDINGS)
    .where('linkedCompanyId', '==', oldId)
    .get();

  if (!buildingsSnap.empty) {
    const batch = db.batch();
    for (const doc of buildingsSnap.docs) {
      batch.update(doc.ref, { linkedCompanyId: newId });
      updated++;
    }
    await batch.commit();
  }

  // 3. units: documents with soldTo or ownerId pointing to old contact
  const unitsSoldToSnap = await db
    .collection(COLLECTIONS.UNITS)
    .where('soldTo', '==', oldId)
    .get();

  if (!unitsSoldToSnap.empty) {
    const batch = db.batch();
    for (const doc of unitsSoldToSnap.docs) {
      batch.update(doc.ref, { soldTo: newId });
      updated++;
    }
    await batch.commit();
  }

  return updated;
}

// ============================================================================
// SCAN — Find legacy documents
// ============================================================================

async function scanForLegacyDocuments(
  db: FirebaseFirestore.Firestore,
): Promise<MigrationReport> {
  const buildings: LegacyDocument[] = [];
  const contacts: LegacyDocument[] = [];

  // Scan buildings
  const buildingsSnap = await db.collection(COLLECTIONS.BUILDINGS).get();
  for (const doc of buildingsSnap.docs) {
    if (!hasEnterprisePrefix(doc.id, BUILDING_PREFIXES)) {
      buildings.push({
        id: doc.id,
        collection: COLLECTIONS.BUILDINGS,
        newId: generateBuildingId(),
      });
    }
  }

  // Scan contacts
  const contactsSnap = await db.collection(COLLECTIONS.CONTACTS).get();
  for (const doc of contactsSnap.docs) {
    if (!hasEnterprisePrefix(doc.id, CONTACT_PREFIXES)) {
      const data = doc.data();
      const isCompany = data.type === 'company';
      contacts.push({
        id: doc.id,
        collection: COLLECTIONS.CONTACTS,
        newId: isCompany ? generateCompanyId() : generateContactId(),
        type: isCompany ? 'company' : 'individual',
      });
    }
  }

  return {
    buildings,
    contacts,
    totalLegacy: buildings.length + contacts.length,
  };
}

// ============================================================================
// GET — Dry-run report
// ============================================================================

interface DryRunResponse {
  success: boolean;
  message: string;
  dryRun?: boolean;
  report?: MigrationReport;
  buildings?: ReadonlyArray<LegacyDocument & { subcollections: Record<string, number> }>;
  contacts?: ReadonlyArray<LegacyDocument>;
  totalLegacy?: number;
}

export const GET = withSensitiveRateLimit(
  withAuth<DryRunResponse>(
    async (_req: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
      logger.info('Migration dry-run requested', { uid: ctx.uid });

      const db = getAdminFirestore();
      const report = await scanForLegacyDocuments(db);

      if (report.totalLegacy === 0) {
        return NextResponse.json({
          success: true,
          message: 'Δεν βρέθηκαν legacy documents — όλα χρησιμοποιούν enterprise IDs',
          report,
        });
      }

      // Gather subcollection info for buildings
      const buildingDetails = await Promise.all(
        report.buildings.map(async (bldg) => {
          const subcollections: Record<string, number> = {};
          for (const sub of BUILDING_SUBCOLLECTIONS) {
            const snap = await db
              .collection(COLLECTIONS.BUILDINGS)
              .doc(bldg.id)
              .collection(sub)
              .get();
            subcollections[sub] = snap.size;
          }
          return { ...bldg, subcollections };
        }),
      );

      await logMigrationExecuted(
        ctx,
        'migrate-enterprise-ids-dryrun',
        { totalLegacy: report.totalLegacy },
      );

      return NextResponse.json({
        success: true,
        message: `Βρέθηκαν ${report.totalLegacy} legacy documents (${report.buildings.length} buildings, ${report.contacts.length} contacts)`,
        dryRun: true,
        buildings: buildingDetails,
        contacts: report.contacts,
        totalLegacy: report.totalLegacy,
      });
    },
    { requiredGlobalRoles: 'super_admin' },
  ),
);

// ============================================================================
// POST — Execute migration
// ============================================================================

interface ExecuteResponse {
  success: boolean;
  message: string;
  migrated: number;
  results?: ReadonlyArray<MigrationResult>;
}

export const POST = withSensitiveRateLimit(
  withAuth<ExecuteResponse>(
    async (_req: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
      logger.info('Migration execution started', { uid: ctx.uid });

      const db = getAdminFirestore();
      const report = await scanForLegacyDocuments(db);

      if (report.totalLegacy === 0) {
        return NextResponse.json({
          success: true,
          message: 'Δεν βρέθηκαν legacy documents — τίποτα δεν χρειάζεται migration',
          migrated: 0,
        });
      }

      const results: MigrationResult[] = [];

      // ── Migrate Buildings ──
      for (const bldg of report.buildings) {
        const oldDocRef = db.collection(COLLECTIONS.BUILDINGS).doc(bldg.id);
        const oldDoc = await oldDocRef.get();

        if (!oldDoc.exists) {
          logger.warn('Building document not found during migration', { id: bldg.id });
          continue;
        }

        const data = oldDoc.data()!;
        const newDocRef = db.collection(COLLECTIONS.BUILDINGS).doc(bldg.newId);

        // Copy document data to new ID
        await newDocRef.set(data);

        // Migrate subcollections
        let subcollectionsMigrated = 0;
        for (const sub of BUILDING_SUBCOLLECTIONS) {
          const count = await migrateSubcollection(
            db,
            COLLECTIONS.BUILDINGS,
            bldg.id,
            bldg.newId,
            sub,
          );
          subcollectionsMigrated += count;
        }

        // Update references in other collections
        const referencesUpdated = await updateBuildingReferences(db, bldg.id, bldg.newId);

        // Delete old document
        await oldDocRef.delete();

        results.push({
          oldId: bldg.id,
          newId: bldg.newId,
          collection: COLLECTIONS.BUILDINGS,
          subcollectionsMigrated,
          referencesUpdated,
        });

        logger.info('Building migrated', {
          oldId: bldg.id,
          newId: bldg.newId,
          subcollectionsMigrated,
          referencesUpdated,
        });
      }

      // ── Migrate Contacts ──
      for (const contact of report.contacts) {
        const oldDocRef = db.collection(COLLECTIONS.CONTACTS).doc(contact.id);
        const oldDoc = await oldDocRef.get();

        if (!oldDoc.exists) {
          logger.warn('Contact document not found during migration', { id: contact.id });
          continue;
        }

        const data = oldDoc.data()!;
        const newDocRef = db.collection(COLLECTIONS.CONTACTS).doc(contact.newId);

        // Copy document data to new ID
        await newDocRef.set(data);

        // Update references in other collections
        const referencesUpdated = await updateContactReferences(db, contact.id, contact.newId);

        // Delete old document
        await oldDocRef.delete();

        results.push({
          oldId: contact.id,
          newId: contact.newId,
          collection: COLLECTIONS.CONTACTS,
          subcollectionsMigrated: 0,
          referencesUpdated,
        });

        logger.info('Contact migrated', {
          oldId: contact.id,
          newId: contact.newId,
          type: contact.type,
          referencesUpdated,
        });
      }

      await logMigrationExecuted(
        ctx,
        'migrate-enterprise-ids-execute',
        {
          totalMigrated: results.length,
          buildings: results.filter(r => r.collection === COLLECTIONS.BUILDINGS).length,
          contacts: results.filter(r => r.collection === COLLECTIONS.CONTACTS).length,
        },
      );

      return NextResponse.json({
        success: true,
        message: `Migration ολοκληρώθηκε: ${results.length} documents μετονομάστηκαν σε enterprise IDs`,
        migrated: results.length,
        results,
      });
    },
    { requiredGlobalRoles: 'super_admin' },
  ),
);
