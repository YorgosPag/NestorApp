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

import { DELETION_REGISTRY, isDeletableEntityType } from '@/config/deletion-registry';
import { buildEntityStoragePrefix, buildStoragePath } from '@/services/upload/utils/storage-path';
import { COLLECTIONS } from '@/config/firestore-collections';
import {
  ENTITY_TYPES,
  FILE_DOMAINS,
  FILE_CATEGORIES,
  isPlatformEntityType,
} from '@/config/domain-constants';

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

  /**
   * Until 2026-07-28 both sides exported a function called `isValidEntityType`,
   * over two different sets, and CHECK 3.18 flagged them as a duplicate export.
   * They are NOT duplicates — merging them would widen a security gate. These
   * anchors pin the relationship so the next reader is told that, rather than
   * "helpfully" unifying two names that were never the same question.
   */
  describe('the two entity-type universes are distinct ON PURPOSE', () => {
    const deletable = Object.keys(DELETION_REGISTRY);
    const storage = Object.values(ENTITY_TYPES) as readonly string[];

    it('ANCHOR: neither set contains the other — a shared predicate would widen a gate', () => {
      const deletableOnly = deletable.filter((t) => !storage.includes(t));
      const storageOnly = storage.filter((t) => !deletable.includes(t));

      // Both non-empty ⇒ no merge direction is safe. If one of these ever
      // becomes empty, the sets converged and unification can be RE-EVALUATED —
      // deliberately, not by a rename.
      expect(deletableOnly.length).toBeGreaterThan(0);
      expect(storageOnly.length).toBeGreaterThan(0);
    });

    it('ANCHOR: the same physical thing is spelled differently on each side', () => {
      // A parking spot is `parking` to the deletion guard and `parking_spot` to
      // storage paths / enterprise IDs. Passing one where the other is expected
      // silently builds a prefix that sweeps nothing.
      expect(isDeletableEntityType('parking')).toBe(true);
      expect(isPlatformEntityType('parking')).toBe(false);

      expect(isPlatformEntityType(ENTITY_TYPES.PARKING_SPOT)).toBe(true);
      expect(isDeletableEntityType(ENTITY_TYPES.PARKING_SPOT)).toBe(false);
    });

    it('ANCHOR: every entity that sweeps Storage is spelled the STORAGE way', () => {
      // This is the invariant that actually protects data: a cleanup template is
      // built by `buildEntityStoragePrefix`, which only understands ENTITY_TYPES
      // spellings. A deletion type that sweeps storage under a spelling storage
      // never wrote is a prefix matching zero objects — deletion reports success,
      // the binaries stay, and nothing anywhere goes red.
      for (const entityType of deletable) {
        if (!DELETION_REGISTRY[entityType as keyof typeof DELETION_REGISTRY].storageCleanup?.length) {
          continue;
        }
        expect(isPlatformEntityType(entityType)).toBe(true);
      }
    });

    it('guards reject junk on both sides (fail-closed)', () => {
      for (const junk of ['', 'Contact', 'unit', 'nope']) {
        expect(isDeletableEntityType(junk)).toBe(false);
        expect(isPlatformEntityType(junk)).toBe(false);
      }
      // Non-strings reach `isPlatformEntityType` from Firestore reads; it must not throw.
      for (const junk of [null, undefined, 42, {}]) {
        expect(isPlatformEntityType(junk)).toBe(false);
      }
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
