/**
 * =============================================================================
 * MIGRATE ENTERPRISE IDs — Legacy Auto-ID → Enterprise ID Migration
 * =============================================================================
 *
 * Μετονομασία Firestore documents που χρησιμοποιούν auto-generated IDs
 * σε enterprise-prefixed IDs.
 *
 * Καλύπτει:
 * - buildings (bldg_) — with subcollections + cross-references
 * - contacts (cont_/comp_) — with cross-references
 * - notifications (notif_) — simple rename
 * - ai_agent_feedback (fb_) — simple rename
 * - ai_pipeline_audit (paud_) — simple rename
 * - entity_audit_trail (eaud_) — simple rename
 * - ai_pipeline_queue (pq_) — simple rename
 * - obligations (obl_) — simple rename
 * - legal_contracts (lc_) — rename + update internal `id` field
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
import { FIELDS } from '@/config/firestore-field-constants';
import {
  generateBuildingId,
  generateContactId,
  generateCompanyId,
  generateNotificationId,
  generateFeedbackId,
  generatePipelineAuditId,
  generateEntityAuditId,
  generatePipelineQueueId,
  generateObligationId,
  generateContractId,
  generateBrokerageId,
  generateCommissionId,
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
  readonly simpleCollections: ReadonlyArray<LegacyDocument>;
  readonly totalLegacy: number;
}

// ============================================================================
// SIMPLE COLLECTION CONFIGS
// ============================================================================

/**
 * Collections that need only doc-ID rename (no subcollections, no cross-refs).
 * `hasInternalId`: if true, the doc has an `id` field that must match the doc ID.
 */
interface SimpleCollectionConfig {
  readonly collectionName: string;
  readonly validPrefixes: ReadonlyArray<string>;
  readonly generateId: () => string;
  readonly hasInternalId: boolean;
}

const SIMPLE_COLLECTIONS: ReadonlyArray<SimpleCollectionConfig> = [
  {
    collectionName: COLLECTIONS.NOTIFICATIONS,
    validPrefixes: [ENTERPRISE_ID_PREFIXES.NOTIFICATION],
    generateId: generateNotificationId,
    hasInternalId: false,
  },
  {
    collectionName: COLLECTIONS.AI_AGENT_FEEDBACK,
    validPrefixes: [ENTERPRISE_ID_PREFIXES.FEEDBACK],
    generateId: generateFeedbackId,
    hasInternalId: false,
  },
  {
    collectionName: COLLECTIONS.AI_PIPELINE_AUDIT,
    validPrefixes: [ENTERPRISE_ID_PREFIXES.PIPELINE_AUDIT],
    generateId: generatePipelineAuditId,
    hasInternalId: false,
  },
  {
    collectionName: COLLECTIONS.ENTITY_AUDIT_TRAIL,
    validPrefixes: [ENTERPRISE_ID_PREFIXES.ENTITY_AUDIT],
    generateId: generateEntityAuditId,
    hasInternalId: false,
  },
  {
    collectionName: COLLECTIONS.AI_PIPELINE_QUEUE,
    validPrefixes: [ENTERPRISE_ID_PREFIXES.PIPELINE_QUEUE],
    generateId: generatePipelineQueueId,
    hasInternalId: false,
  },
  {
    collectionName: COLLECTIONS.OBLIGATIONS,
    validPrefixes: [ENTERPRISE_ID_PREFIXES.OBLIGATION],
    generateId: generateObligationId,
    hasInternalId: false,
  },
  {
    collectionName: COLLECTIONS.LEGAL_CONTRACTS,
    validPrefixes: [ENTERPRISE_ID_PREFIXES.CONTRACT],
    generateId: generateContractId,
    hasInternalId: true, // LegalContract stores `id` field inside the doc
  },
  {
    collectionName: COLLECTIONS.BROKERAGE_AGREEMENTS,
    validPrefixes: [ENTERPRISE_ID_PREFIXES.BROKERAGE],
    generateId: generateBrokerageId,
    hasInternalId: true, // BrokerageAgreement stores `id` field inside the doc
  },
  {
    collectionName: COLLECTIONS.COMMISSION_RECORDS,
    validPrefixes: [ENTERPRISE_ID_PREFIXES.COMMISSION],
    generateId: generateCommissionId,
    hasInternalId: true,
  },
];

// ============================================================================
// HELPERS
// ============================================================================

/** UUID v4 format check (after prefix) */
const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Check if an ID has proper enterprise format: prefix_uuid-v4.
 * Rejects legacy formats like lc_1773532540279_frbrz2 that have
 * the right prefix but wrong ID body (timestamp+random, not UUID).
 */
function hasEnterprisePrefix(id: string, prefixes: ReadonlyArray<string>): boolean {
  for (const prefix of prefixes) {
    if (id.startsWith(`${prefix}_`)) {
      const remainder = id.slice(prefix.length + 1);
      return UUID_V4_REGEX.test(remainder);
    }
  }
  return false;
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
 * Update references to an old building ID across related collections.
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
    .where(FIELDS.ENTITY_ID, '==', oldId)
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

    if (Array.isArray(data.buildings) && data.buildings.includes(oldId)) {
      updates.buildings = data.buildings.map((id: string) => id === oldId ? newId : id);
      needsUpdate = true;
    }

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
    .where(FIELDS.CONTACT_ID, '==', oldId)
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

  // 3. units: documents with soldTo pointing to old contact
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
// SCAN — Find legacy documents across ALL collections
// ============================================================================

async function scanForLegacyDocuments(
  db: FirebaseFirestore.Firestore,
): Promise<MigrationReport> {
  const buildings: LegacyDocument[] = [];
  const contacts: LegacyDocument[] = [];
  const simpleCollections: LegacyDocument[] = [];

  // ── Scan buildings ──
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

  // ── Scan contacts ──
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

  // ── Scan simple collections (no subcollections, no complex refs) ──
  for (const config of SIMPLE_COLLECTIONS) {
    const snap = await db.collection(config.collectionName).get();
    for (const doc of snap.docs) {
      if (!hasEnterprisePrefix(doc.id, config.validPrefixes)) {
        simpleCollections.push({
          id: doc.id,
          collection: config.collectionName,
          newId: config.generateId(),
        });
      }
    }
  }

  return {
    buildings,
    contacts,
    simpleCollections,
    totalLegacy: buildings.length + contacts.length + simpleCollections.length,
  };
}

// ============================================================================
// GET — Dry-run report
// ============================================================================

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

      // Group simple collections by collection name for summary
      const simpleByCollection = new Map<string, LegacyDocument[]>();
      for (const doc of report.simpleCollections) {
        const existing = simpleByCollection.get(doc.collection) ?? [];
        existing.push(doc);
        simpleByCollection.set(doc.collection, existing);
      }

      const simpleSummaries: CollectionSummary[] = [];
      for (const [collection, docs] of simpleByCollection) {
        simpleSummaries.push({
          collection,
          count: docs.length,
          samples: docs.slice(0, 3).map(d => ({ oldId: d.id, newId: d.newId })),
        });
      }

      await logMigrationExecuted(
        ctx,
        'migrate-enterprise-ids-dryrun',
        { totalLegacy: report.totalLegacy },
      );

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

// ============================================================================
// POST — Execute migration
// ============================================================================

interface ExecuteResponse {
  success: boolean;
  message: string;
  migrated: number;
  results?: ReadonlyArray<MigrationResult>;
  errors?: ReadonlyArray<{ id: string; collection: string; error: string }>;
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
      const errors: Array<{ id: string; collection: string; error: string }> = [];

      // ── Migrate Buildings (complex: subcollections + cross-references) ──
      for (const bldg of report.buildings) {
        try {
          const oldDocRef = db.collection(COLLECTIONS.BUILDINGS).doc(bldg.id);
          const oldDoc = await oldDocRef.get();

          if (!oldDoc.exists) {
            logger.warn('Building document not found', { id: bldg.id });
            continue;
          }

          const data = oldDoc.data()!;
          const newDocRef = db.collection(COLLECTIONS.BUILDINGS).doc(bldg.newId);

          await newDocRef.set(data);

          let subcollectionsMigrated = 0;
          for (const sub of BUILDING_SUBCOLLECTIONS) {
            const count = await migrateSubcollection(
              db, COLLECTIONS.BUILDINGS, bldg.id, bldg.newId, sub,
            );
            subcollectionsMigrated += count;
          }

          const referencesUpdated = await updateBuildingReferences(db, bldg.id, bldg.newId);
          await oldDocRef.delete();

          results.push({
            oldId: bldg.id, newId: bldg.newId,
            collection: COLLECTIONS.BUILDINGS,
            subcollectionsMigrated, referencesUpdated,
          });

          logger.info('Building migrated', {
            oldId: bldg.id, newId: bldg.newId,
            subcollectionsMigrated, referencesUpdated,
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          errors.push({ id: bldg.id, collection: COLLECTIONS.BUILDINGS, error: msg });
          logger.error('Building migration failed', { id: bldg.id, error: msg });
        }
      }

      // ── Migrate Contacts (complex: cross-references) ──
      for (const contact of report.contacts) {
        try {
          const oldDocRef = db.collection(COLLECTIONS.CONTACTS).doc(contact.id);
          const oldDoc = await oldDocRef.get();

          if (!oldDoc.exists) {
            logger.warn('Contact document not found', { id: contact.id });
            continue;
          }

          const data = oldDoc.data()!;
          const newDocRef = db.collection(COLLECTIONS.CONTACTS).doc(contact.newId);

          await newDocRef.set(data);
          const referencesUpdated = await updateContactReferences(db, contact.id, contact.newId);
          await oldDocRef.delete();

          results.push({
            oldId: contact.id, newId: contact.newId,
            collection: COLLECTIONS.CONTACTS,
            subcollectionsMigrated: 0, referencesUpdated,
          });

          logger.info('Contact migrated', {
            oldId: contact.id, newId: contact.newId,
            type: contact.type, referencesUpdated,
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          errors.push({ id: contact.id, collection: COLLECTIONS.CONTACTS, error: msg });
          logger.error('Contact migration failed', { id: contact.id, error: msg });
        }
      }

      // ── Migrate Simple Collections (no subcollections, no complex refs) ──
      // Process in batches of 500 (Firestore batch limit)
      const BATCH_SIZE = 400;
      for (let i = 0; i < report.simpleCollections.length; i += BATCH_SIZE) {
        const chunk = report.simpleCollections.slice(i, i + BATCH_SIZE);
        const batch = db.batch();
        const chunkResults: MigrationResult[] = [];

        // Find the config for each doc to check hasInternalId
        const configMap = new Map<string, SimpleCollectionConfig>();
        for (const cfg of SIMPLE_COLLECTIONS) {
          configMap.set(cfg.collectionName, cfg);
        }

        for (const legacyDoc of chunk) {
          try {
            const oldDocRef = db.collection(legacyDoc.collection).doc(legacyDoc.id);
            const oldSnap = await oldDocRef.get();

            if (!oldSnap.exists) {
              logger.warn('Document not found during migration', {
                id: legacyDoc.id, collection: legacyDoc.collection,
              });
              continue;
            }

            const data = oldSnap.data()!;
            const config = configMap.get(legacyDoc.collection);

            // If doc stores its own ID internally, update it
            const newData = config?.hasInternalId && typeof data.id === 'string'
              ? { ...data, id: legacyDoc.newId }
              : data;

            const newDocRef = db.collection(legacyDoc.collection).doc(legacyDoc.newId);
            batch.set(newDocRef, newData);
            batch.delete(oldDocRef);

            chunkResults.push({
              oldId: legacyDoc.id,
              newId: legacyDoc.newId,
              collection: legacyDoc.collection,
              subcollectionsMigrated: 0,
              referencesUpdated: config?.hasInternalId ? 1 : 0,
            });
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            errors.push({
              id: legacyDoc.id,
              collection: legacyDoc.collection,
              error: msg,
            });
            logger.error('Simple doc migration failed', {
              id: legacyDoc.id, collection: legacyDoc.collection, error: msg,
            });
          }
        }

        if (chunkResults.length > 0) {
          await batch.commit();
          results.push(...chunkResults);

          logger.info('Simple collection batch migrated', {
            batchSize: chunkResults.length,
            collections: [...new Set(chunkResults.map(r => r.collection))],
          });
        }
      }

      await logMigrationExecuted(
        ctx,
        'migrate-enterprise-ids-execute',
        {
          totalMigrated: results.length,
          totalErrors: errors.length,
          buildings: results.filter(r => r.collection === COLLECTIONS.BUILDINGS).length,
          contacts: results.filter(r => r.collection === COLLECTIONS.CONTACTS).length,
          simple: results.filter(r =>
            r.collection !== COLLECTIONS.BUILDINGS && r.collection !== COLLECTIONS.CONTACTS
          ).length,
        },
      );

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
