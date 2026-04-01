/**
 * =============================================================================
 * MIGRATE ENTERPRISE IDs — API Handlers
 * =============================================================================
 *
 * @method GET  - Dry-run: report legacy documents
 * @method POST - Execute: rename documents + update references
 *
 * @module api/admin/migrate-enterprise-ids
 * @see ADR-210 (Document ID Generation Audit)
 * @security withAuth + super_admin + audit logging
 */

import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { withAuth, logMigrationExecuted } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';
import type { LegacyDocument, MigrationResult, SimpleCollectionConfig } from './migration-config';
import { SIMPLE_COLLECTIONS, BUILDING_SUBCOLLECTIONS } from './migration-config';
import {
  scanForLegacyDocuments,
  migrateSubcollection,
  updateBuildingReferences,
  updateContactReferences,
} from './migration-operations';

const logger = createModuleLogger('MigrateEnterpriseIds');

// =============================================================================
// RESPONSE TYPES
// =============================================================================

interface CollectionSummary {
  readonly collection: string;
  readonly count: number;
  readonly samples: ReadonlyArray<{ oldId: string; newId: string }>;
}

interface DryRunResponse {
  success: boolean;
  message: string;
  dryRun?: boolean;
  totalLegacy?: number;
  buildings?: ReadonlyArray<LegacyDocument & { subcollections: Record<string, number> }>;
  contacts?: ReadonlyArray<LegacyDocument>;
  simpleCollections?: ReadonlyArray<CollectionSummary>;
}

interface ExecuteResponse {
  success: boolean;
  message: string;
  migrated: number;
  results?: ReadonlyArray<MigrationResult>;
  errors?: ReadonlyArray<{ id: string; collection: string; error: string }>;
}

// =============================================================================
// GET — Dry-run report
// =============================================================================

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
        });
      }

      // Gather subcollection info for buildings
      const buildingDetails = await Promise.all(
        report.buildings.map(async (bldg) => {
          const subcollections: Record<string, number> = {};
          for (const sub of BUILDING_SUBCOLLECTIONS) {
            const snap = await db.collection(COLLECTIONS.BUILDINGS).doc(bldg.id).collection(sub).get();
            subcollections[sub] = snap.size;
          }
          return { ...bldg, subcollections };
        }),
      );

      // Group simple collections for summary
      const simpleByCollection = new Map<string, LegacyDocument[]>();
      for (const doc of report.simpleCollections) {
        const existing = simpleByCollection.get(doc.collection) ?? [];
        existing.push(doc);
        simpleByCollection.set(doc.collection, existing);
      }

      const simpleSummaries: CollectionSummary[] = [];
      for (const [coll, docs] of simpleByCollection) {
        simpleSummaries.push({
          collection: coll,
          count: docs.length,
          samples: docs.slice(0, 3).map(d => ({ oldId: d.id, newId: d.newId })),
        });
      }

      await logMigrationExecuted(ctx, 'migrate-enterprise-ids-dryrun', { totalLegacy: report.totalLegacy });

      return NextResponse.json({
        success: true,
        message: `Βρέθηκαν ${report.totalLegacy} legacy documents (${report.buildings.length} buildings, ${report.contacts.length} contacts, ${report.simpleCollections.length} σε άλλα collections)`,
        dryRun: true,
        totalLegacy: report.totalLegacy,
        buildings: buildingDetails,
        contacts: report.contacts,
        simpleCollections: simpleSummaries,
      });
    },
    { requiredGlobalRoles: 'super_admin' },
  ),
);

// =============================================================================
// POST — Execute migration
// =============================================================================

export const POST = withSensitiveRateLimit(
  withAuth<ExecuteResponse>(
    async (_req: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
      logger.info('Migration execution started', { uid: ctx.uid });

      const db = getAdminFirestore();
      const report = await scanForLegacyDocuments(db);

      if (report.totalLegacy === 0) {
        return NextResponse.json({ success: true, message: 'Δεν βρέθηκαν legacy documents', migrated: 0 });
      }

      const results: MigrationResult[] = [];
      const errors: Array<{ id: string; collection: string; error: string }> = [];

      // Migrate Buildings (complex: subcollections + cross-references)
      for (const bldg of report.buildings) {
        try {
          const oldDocRef = db.collection(COLLECTIONS.BUILDINGS).doc(bldg.id);
          const oldDoc = await oldDocRef.get();
          if (!oldDoc.exists) continue;

          await db.collection(COLLECTIONS.BUILDINGS).doc(bldg.newId).set(oldDoc.data()!);

          let subcollectionsMigrated = 0;
          for (const sub of BUILDING_SUBCOLLECTIONS) {
            subcollectionsMigrated += await migrateSubcollection(db, COLLECTIONS.BUILDINGS, bldg.id, bldg.newId, sub);
          }

          const referencesUpdated = await updateBuildingReferences(db, bldg.id, bldg.newId);
          await oldDocRef.delete();

          results.push({ oldId: bldg.id, newId: bldg.newId, collection: COLLECTIONS.BUILDINGS, subcollectionsMigrated, referencesUpdated });
          logger.info('Building migrated', { oldId: bldg.id, newId: bldg.newId, subcollectionsMigrated, referencesUpdated });
        } catch (err) {
          const msg = getErrorMessage(err);
          errors.push({ id: bldg.id, collection: COLLECTIONS.BUILDINGS, error: msg });
          logger.error('Building migration failed', { id: bldg.id, error: msg });
        }
      }

      // Migrate Contacts (complex: cross-references)
      for (const contact of report.contacts) {
        try {
          const oldDocRef = db.collection(COLLECTIONS.CONTACTS).doc(contact.id);
          const oldDoc = await oldDocRef.get();
          if (!oldDoc.exists) continue;

          await db.collection(COLLECTIONS.CONTACTS).doc(contact.newId).set(oldDoc.data()!);
          const referencesUpdated = await updateContactReferences(db, contact.id, contact.newId);
          await oldDocRef.delete();

          results.push({ oldId: contact.id, newId: contact.newId, collection: COLLECTIONS.CONTACTS, subcollectionsMigrated: 0, referencesUpdated });
          logger.info('Contact migrated', { oldId: contact.id, newId: contact.newId, type: contact.type, referencesUpdated });
        } catch (err) {
          const msg = getErrorMessage(err);
          errors.push({ id: contact.id, collection: COLLECTIONS.CONTACTS, error: msg });
          logger.error('Contact migration failed', { id: contact.id, error: msg });
        }
      }

      // Migrate Simple Collections (batched)
      const configMap = new Map<string, SimpleCollectionConfig>();
      for (const cfg of SIMPLE_COLLECTIONS) configMap.set(cfg.collectionName, cfg);

      const BATCH_SIZE = 400;
      for (let i = 0; i < report.simpleCollections.length; i += BATCH_SIZE) {
        const chunk = report.simpleCollections.slice(i, i + BATCH_SIZE);
        const batch = db.batch();
        const chunkResults: MigrationResult[] = [];

        for (const legacyDoc of chunk) {
          try {
            const oldDocRef = db.collection(legacyDoc.collection).doc(legacyDoc.id);
            const oldSnap = await oldDocRef.get();
            if (!oldSnap.exists) continue;

            const data = oldSnap.data()!;
            const config = configMap.get(legacyDoc.collection);
            const newData = config?.hasInternalId && typeof data.id === 'string'
              ? { ...data, id: legacyDoc.newId }
              : data;

            batch.set(db.collection(legacyDoc.collection).doc(legacyDoc.newId), newData);
            batch.delete(oldDocRef);

            chunkResults.push({
              oldId: legacyDoc.id, newId: legacyDoc.newId, collection: legacyDoc.collection,
              subcollectionsMigrated: 0, referencesUpdated: config?.hasInternalId ? 1 : 0,
            });
          } catch (err) {
            errors.push({ id: legacyDoc.id, collection: legacyDoc.collection, error: getErrorMessage(err) });
          }
        }

        if (chunkResults.length > 0) {
          await batch.commit();
          results.push(...chunkResults);
        }
      }

      await logMigrationExecuted(ctx, 'migrate-enterprise-ids-execute', {
        totalMigrated: results.length,
        totalErrors: errors.length,
        buildings: results.filter(r => r.collection === COLLECTIONS.BUILDINGS).length,
        contacts: results.filter(r => r.collection === COLLECTIONS.CONTACTS).length,
        simple: results.filter(r => r.collection !== COLLECTIONS.BUILDINGS && r.collection !== COLLECTIONS.CONTACTS).length,
      });

      return NextResponse.json({
        success: errors.length === 0,
        message: errors.length === 0
          ? `Migration ολοκληρώθηκε: ${results.length} documents μετονομάστηκαν σε enterprise IDs`
          : `Migration μερικώς ολοκληρώθηκε: ${results.length} επιτυχημένα, ${errors.length} σφάλματα`,
        migrated: results.length,
        results,
        ...(errors.length > 0 ? { errors } : {}),
      });
    },
    { requiredGlobalRoles: 'super_admin' },
  ),
);
