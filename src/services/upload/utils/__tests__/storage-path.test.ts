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
  it('should build full enterprise path with company and project', () => {
    const params: StoragePathParams = {
      companyId: 'company_xyz',
      projectId: 'project_456',
      entityType: ENTITY_TYPES.CONTACT,
      entityId: 'contact_789',
      domain: FILE_DOMAINS.ADMIN,
      category: FILE_CATEGORIES.PHOTOS,
      fileId: 'file_abc123',
      ext: 'jpg',
    };

    const result = buildStoragePath(params);

    expect(result.path).toBe(
      'companies/company_xyz/projects/project_456/entities/contact/contact_789/domains/admin/categories/photos/files/file_abc123.jpg'
    );
    expect(result.segments.companyId).toBe('company_xyz');
    expect(result.segments.projectId).toBe('project_456');
    expect(result.segments.entityType).toBe('contact');
  });

  it('should build path without project scope', () => {
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
    expect(result.segments.projectId).toBeUndefined();
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

  it('should contain timestamp', () => {
    const before = Date.now();
    const id = generateFileId();
    const after = Date.now();

    // Extract timestamp from id (format: file_{timestamp}_{random})
    const parts = id.split('_');
    const timestamp = parseInt(parts[1], 10);

    expect(timestamp).toBeGreaterThanOrEqual(before);
    expect(timestamp).toBeLessThanOrEqual(after);
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
  it('should parse full enterprise path', () => {
    const path =
      'companies/company_xyz/projects/project_456/entities/contact/contact_789/domains/admin/categories/photos/files/file_abc123.jpg';

    const result = parseStoragePath(path);

    expect(result).not.toBeNull();
    expect(result?.companyId).toBe('company_xyz');
    expect(result?.projectId).toBe('project_456');
    expect(result?.entityType).toBe('contact');
    expect(result?.entityId).toBe('contact_789');
    expect(result?.domain).toBe('admin');
    expect(result?.category).toBe('photos');
    expect(result?.fileId).toBe('file_abc123');
    expect(result?.ext).toBe('jpg');
  });

  it('should parse path without project', () => {
    const path =
      'companies/company_xyz/entities/contact/contact_789/domains/admin/categories/photos/files/file_abc123.jpg';

    const result = parseStoragePath(path);

    expect(result).not.toBeNull();
    expect(result?.companyId).toBe('company_xyz');
    expect(result?.projectId).toBeUndefined();
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
      projectId: 'project_456',
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
