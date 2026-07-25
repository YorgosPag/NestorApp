/**
 * =============================================================================
 * 🧪 ANCHORS: DELETION REGISTRY ↔ STORAGE PATH SSoT (ADR-709)
 * =============================================================================
 *
 * These anchors exist because the failure they guard against is SILENT: a
 * deletion that reports success while leaving binaries in the bucket. Nothing
 * throws, no log line is red, and the objects are only discovered later as
 * unattributable storage cost.
 *
 * @module config/__tests__/deletion-registry-storage.test
 * @enterprise ADR-226 — Deletion Guard
 * @enterprise ADR-709 — Immutable Storage Path
 */

import { DELETION_REGISTRY } from '@/config/deletion-registry';
import { buildEntityStoragePrefix, buildStoragePath } from '@/services/upload/utils/storage-path';
import { COLLECTIONS } from '@/config/firestore-collections';
import { ENTITY_TYPES, FILE_DOMAINS, FILE_CATEGORIES } from '@/config/domain-constants';

describe('deletion registry ↔ storage path (ADR-709)', () => {
  describe('every cleanup template is derived from the path SSoT', () => {
    it.each(['contact', 'property', 'project'] as const)(
      '%s cleanup prefix matches what the builder actually writes',
      (entityType) => {
        const templates = DELETION_REGISTRY[entityType].storageCleanup ?? [];
        expect(templates.length).toBeGreaterThan(0);

        // Resolve the template the way executeStorageCleanup does.
        const resolved = templates[0].pathTemplate
          .replace('{companyId}', 'c1')
          .replace('{entityId}', 'e1');

        const realPath = buildStoragePath({
          companyId: 'c1',
          entityType,
          entityId: 'e1',
          domain: FILE_DOMAINS.CONSTRUCTION,
          category: FILE_CATEGORIES.FLOORPLANS,
          fileId: 'f1',
          ext: 'pdf',
        }).path;

        // The whole point of a prefix sweep: it must actually contain the file.
        expect(realPath.startsWith(resolved)).toBe(true);
        expect(resolved).toBe(
          buildEntityStoragePrefix({ companyId: 'c1', entityType, entityId: 'e1' })
        );
      }
    );
  });

  describe('project deletion reaches its own files', () => {
    it('ANCHOR: cascades FileRecords — otherwise Firestore keeps orphan rows', () => {
      const cascaded = (DELETION_REGISTRY.project.cascadeDependencies ?? []).map(
        (d) => d.collection
      );
      expect(cascaded).toContain(COLLECTIONS.FILES);
    });

    it('ANCHOR: sweeps Storage — otherwise the binaries outlive every record of them', () => {
      // Regression guard: `project` shipped with NO storageCleanup at all while
      // contact and property had one, so project binaries were unreachable
      // forever once the FileRecords were gone.
      expect(DELETION_REGISTRY.project.storageCleanup).toBeDefined();
      expect(DELETION_REGISTRY.project.storageCleanup?.length).toBeGreaterThan(0);
    });

    it('the swept prefix covers files written under the project entity', () => {
      const prefix = DELETION_REGISTRY.project.storageCleanup![0].pathTemplate
        .replace('{companyId}', 'c1')
        .replace('{entityId}', 'proj_1');

      const attendancePhoto = buildStoragePath({
        companyId: 'c1',
        entityType: ENTITY_TYPES.PROJECT,
        entityId: 'proj_1',
        domain: FILE_DOMAINS.ADMIN,
        category: FILE_CATEGORIES.PHOTOS,
        fileId: 'ev_1',
        ext: 'jpg',
      }).path;

      expect(attendancePhoto.startsWith(prefix)).toBe(true);
    });
  });

  describe('sellable auxiliary spaces stay behaviourally identical after dedup', () => {
    it('parking and storage differ ONLY in the sold-message', () => {
      const { conditionalBlock: parkingBlock, ...parkingRest } = DELETION_REGISTRY.parking;
      const { conditionalBlock: storageBlock, ...storageRest } = DELETION_REGISTRY.storage;

      expect(parkingRest).toEqual(storageRest);
      expect(parkingBlock?.field).toBe(storageBlock?.field);
      expect(parkingBlock?.condition).toBe(storageBlock?.condition);
      expect(parkingBlock?.message).not.toBe(storageBlock?.message);
    });

    it('both still BLOCK on a sold space', () => {
      for (const entityType of ['parking', 'storage'] as const) {
        expect(DELETION_REGISTRY[entityType].strategy).toBe('BLOCK');
        expect(DELETION_REGISTRY[entityType].conditionalBlock?.field).toBe('commercial.owners');
        expect(DELETION_REGISTRY[entityType].conditionalBlock?.condition).toBe('exists');
      }
    });

    it('both still cascade the search index and check contact links', () => {
      for (const entityType of ['parking', 'storage'] as const) {
        expect(
          (DELETION_REGISTRY[entityType].cascadeDependencies ?? []).map((d) => d.collection)
        ).toContain(COLLECTIONS.SEARCH_DOCUMENTS);
        expect(DELETION_REGISTRY[entityType].dependencies.map((d) => d.collection)).toContain(
          COLLECTIONS.CONTACT_LINKS
        );
      }
    });
  });
});
