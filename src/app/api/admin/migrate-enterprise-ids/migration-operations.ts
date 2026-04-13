/**
 * =============================================================================
 * MIGRATION OPERATIONS — Scan, Subcollections, Cross-References
 * =============================================================================
 *
 * @module api/admin/migrate-enterprise-ids/migration-operations
 * @see ADR-210 (Document ID Generation Audit)
 */

import { COLLECTIONS } from '@/config/firestore-collections';
import { FIELDS } from '@/config/firestore-field-constants';
import { createModuleLogger } from '@/lib/telemetry';
import { EntityAuditService } from '@/services/entity-audit.service';
import { ENTITY_TYPES } from '@/config/domain-constants';
import type { LegacyDocument, MigrationReport } from './migration-config';
import {
  SIMPLE_COLLECTIONS,
  BUILDING_PREFIXES,
  CONTACT_PREFIXES,
  BUILDING_SUBCOLLECTIONS,
  hasEnterprisePrefix,
  generateBuildingId,
  generateContactId,
  generateCompanyId,
} from './migration-config';

const logger = createModuleLogger('MigrationOperations');

// =============================================================================
// SCAN — Find legacy documents across ALL collections
// =============================================================================

export async function scanForLegacyDocuments(
  db: FirebaseFirestore.Firestore,
): Promise<MigrationReport> {
  const buildings: LegacyDocument[] = [];
  const contacts: LegacyDocument[] = [];
  const simpleCollections: LegacyDocument[] = [];

  // Scan buildings
  const buildingsSnap = await db.collection(COLLECTIONS.BUILDINGS).get();
  for (const doc of buildingsSnap.docs) {
    if (!hasEnterprisePrefix(doc.id, BUILDING_PREFIXES)) {
      buildings.push({ id: doc.id, collection: COLLECTIONS.BUILDINGS, newId: generateBuildingId() });
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

  // Scan simple collections
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

// =============================================================================
// SUBCOLLECTION MIGRATION
// =============================================================================

export { BUILDING_SUBCOLLECTIONS };

export async function migrateSubcollection(
  db: FirebaseFirestore.Firestore,
  parentCollection: string,
  oldParentId: string,
  newParentId: string,
  subcollectionName: string,
): Promise<number> {
  const oldSubRef = db.collection(parentCollection).doc(oldParentId).collection(subcollectionName);
  const snapshot = await oldSubRef.get();
  if (snapshot.empty) return 0;

  const batch = db.batch();
  const newSubRef = db.collection(parentCollection).doc(newParentId).collection(subcollectionName);

  for (const doc of snapshot.docs) {
    batch.set(newSubRef.doc(doc.id), doc.data());
    batch.delete(oldSubRef.doc(doc.id));
  }

  await batch.commit();
  return snapshot.size;
}

// =============================================================================
// CROSS-REFERENCE UPDATES
// =============================================================================

export async function updateBuildingReferences(
  db: FirebaseFirestore.Firestore,
  oldId: string,
  newId: string,
): Promise<number> {
  let updated = 0;

  // contact_links with entityId pointing to old building
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

  // projects with buildings/buildingIds arrays
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

export async function updateContactReferences(
  db: FirebaseFirestore.Firestore,
  oldId: string,
  newId: string,
  performedBy: string,
): Promise<number> {
  let updated = 0;

  // contact_links with contactId
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

  // buildings with linkedCompanyId
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
    for (const doc of buildingsSnap.docs) {
      EntityAuditService.recordChange({
        entityType: ENTITY_TYPES.BUILDING as 'building',
        entityId: doc.id,
        entityName: (doc.data().name as string | undefined) ?? null,
        action: 'updated',
        changes: [{ field: 'linkedCompanyId', oldValue: oldId, newValue: newId, label: 'Linked Company ID' }],
        performedBy,
        performedByName: null,
        companyId: (doc.data().companyId as string | undefined) ?? 'system',
      }).catch(() => {});
    }
  }

  // units with soldTo
  const unitsSoldToSnap = await db
    .collection(COLLECTIONS.PROPERTIES)
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
