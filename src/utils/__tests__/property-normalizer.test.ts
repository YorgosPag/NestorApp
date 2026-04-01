/**
 * 🧪 ENTERPRISE: Tests for Property Normalizer
 *
 * Comprehensive test suite for property normalization functions.
 * Tests all edge cases, error conditions, and business logic.
 *
 * @author Claude AI Assistant
 * @created 2026-01-23
 * @version 1.0.0
 * @enterprise Production-ready test suite
 */

import { Timestamp } from 'firebase/firestore';
import {
  normalizeProperty,
  validatePropertyCompleteness,
  preparePropertyForFirestore,
  getPropertyDisplaySummary
} from '../property-normalizer';
import type {
  PropertyDoc,
  BackfillDefaults
} from '@/types/property';

// ============================================================================
// TEST DATA
// ============================================================================

const mockTimestamp = Timestamp.fromDate(new Date('2024-01-23T00:00:00Z'));

const minimalPropertyDoc: PropertyDoc = {
  id: 'property-001',
  name: 'Property 001',
  type: 'apartment',
  building: 'Building A',
  buildingId: 'building-a-id',
  project: 'Project Alpha',
  floorId: 'floor-01',
  floor: 1,
  status: 'for-sale',
  propertyCoverage: {
    hasPhotos: false,
    hasFloorplans: false,
    hasDocuments: false,
    updatedAt: mockTimestamp
  }
};

const completePropertyDoc: PropertyDoc = {
  ...minimalPropertyDoc,
  code: 'U001',
  useCategory: 'residential',
  operationalStatus: 'ready',
  price: 250000,
  area: 85.5,
  description: 'Modern apartment with sea view',
  soldTo: 'contact-123',
  saleDate: mockTimestamp.toDate().toISOString(),
  propertyName: 'Sea View Apartment',
  areas: {
    gross: 100,
    net: 85,
    balcony: 10,
    terrace: 5
  },
  layout: {
    bedrooms: 2,
    bathrooms: 1,
    wc: 1,
    balconies: 2,
    totalRooms: 4
  },
  orientations: ['north', 'east'],
  views: [
    { type: 'sea', quality: 'full' },
    { type: 'mountain', quality: 'partial' }
  ],
  condition: 'excellent',
  renovationYear: 2023,
  deliveryDate: mockTimestamp,
  systemsOverride: {
    heatingType: 'central',
    heatingFuel: 'natural-gas',
    coolingType: 'split-units',
    waterHeating: 'solar'
  },
  energy: {
    class: 'A+',
    certificateId: 'CERT-2024-001',
    certificateDate: mockTimestamp,
    validUntil: mockTimestamp
  },
  finishes: {
    flooring: ['wood'],
    windowFrames: 'aluminum',
    glazing: 'double'
  },
  interiorFeatures: ['fireplace', 'smart-home'],
  securityFeatures: ['alarm', 'security-door', 'cctv'],
  propertyAmenities: ['garden', 'pool'],
  linkedSpaces: [
    {
      spaceType: 'parking' as const,
      spaceId: 'parking-001',
      quantity: 1,
      inclusion: 'included' as const,
      metadata: { level: 'B1', number: '15' }
    },
    {
      spaceType: 'storage',
      spaceId: 'storage-001',
      quantity: 1,
      inclusion: 'included' as const,
      metadata: { level: 'B1', size: '5sqm' }
    }
  ],
  propertyCoverage: {
    hasPhotos: true,
    hasFloorplans: true,
    hasDocuments: true,
    updatedAt: mockTimestamp
  }
};

const backfillDefaults: BackfillDefaults = {
  // Identity fields
  id: 'default-id',
  name: 'Default Property',
  type: 'apartment',

  // Hierarchy fields
  building: 'Default Building',
  buildingId: 'default-building-id',
  project: 'Default Project',
  floorId: 'default-floor-id',
  floor: 0,

  // Status
  status: 'draft',

  // Timestamp
  updatedAt: mockTimestamp
};

// ============================================================================
// TESTS: normalizeProperty
// ============================================================================

describe('normalizeProperty', () => {
  describe('Post-backfill validation (no backfillData)', () => {
    test('should accept complete valid property document', () => {
      const result = normalizeProperty(completePropertyDoc);

      expect(result.id).toBe('property-001');
      expect(result.name).toBe('Property 001');
      expect(result.type).toBe('apartment');
      expect(result.orientations).toEqual(['north', 'east']);
      expect(result.views).toHaveLength(2);
      expect(result.linkedSpaces).toHaveLength(2);
    });

    test('should accept minimal valid property document', () => {
      const result = normalizeProperty(minimalPropertyDoc);

      expect(result.id).toBe('property-001');
      expect(result.orientations).toEqual([]);
      expect(result.views).toEqual([]);
      expect(result.interiorFeatures).toEqual([]);
    });

    test('should throw error for missing required field: id', () => {
      const invalidDoc = { ...minimalPropertyDoc, id: undefined } as unknown as PropertyDoc;
      
      expect(() => normalizeProperty(invalidDoc)).toThrow(
        'Invalid property data: missing required fields post-backfill. Missing: id'
      );
    });

    test('should throw error for missing required field: name', () => {
      const invalidDoc = { ...minimalPropertyDoc, name: undefined } as unknown as PropertyDoc;
      
      expect(() => normalizeProperty(invalidDoc)).toThrow(
        'Invalid property data: missing required fields post-backfill. Missing: name'
      );
    });

    test('should throw error for missing required field: type', () => {
      const invalidDoc = { ...minimalPropertyDoc, type: undefined } as unknown as PropertyDoc;
      
      expect(() => normalizeProperty(invalidDoc)).toThrow(
        'Invalid property data: missing required fields post-backfill. Missing: type'
      );
    });

    test('should throw error for missing propertyCoverage.updatedAt', () => {
      const invalidDoc = {
        ...minimalPropertyDoc,
        propertyCoverage: {
          hasPhotos: false,
          hasFloorplans: false,
          hasDocuments: false,
          updatedAt: undefined
        }
      } as unknown as PropertyDoc;
      
      expect(() => normalizeProperty(invalidDoc)).toThrow(
        'propertyCoverage.updatedAt is required post-backfill'
      );
    });

    test('should validate that all required fields exist', () => {
      const result = normalizeProperty(minimalPropertyDoc);

      // Check that required fields exist (no defaults)
      expect(result.building).toBe('Building A');
      expect(result.buildingId).toBe('building-a-id');
      expect(result.floor).toBe(1);
      expect(result.status).toBe('for-sale');

      // Arrays should default to empty
      expect(result.orientations).toEqual([]);
      expect(result.views).toEqual([]);
      expect(result.interiorFeatures).toEqual([]);
      expect(result.securityFeatures).toEqual([]);
      expect(result.propertyAmenities).toEqual([]);
      expect(result.linkedSpaces).toEqual([]);

      // Coverage should have proper defaults
      expect(result.propertyCoverage.hasPhotos).toBe(false);
      expect(result.propertyCoverage.hasFloorplans).toBe(false);
      expect(result.propertyCoverage.hasDocuments).toBe(false);
    });

    test('should throw error for missing hierarchy fields', () => {
      const invalidDoc = { ...minimalPropertyDoc, building: undefined } as unknown as PropertyDoc;

      expect(() => normalizeProperty(invalidDoc)).toThrow(
        'Invalid property data: missing required fields post-backfill. Missing: building'
      );
    });
  });

  describe('Pre-backfill migration (with backfillData)', () => {
    test('should use backfill defaults for missing required fields', () => {
      const incompleteDoc = {
        propertyCoverage: {
          hasPhotos: false,
          hasFloorplans: false,
          hasDocuments: false
        }
      } as unknown as PropertyDoc;
      
      const result = normalizeProperty(incompleteDoc, backfillDefaults);
      
      expect(result.id).toBe('default-id');
      expect(result.name).toBe('Default Property');
      expect(result.type).toBe('apartment');
      expect(result.propertyCoverage.updatedAt).toBe(mockTimestamp);
    });

    test('should prefer document values over backfill defaults', () => {
      const partialDoc = {
        id: 'custom-id',
        propertyCoverage: {
          hasPhotos: true,
          hasFloorplans: false,
          hasDocuments: false
        }
      } as unknown as PropertyDoc;
      
      const result = normalizeProperty(partialDoc, backfillDefaults);
      
      expect(result.id).toBe('custom-id'); // Document value
      expect(result.name).toBe('Default Property'); // Backfill value
      expect(result.type).toBe('apartment'); // Backfill value
    });

    test('should handle all extended fields during migration', () => {
      const result = normalizeProperty(completePropertyDoc, backfillDefaults);
      
      // Verify all extended fields are preserved
      expect(result.areas).toEqual(completePropertyDoc.areas);
      expect(result.layout).toEqual(completePropertyDoc.layout);
      expect(result.orientations).toEqual(completePropertyDoc.orientations);
      expect(result.views).toEqual(completePropertyDoc.views);
      expect(result.condition).toEqual(completePropertyDoc.condition);
      expect(result.energy).toEqual(completePropertyDoc.energy);
      expect(result.finishes).toEqual(completePropertyDoc.finishes);
      expect(result.interiorFeatures).toEqual(completePropertyDoc.interiorFeatures);
      expect(result.securityFeatures).toEqual(completePropertyDoc.securityFeatures);
      expect(result.propertyAmenities).toEqual(completePropertyDoc.propertyAmenities);
      expect(result.linkedSpaces).toEqual(completePropertyDoc.linkedSpaces);
    });
  });

  describe('Edge cases and type safety', () => {
    test('should handle empty arrays correctly', () => {
      const docWithEmptyArrays = {
        ...minimalPropertyDoc,
        orientations: [],
        views: [],
        interiorFeatures: [],
        securityFeatures: [],
        propertyAmenities: [],
        linkedSpaces: []
      };
      
      const result = normalizeProperty(docWithEmptyArrays);
      
      expect(result.orientations).toEqual([]);
      expect(result.views).toEqual([]);
      expect(result.interiorFeatures).toEqual([]);
      expect(result.securityFeatures).toEqual([]);
      expect(result.propertyAmenities).toEqual([]);
      expect(result.linkedSpaces).toEqual([]);
    });

    test('should handle null vs undefined correctly', () => {
      const docWithNulls = {
        ...minimalPropertyDoc,
        price: null,
        area: null,
        description: null,
        soldTo: null
      } as unknown as PropertyDoc;

      const result = normalizeProperty(docWithNulls);

      // Nulls are preserved as null (not converted to undefined)
      expect(result.price).toBeNull();
      expect(result.area).toBeNull();
      expect(result.description).toBeNull();
      expect(result.soldTo).toBeNull();
    });

    test('should handle complex nested structures', () => {
      const result = normalizeProperty(completePropertyDoc);
      
      // Test nested object integrity
      expect(result.areas?.gross).toBe(100);
      expect(result.layout?.totalRooms).toBe(4);
      expect(result.condition).toBe('excellent');
      expect(result.energy?.class).toBe('A+');
      expect(result.finishes?.flooring).toEqual(['wood']);
      
      // Test nested array structures
      expect(result.views?.[0]).toEqual({ type: 'sea', quality: 'full' });
      expect(result.linkedSpaces?.[0].metadata).toEqual({ level: 'B1', number: '15' });
    });
  });
});

// ============================================================================
// TESTS: validatePropertyCompleteness
// ============================================================================

describe('validatePropertyCompleteness', () => {
  test('should return 100% for complete property', () => {
    const property = normalizeProperty(completePropertyDoc);
    const result = validatePropertyCompleteness(property);
    
    expect(result.isComplete).toBe(true);
    expect(result.completenessPercentage).toBe(100);
    expect(result.missingItems).toEqual([]);
  });

  test('should return 0% for property with no documentation', () => {
    const property = normalizeProperty(minimalPropertyDoc);
    const result = validatePropertyCompleteness(property);
    
    expect(result.isComplete).toBe(false);
    expect(result.completenessPercentage).toBe(0);
    expect(result.missingItems).toEqual(['property.coverage.photos', 'property.coverage.floorplans', 'property.coverage.documents']);
  });

  test('should return 33.33% for property with only photos', () => {
    const propertyDoc: PropertyDoc = {
      ...minimalPropertyDoc,
      propertyCoverage: {
        hasPhotos: true,
        hasFloorplans: false,
        hasDocuments: false,
        updatedAt: mockTimestamp
      }
    };
    
    const property = normalizeProperty(propertyDoc);
    const result = validatePropertyCompleteness(property);

    expect(result.isComplete).toBe(false);
    expect(result.completenessPercentage).toBeCloseTo(33.33, 1);
    expect(result.missingItems).toEqual(['property.coverage.floorplans', 'property.coverage.documents']);
  });

  test('should return 66.67% for property with photos and floorplans', () => {
    const propertyDoc: PropertyDoc = {
      ...minimalPropertyDoc,
      propertyCoverage: {
        hasPhotos: true,
        hasFloorplans: true,
        hasDocuments: false,
        updatedAt: mockTimestamp
      }
    };

    const property = normalizeProperty(propertyDoc);
    const result = validatePropertyCompleteness(property);
    
    expect(result.isComplete).toBe(false);
    expect(result.completenessPercentage).toBeCloseTo(66.67, 1);
    expect(result.missingItems).toEqual(['property.coverage.documents']);
  });

  test('should handle all missing items correctly', () => {
    const testCases = [
      { photos: false, floorplans: false, documents: false, expected: ['property.coverage.photos', 'property.coverage.floorplans', 'property.coverage.documents'] },
      { photos: true, floorplans: false, documents: false, expected: ['property.coverage.floorplans', 'property.coverage.documents'] },
      { photos: false, floorplans: true, documents: false, expected: ['property.coverage.photos', 'property.coverage.documents'] },
      { photos: false, floorplans: false, documents: true, expected: ['property.coverage.photos', 'property.coverage.floorplans'] },
      { photos: true, floorplans: true, documents: false, expected: ['property.coverage.documents'] },
      { photos: true, floorplans: false, documents: true, expected: ['property.coverage.floorplans'] },
      { photos: false, floorplans: true, documents: true, expected: ['property.coverage.photos'] },
      { photos: true, floorplans: true, documents: true, expected: [] }
    ];
    
    testCases.forEach(({ photos, floorplans, documents, expected }) => {
      const propDoc: PropertyDoc = {
        ...minimalPropertyDoc,
        propertyCoverage: {
          hasPhotos: photos,
          hasFloorplans: floorplans,
          hasDocuments: documents,
          updatedAt: mockTimestamp
        }
      };

      const property = normalizeProperty(propDoc);
      const result = validatePropertyCompleteness(property);
      
      expect(result.missingItems).toEqual(expected);
      expect(result.isComplete).toBe(expected.length === 0);
    });
  });
});

// ============================================================================
// TESTS: preparePropertyForFirestore
// ============================================================================

describe('preparePropertyForFirestore', () => {
  test('should include all required fields', () => {
    const property = normalizeProperty(minimalPropertyDoc);
    const doc = preparePropertyForFirestore(property);

    // All required fields must be present
    expect(doc.id).toBe('property-001');
    expect(doc.name).toBe('Property 001');
    expect(doc.type).toBe('apartment');
    expect(doc.building).toBe('Building A');
    expect(doc.buildingId).toBe('building-a-id');
    expect(doc.project).toBe('Project Alpha');
    expect(doc.floorId).toBe('floor-01');
    expect(doc.floor).toBe(1);
    expect(doc.status).toBe('for-sale');
    expect(doc.propertyCoverage).toBeDefined();
  });

  test('should exclude undefined optional fields', () => {
    const property = normalizeProperty(minimalPropertyDoc);
    const doc = preparePropertyForFirestore(property);

    // Undefined fields should not be in the document
    expect('code' in doc).toBe(false);
    expect('useCategory' in doc).toBe(false);
    expect('operationalStatus' in doc).toBe(false);
    expect('price' in doc).toBe(false);
    expect('area' in doc).toBe(false);
    expect('description' in doc).toBe(false);
  });

  test('should include defined optional fields', () => {
    const property = normalizeProperty(completePropertyDoc);
    const doc = preparePropertyForFirestore(property);

    // All defined fields should be present
    expect(doc.code).toBe('U001');
    expect(doc.useCategory).toBe('residential');
    expect(doc.operationalStatus).toBe('ready');
    expect(doc.price).toBe(250000);
    expect(doc.area).toBe(85.5);
    expect(doc.description).toBe('Modern apartment with sea view');
  });

  test('should exclude empty arrays', () => {
    const property = normalizeProperty(minimalPropertyDoc);
    const doc = preparePropertyForFirestore(property);

    // Empty arrays should not be in the document
    expect('orientations' in doc).toBe(false);
    expect('views' in doc).toBe(false);
    expect('interiorFeatures' in doc).toBe(false);
    expect('securityFeatures' in doc).toBe(false);
    expect('propertyAmenities' in doc).toBe(false);
    expect('linkedSpaces' in doc).toBe(false);
  });

  test('should include non-empty arrays', () => {
    const property = normalizeProperty(completePropertyDoc);
    const doc = preparePropertyForFirestore(property);

    // Non-empty arrays should be present
    expect(doc.orientations).toEqual(['north', 'east']);
    expect(doc.views).toHaveLength(2);
    expect(doc.interiorFeatures).toEqual(['fireplace', 'smart-home']);
    expect(doc.securityFeatures).toEqual(['alarm', 'security-door', 'cctv']);
    expect(doc.propertyAmenities).toEqual(['garden', 'pool']);
    expect(doc.linkedSpaces).toHaveLength(2);
  });

  test('should handle zero values correctly', () => {
    const propDoc: PropertyDoc = {
      ...minimalPropertyDoc,
      price: 0,
      area: 0,
      floor: 0
    };

    const property = normalizeProperty(propDoc);
    const doc = preparePropertyForFirestore(property);

    // Zero values should be preserved
    expect(doc.price).toBe(0);
    expect(doc.area).toBe(0);
    expect(doc.floor).toBe(0);
  });

  test('should preserve complex nested structures', () => {
    const property = normalizeProperty(completePropertyDoc);
    const doc = preparePropertyForFirestore(property);

    expect(doc.areas).toEqual(completePropertyDoc.areas);
    expect(doc.layout).toEqual(completePropertyDoc.layout);
    expect(doc.condition).toEqual(completePropertyDoc.condition);
    expect(doc.energy).toEqual(completePropertyDoc.energy);
    expect(doc.finishes).toEqual(completePropertyDoc.finishes);
    expect(doc.systemsOverride).toEqual(completePropertyDoc.systemsOverride);
  });
});

// ============================================================================
// TESTS: getPropertyDisplaySummary
// ============================================================================

describe('getPropertyDisplaySummary', () => {
  test('should generate correct title and subtitle with i18n', () => {
    const property = normalizeProperty(minimalPropertyDoc);
    const summary = getPropertyDisplaySummary(property);

    expect(summary.title).toBe('Property 001');
    expect(summary.subtitle).toEqual({
      key: 'property.subtitle.format',
      params: {
        type: 'apartment',
        building: 'Building A',
        floor: 1
      }
    });
  });

  test('should use property ID as fallback title', () => {
    const propDoc: PropertyDoc = { ...minimalPropertyDoc, name: '' };
    const property = normalizeProperty(propDoc, backfillDefaults);
    property.name = ''; // Override after normalization
    const summary = getPropertyDisplaySummary(property);

    expect(summary.title).toBe('Property property-001');
  });

  test('should generate correct badges with i18n keys', () => {
    const property = normalizeProperty(completePropertyDoc);
    const summary = getPropertyDisplaySummary(property);

    expect(summary.badges).toContainEqual({ key: 'property.status.ready' });
    expect(summary.badges).toContainEqual({ key: 'property.features.views', params: { count: 2 } });
    expect(summary.badges).toContainEqual({ key: 'property.spaces.parking', params: { count: 1 } });
    expect(summary.badges).toContainEqual({ key: 'property.spaces.storage', params: { count: 1 } });
  });

  test('should handle single view correctly with i18n', () => {
    const propDoc: PropertyDoc = {
      ...minimalPropertyDoc,
      views: [{ type: 'sea' as const, quality: 'full' as const }]
    };

    const property = normalizeProperty(propDoc);
    const summary = getPropertyDisplaySummary(property);

    expect(summary.badges).toContainEqual({ key: 'property.features.views', params: { count: 1 } });
  });

  test('should handle multiple parking spaces with i18n', () => {
    const propDoc: PropertyDoc = {
      ...minimalPropertyDoc,
      linkedSpaces: [
        { spaceType: 'parking' as const, spaceId: 'p1', quantity: 1, inclusion: 'included' as const, metadata: {} },
        { spaceType: 'parking' as const, spaceId: 'p2', quantity: 1, inclusion: 'included' as const, metadata: {} },
        { spaceType: 'parking' as const, spaceId: 'p3', quantity: 1, inclusion: 'included' as const, metadata: {} }
      ]
    };

    const property = normalizeProperty(propDoc);
    const summary = getPropertyDisplaySummary(property);

    expect(summary.badges).toContainEqual({ key: 'property.spaces.parking', params: { count: 3 } });
  });

  test('should return empty badges for minimal property', () => {
    const property = normalizeProperty(minimalPropertyDoc);
    const summary = getPropertyDisplaySummary(property);

    expect(summary.badges).toEqual([]);
  });

  test('should not include Ready badge for non-ready properties', () => {
    const propDoc: PropertyDoc = {
      ...completePropertyDoc,
      operationalStatus: 'under-construction' as const
    };

    const property = normalizeProperty(propDoc);
    const summary = getPropertyDisplaySummary(property);

    expect(summary.badges).not.toContainEqual({ key: 'property.status.ready' });
  });

  test('should calculate correct completeness percentage', () => {
    const completeProperty = normalizeProperty(completePropertyDoc);
    const completeSummary = getPropertyDisplaySummary(completeProperty);
    expect(completeSummary.completeness).toBe(100);

    const incompleteProperty = normalizeProperty(minimalPropertyDoc);
    const incompleteSummary = getPropertyDisplaySummary(incompleteProperty);
    expect(incompleteSummary.completeness).toBe(0);
  });
});

// ============================================================================
// TESTS: Performance and Scale
// ============================================================================

describe('Performance tests', () => {
  test('should handle large arrays efficiently', () => {
    const largeDoc: PropertyDoc = {
      ...completePropertyDoc,
      interiorFeatures: Array(100).fill('fireplace'),
      linkedSpaces: Array(50).fill(null).map((_, i) => ({
        spaceType: 'parking' as const,
        spaceId: `space-${i}`,
        quantity: 1,
        inclusion: 'included' as const,
        metadata: { index: i }
      }))
    };
    
    const start = performance.now();
    const property = normalizeProperty(largeDoc);
    const duration = performance.now() - start;

    expect(property.interiorFeatures).toHaveLength(100);
    expect(property.linkedSpaces).toHaveLength(50);
    expect(duration).toBeLessThan(10); // Should complete in less than 10ms
  });

  test('should handle deeply nested structures', () => {
    const deepDoc: PropertyDoc = {
      ...completePropertyDoc,
      linkedSpaces: [{
        spaceType: 'parking' as const,
        spaceId: 'deep-1',
        quantity: 1,
        inclusion: 'included' as const,
        metadata: { level5: 'deep value' }
      }]
    };
    
    const property = normalizeProperty(deepDoc);
    const doc = preparePropertyForFirestore(property);
    
    expect(doc.linkedSpaces?.[0].metadata).toBeDefined();
    const metadata = doc.linkedSpaces?.[0].metadata as Record<string, string | number | boolean> | undefined;
    expect(metadata?.level5).toBe('deep value');
  });
});

// ============================================================================
// TESTS: Type Safety
// ============================================================================

describe('Type safety tests', () => {
  test('should maintain type safety through normalization cycle', () => {
    const original = completePropertyDoc;
    const normalized = normalizeProperty(original);
    const prepared = preparePropertyForFirestore(normalized);
    const reNormalized = normalizeProperty(prepared);
    
    // Key fields should remain consistent
    expect(reNormalized.id).toBe(original.id);
    expect(reNormalized.name).toBe(original.name);
    expect(reNormalized.type).toBe(original.type);
    
    // Arrays should maintain their structure
    expect(reNormalized.orientations).toEqual(original.orientations);
    expect(reNormalized.views).toEqual(original.views);
    expect(reNormalized.linkedSpaces).toEqual(original.linkedSpaces);
  });

  test('should handle type coercion safely', () => {
    const docWithWrongTypes = {
      ...minimalPropertyDoc,
      floor: '1' as unknown as number, // String instead of number
      price: '250000' as unknown as number // String instead of number
    };
    
    const property = normalizeProperty(docWithWrongTypes);

    // Values should be passed through without coercion
    expect(typeof property.floor).toBe('string');
    expect(typeof property.price).toBe('string');
  });
});











