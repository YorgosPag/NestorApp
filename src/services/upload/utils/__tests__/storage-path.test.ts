/**
 * =============================================================================
 * 🧪 TESTS: CANONICAL STORAGE PATH BUILDER
 * =============================================================================
 *
 * Unit tests for the enterprise storage path builder.
 * Tests validation, path generation, and parsing.
 *
 * @module upload/utils/__tests__/storage-path.test
 */

// Jest - no import needed, globals are available
import {
  buildStoragePath,
  buildEntityStoragePrefix,
  buildCategoryStoragePrefix,
  buildLegacyProjectScopedPrefix,
  validateStoragePathParams,
  generateFileId,
  getFileExtension,
  parseStoragePath,
  type StoragePathParams,
} from '../storage-path';
import { ENTITY_TYPES, FILE_DOMAINS, FILE_CATEGORIES } from '@/config/domain-constants';

// ============================================================================
// BUILD STORAGE PATH TESTS
// ============================================================================

describe('buildStoragePath', () => {
  it('should build the ONE canonical path (ADR-709)', () => {
    const params: StoragePathParams = {
      companyId: 'company_xyz',
      entityType: ENTITY_TYPES.CONTACT,
      entityId: 'contact_789',
      domain: FILE_DOMAINS.ADMIN,
      category: FILE_CATEGORIES.PHOTOS,
      fileId: 'file_abc123',
      ext: 'jpg',
    };

    const result = buildStoragePath(params);

    expect(result.path).toBe(
      'companies/company_xyz/entities/contact/contact_789/domains/admin/categories/photos/files/file_abc123.jpg'
    );
    expect(result.segments.companyId).toBe('company_xyz');
    expect(result.segments.entityType).toBe('contact');
  });

  it('ADR-709 ANCHOR: a project scope is not expressible, whatever the caller passes', () => {
    // The type system already forbids `projectId`. This anchor covers the
    // runtime: an untyped caller (JS, `as any`-free object spread from an older
    // shape, a rehydrated payload) must not be able to reintroduce the segment.
    const smuggled = {
      companyId: 'company_xyz',
      projectId: 'project_456',
      entityType: ENTITY_TYPES.CONTACT,
      entityId: 'contact_789',
      domain: FILE_DOMAINS.ADMIN,
      category: FILE_CATEGORIES.PHOTOS,
      fileId: 'file_abc123',
      ext: 'jpg',
    } as StoragePathParams;

    const result = buildStoragePath(smuggled);

    expect(result.path).not.toContain('/projects/');
    expect(result.path).toBe(
      'companies/company_xyz/entities/contact/contact_789/domains/admin/categories/photos/files/file_abc123.jpg'
    );
  });

  it('ADR-709 ANCHOR: a project entity never repeats its own id', () => {
    const result = buildStoragePath({
      companyId: 'company_xyz',
      entityType: ENTITY_TYPES.PROJECT,
      entityId: 'proj_1',
      domain: FILE_DOMAINS.CONSTRUCTION,
      category: FILE_CATEGORIES.FLOORPLANS,
      fileId: 'file_1',
      ext: 'pdf',
    });

    expect(result.path).toBe(
      'companies/company_xyz/entities/project/proj_1/domains/construction/categories/floorplans/files/file_1.pdf'
    );
    // The pre-ADR-709 defect: `projects/proj_1/entities/project/proj_1/`
    expect(result.path.match(/proj_1/g)).toHaveLength(1);
  });

  it('should require companyId (throws error if missing)', () => {
    const params = {
      entityType: ENTITY_TYPES.BUILDING,
      entityId: 'building_123',
      domain: FILE_DOMAINS.CONSTRUCTION,
      category: FILE_CATEGORIES.FLOORPLANS,
      fileId: 'file_def456',
      ext: 'pdf',
    } as StoragePathParams;

    expect(() => buildStoragePath(params)).toThrow('Invalid storage path parameters');
  });

  it('should normalize extension with leading dot', () => {
    const params: StoragePathParams = {
      companyId: 'company_xyz',
      entityType: ENTITY_TYPES.CONTACT,
      entityId: 'contact_789',
      domain: FILE_DOMAINS.ADMIN,
      category: FILE_CATEGORIES.PHOTOS,
      fileId: 'file_abc123',
      ext: '.jpg', // with leading dot
    };

    const result = buildStoragePath(params);

    expect(result.path).toContain('file_abc123.jpg');
    expect(result.segments.ext).toBe('jpg');
  });

  it('should throw error for invalid entityType', () => {
    const params = {
      companyId: 'company_xyz',
      entityType: 'invalid_type' as unknown,
      entityId: 'id_123',
      domain: FILE_DOMAINS.ADMIN,
      category: FILE_CATEGORIES.PHOTOS,
      fileId: 'file_abc',
      ext: 'jpg',
    } as StoragePathParams;

    expect(() => buildStoragePath(params)).toThrow('Invalid storage path parameters');
  });

  it('should throw error for invalid domain', () => {
    const params = {
      companyId: 'company_xyz',
      entityType: ENTITY_TYPES.CONTACT,
      entityId: 'id_123',
      domain: 'invalid_domain' as unknown,
      category: FILE_CATEGORIES.PHOTOS,
      fileId: 'file_abc',
      ext: 'jpg',
    } as StoragePathParams;

    expect(() => buildStoragePath(params)).toThrow('Invalid storage path parameters');
  });

  it('should throw error for entityId with special characters', () => {
    const params: StoragePathParams = {
      companyId: 'company_xyz',
      entityType: ENTITY_TYPES.CONTACT,
      entityId: 'id/with/slashes',
      domain: FILE_DOMAINS.ADMIN,
      category: FILE_CATEGORIES.PHOTOS,
      fileId: 'file_abc',
      ext: 'jpg',
    };

    expect(() => buildStoragePath(params)).toThrow('Invalid storage path parameters');
  });
});

// ============================================================================
// VALIDATION TESTS
// ============================================================================

describe('validateStoragePathParams', () => {
  it('should return empty errors for valid params', () => {
    const params: StoragePathParams = {
      companyId: 'company_xyz',
      entityType: ENTITY_TYPES.CONTACT,
      entityId: 'contact_123',
      domain: FILE_DOMAINS.ADMIN,
      category: FILE_CATEGORIES.PHOTOS,
      fileId: 'file_abc',
      ext: 'jpg',
    };

    const errors = validateStoragePathParams(params);
    expect(errors).toHaveLength(0);
  });

  it('should return error for empty entityId', () => {
    const params: StoragePathParams = {
      companyId: 'company_xyz',
      entityType: ENTITY_TYPES.CONTACT,
      entityId: '',
      domain: FILE_DOMAINS.ADMIN,
      category: FILE_CATEGORIES.PHOTOS,
      fileId: 'file_abc',
      ext: 'jpg',
    };

    const errors = validateStoragePathParams(params);
    expect(errors).toHaveLength(1);
    expect(errors[0].field).toBe('entityId');
  });

  it('should return error for invalid companyId (required)', () => {
    const params = {
      companyId: 'company/with/slashes',
      entityType: ENTITY_TYPES.CONTACT,
      entityId: 'contact_123',
      domain: FILE_DOMAINS.ADMIN,
      category: FILE_CATEGORIES.PHOTOS,
      fileId: 'file_abc',
      ext: 'jpg',
    } as StoragePathParams;

    const errors = validateStoragePathParams(params);
    expect(errors.some((e) => e.field === 'companyId')).toBe(true);
  });

  it('should return error for missing companyId', () => {
    const params = {
      entityType: ENTITY_TYPES.CONTACT,
      entityId: 'contact_123',
      domain: FILE_DOMAINS.ADMIN,
      category: FILE_CATEGORIES.PHOTOS,
      fileId: 'file_abc',
      ext: 'jpg',
    } as StoragePathParams;

    const errors = validateStoragePathParams(params);
    expect(errors.some((e) => e.field === 'companyId')).toBe(true);
  });
});

// ============================================================================
// UTILITY FUNCTIONS TESTS
// ============================================================================

describe('generateFileId', () => {
  it('should generate unique IDs', () => {
    const id1 = generateFileId();
    const id2 = generateFileId();

    expect(id1).not.toBe(id2);
  });

  it('should start with "file_" prefix', () => {
    const id = generateFileId();
    expect(id.startsWith('file_')).toBe(true);
  });

  it('should follow enterprise UUID format (file_{uuid})', () => {
    const id = generateFileId();

    // Format: file_{xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx}
    // After "file_" prefix, the rest is a UUID v4
    const uuidPart = id.slice('file_'.length);
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

    expect(uuidRegex.test(uuidPart)).toBe(true);
  });
});

describe('getFileExtension', () => {
  it('should extract extension from filename', () => {
    expect(getFileExtension('photo.JPG')).toBe('jpg');
    expect(getFileExtension('document.PDF')).toBe('pdf');
    expect(getFileExtension('drawing.DXF')).toBe('dxf');
  });

  it('should return empty string for files without extension', () => {
    expect(getFileExtension('filename')).toBe('');
  });

  it('should handle multiple dots', () => {
    expect(getFileExtension('my.photo.name.jpg')).toBe('jpg');
  });
});

describe('parseStoragePath', () => {
  it('ADR-709 ANCHOR: tolerant reader still parses the legacy project-scoped path', () => {
    // Objects written before ADR-709 must stay reachable forever — otherwise
    // they become invisible garbage that no sweeper can bill for or delete.
    const path =
      'companies/company_xyz/projects/project_456/entities/contact/contact_789/domains/admin/categories/photos/files/file_abc123.jpg';

    const result = parseStoragePath(path);

    expect(result).not.toBeNull();
    expect(result?.companyId).toBe('company_xyz');
    expect(result?.legacyProjectId).toBe('project_456');
    expect(result?.entityType).toBe('contact');
    expect(result?.entityId).toBe('contact_789');
    expect(result?.domain).toBe('admin');
    expect(result?.category).toBe('photos');
    expect(result?.fileId).toBe('file_abc123');
    expect(result?.ext).toBe('jpg');
  });

  it('should parse the canonical path and flag it as non-legacy', () => {
    const path =
      'companies/company_xyz/entities/contact/contact_789/domains/admin/categories/photos/files/file_abc123.jpg';

    const result = parseStoragePath(path);

    expect(result).not.toBeNull();
    expect(result?.companyId).toBe('company_xyz');
    expect(result?.legacyProjectId).toBeUndefined();
  });

  it('should return null for system-level path (not supported)', () => {
    const path =
      'system/entities/building/building_123/domains/construction/categories/floorplans/files/file_def456.pdf';

    const result = parseStoragePath(path);

    // System paths are not supported - companyId is required
    expect(result).toBeNull();
  });

  it('should return null for invalid path', () => {
    expect(parseStoragePath('invalid/path')).toBeNull();
    expect(parseStoragePath('')).toBeNull();
  });

  it('should be reversible with buildStoragePath', () => {
    const original: StoragePathParams = {
      companyId: 'company_xyz',
      entityType: ENTITY_TYPES.CONTACT,
      entityId: 'contact_789',
      domain: FILE_DOMAINS.ADMIN,
      category: FILE_CATEGORIES.PHOTOS,
      fileId: 'file_abc123',
      ext: 'jpg',
    };

    const { path } = buildStoragePath(original);
    const parsed = parseStoragePath(path);

    expect(parsed).toEqual(original);
  });
});

// ============================================================================
// PREFIX BUILDERS — the SSoT every sweeper must derive from (ADR-709)
// ============================================================================

describe('storage prefixes (ADR-709)', () => {
  const entity = {
    companyId: 'company_xyz',
    entityType: ENTITY_TYPES.PROJECT,
    entityId: 'proj_1',
  } as const;

  it('entity prefix owns every object of that entity', () => {
    expect(buildEntityStoragePrefix(entity)).toBe(
      'companies/company_xyz/entities/project/proj_1/'
    );
  });

  it('category prefix narrows to one domain+category folder', () => {
    expect(
      buildCategoryStoragePrefix({
        ...entity,
        domain: FILE_DOMAINS.CONSTRUCTION,
        category: FILE_CATEGORIES.FLOORPLANS,
      })
    ).toBe(
      'companies/company_xyz/entities/project/proj_1/domains/construction/categories/floorplans/files/'
    );
  });

  it('ANCHOR: every built path lives under its own entity prefix', () => {
    // This is the invariant that lets a prefix sweep be complete. If a builder
    // ever emits a path outside this prefix, deletion silently leaks objects —
    // exactly the pre-ADR-709 failure.
    const { path } = buildStoragePath({
      ...entity,
      domain: FILE_DOMAINS.CONSTRUCTION,
      category: FILE_CATEGORIES.FLOORPLANS,
      fileId: 'file_1',
      ext: 'pdf',
    });

    expect(path.startsWith(buildEntityStoragePrefix(entity))).toBe(true);
  });

  it('legacy prefix reaches the pre-ADR-709 tree, at entity and category depth', () => {
    expect(buildLegacyProjectScopedPrefix('proj_9', entity)).toBe(
      'companies/company_xyz/projects/proj_9/entities/project/proj_1/'
    );
    expect(
      buildLegacyProjectScopedPrefix('proj_9', {
        ...entity,
        domain: FILE_DOMAINS.CONSTRUCTION,
        category: FILE_CATEGORIES.FLOORPLANS,
      })
    ).toBe(
      'companies/company_xyz/projects/proj_9/entities/project/proj_1/domains/construction/categories/floorplans/files/'
    );
  });

  it('ANCHOR: a legacy path parses back to the legacy project id', () => {
    // Closes the loop: what the legacy builder emits, the tolerant reader must
    // recognise — otherwise migration tooling cannot find what the sweeper walks.
    const prefix = buildLegacyProjectScopedPrefix('proj_9', {
      ...entity,
      domain: FILE_DOMAINS.CONSTRUCTION,
      category: FILE_CATEGORIES.FLOORPLANS,
    });

    const parsed = parseStoragePath(`${prefix}file_1.pdf`);

    expect(parsed?.legacyProjectId).toBe('proj_9');
    expect(parsed?.entityId).toBe('proj_1');
  });
});
