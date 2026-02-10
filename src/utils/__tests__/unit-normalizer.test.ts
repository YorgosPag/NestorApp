/**
 * 🧪 ENTERPRISE: Unit Tests for Unit Normalizer
 *
 * Comprehensive test suite for unit normalization functions.
 * Tests all edge cases, error conditions, and business logic.
 *
 * @author Claude AI Assistant
 * @created 2026-01-23
 * @version 1.0.0
 * @enterprise Production-ready test suite
 */

import { Timestamp } from 'firebase/firestore';
import {
  normalizeUnit,
  validateUnitCompleteness,
  prepareUnitForFirestore,
  getUnitDisplaySummary
} from '../unit-normalizer';
import type {
  UnitDoc,
  BackfillDefaults
} from '@/types/unit';

// ============================================================================
// TEST DATA
// ============================================================================

const mockTimestamp = Timestamp.fromDate(new Date('2024-01-23T00:00:00Z'));

const minimalUnitDoc: UnitDoc = {
  id: 'unit-001',
  name: 'Unit 001',
  type: 'apartment',
  building: 'Building A',
  buildingId: 'building-a-id',
  project: 'Project Alpha',
  floorId: 'floor-01',
  floor: 1,
  status: 'for-sale',
  unitCoverage: {
    hasPhotos: false,
    hasFloorplans: false,
    hasDocuments: false,
    updatedAt: mockTimestamp
  }
};

const completeUnitDoc: UnitDoc = {
  ...minimalUnitDoc,
  code: 'U001',
  useCategory: 'residential',
  operationalStatus: 'ready',
  price: 250000,
  area: 85.5,
  description: 'Modern apartment with sea view',
  soldTo: 'contact-123',
  saleDate: mockTimestamp.toDate().toISOString(),
  unitName: 'Sea View Apartment',
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
  unitAmenities: ['garden', 'pool'],
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
  unitCoverage: {
    hasPhotos: true,
    hasFloorplans: true,
    hasDocuments: true,
    updatedAt: mockTimestamp
  }
};

const backfillDefaults: BackfillDefaults = {
  // Identity fields
  id: 'default-id',
  name: 'Default Unit',
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
// TESTS: normalizeUnit
// ============================================================================

describe('normalizeUnit', () => {
  describe('Post-backfill validation (no backfillData)', () => {
    test('should accept complete valid unit document', () => {
      const result = normalizeUnit(completeUnitDoc);
      
      expect(result.id).toBe('unit-001');
      expect(result.name).toBe('Unit 001');
      expect(result.type).toBe('apartment');
      expect(result.orientations).toEqual(['north', 'east']);
      expect(result.views).toHaveLength(2);
      expect(result.linkedSpaces).toHaveLength(2);
    });

    test('should accept minimal valid unit document', () => {
      const result = normalizeUnit(minimalUnitDoc);
      
      expect(result.id).toBe('unit-001');
      expect(result.orientations).toEqual([]);
      expect(result.views).toEqual([]);
      expect(result.interiorFeatures).toEqual([]);
    });

    test('should throw error for missing required field: id', () => {
      const invalidDoc = { ...minimalUnitDoc, id: undefined } as unknown as UnitDoc;
      
      expect(() => normalizeUnit(invalidDoc)).toThrow(
        'Invalid unit data: missing required fields post-backfill. Missing: id'
      );
    });

    test('should throw error for missing required field: name', () => {
      const invalidDoc = { ...minimalUnitDoc, name: undefined } as unknown as UnitDoc;
      
      expect(() => normalizeUnit(invalidDoc)).toThrow(
        'Invalid unit data: missing required fields post-backfill. Missing: name'
      );
    });

    test('should throw error for missing required field: type', () => {
      const invalidDoc = { ...minimalUnitDoc, type: undefined } as unknown as UnitDoc;
      
      expect(() => normalizeUnit(invalidDoc)).toThrow(
        'Invalid unit data: missing required fields post-backfill. Missing: type'
      );
    });

    test('should throw error for missing unitCoverage.updatedAt', () => {
      const invalidDoc = {
        ...minimalUnitDoc,
        unitCoverage: {
          hasPhotos: false,
          hasFloorplans: false,
          hasDocuments: false,
          updatedAt: undefined
        }
      } as unknown as UnitDoc;
      
      expect(() => normalizeUnit(invalidDoc)).toThrow(
        'unitCoverage.updatedAt is required post-backfill'
      );
    });

    test('should validate that all required fields exist', () => {
      const result = normalizeUnit(minimalUnitDoc);

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
      expect(result.unitAmenities).toEqual([]);
      expect(result.linkedSpaces).toEqual([]);

      // Coverage should have proper defaults
      expect(result.unitCoverage.hasPhotos).toBe(false);
      expect(result.unitCoverage.hasFloorplans).toBe(false);
      expect(result.unitCoverage.hasDocuments).toBe(false);
    });

    test('should throw error for missing hierarchy fields', () => {
      const invalidDoc = { ...minimalUnitDoc, building: undefined } as unknown as UnitDoc;

      expect(() => normalizeUnit(invalidDoc)).toThrow(
        'Invalid unit data: missing required fields post-backfill. Missing: building'
      );
    });
  });

  describe('Pre-backfill migration (with backfillData)', () => {
    test('should use backfill defaults for missing required fields', () => {
      const incompleteDoc = {
        unitCoverage: {
          hasPhotos: false,
          hasFloorplans: false,
          hasDocuments: false
        }
      } as unknown as UnitDoc;
      
      const result = normalizeUnit(incompleteDoc, backfillDefaults);
      
      expect(result.id).toBe('default-id');
      expect(result.name).toBe('Default Unit');
      expect(result.type).toBe('apartment');
      expect(result.unitCoverage.updatedAt).toBe(mockTimestamp);
    });

    test('should prefer document values over backfill defaults', () => {
      const partialDoc = {
        id: 'custom-id',
        unitCoverage: {
          hasPhotos: true,
          hasFloorplans: false,
          hasDocuments: false
        }
      } as unknown as UnitDoc;
      
      const result = normalizeUnit(partialDoc, backfillDefaults);
      
      expect(result.id).toBe('custom-id'); // Document value
      expect(result.name).toBe('Default Unit'); // Backfill value
      expect(result.type).toBe('apartment'); // Backfill value
    });

    test('should handle all extended fields during migration', () => {
      const result = normalizeUnit(completeUnitDoc, backfillDefaults);
      
      // Verify all extended fields are preserved
      expect(result.areas).toEqual(completeUnitDoc.areas);
      expect(result.layout).toEqual(completeUnitDoc.layout);
      expect(result.orientations).toEqual(completeUnitDoc.orientations);
      expect(result.views).toEqual(completeUnitDoc.views);
      expect(result.condition).toEqual(completeUnitDoc.condition);
      expect(result.energy).toEqual(completeUnitDoc.energy);
      expect(result.finishes).toEqual(completeUnitDoc.finishes);
      expect(result.interiorFeatures).toEqual(completeUnitDoc.interiorFeatures);
      expect(result.securityFeatures).toEqual(completeUnitDoc.securityFeatures);
      expect(result.unitAmenities).toEqual(completeUnitDoc.unitAmenities);
      expect(result.linkedSpaces).toEqual(completeUnitDoc.linkedSpaces);
    });
  });

  describe('Edge cases and type safety', () => {
    test('should handle empty arrays correctly', () => {
      const docWithEmptyArrays = {
        ...minimalUnitDoc,
        orientations: [],
        views: [],
        interiorFeatures: [],
        securityFeatures: [],
        unitAmenities: [],
        linkedSpaces: []
      };
      
      const result = normalizeUnit(docWithEmptyArrays);
      
      expect(result.orientations).toEqual([]);
      expect(result.views).toEqual([]);
      expect(result.interiorFeatures).toEqual([]);
      expect(result.securityFeatures).toEqual([]);
      expect(result.unitAmenities).toEqual([]);
      expect(result.linkedSpaces).toEqual([]);
    });

    test('should handle null vs undefined correctly', () => {
      const docWithNulls = {
        ...minimalUnitDoc,
        price: null,
        area: null,
        description: null,
        soldTo: null
      } as unknown as UnitDoc;

      const result = normalizeUnit(docWithNulls);

      // Nulls are preserved as null (not converted to undefined)
      expect(result.price).toBeNull();
      expect(result.area).toBeNull();
      expect(result.description).toBeNull();
      expect(result.soldTo).toBeNull();
    });

    test('should handle complex nested structures', () => {
      const result = normalizeUnit(completeUnitDoc);
      
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
// TESTS: validateUnitCompleteness
// ============================================================================

describe('validateUnitCompleteness', () => {
  test('should return 100% for complete unit', () => {
    const unit = normalizeUnit(completeUnitDoc);
    const result = validateUnitCompleteness(unit);
    
    expect(result.isComplete).toBe(true);
    expect(result.completenessPercentage).toBe(100);
    expect(result.missingItems).toEqual([]);
  });

  test('should return 0% for unit with no documentation', () => {
    const unit = normalizeUnit(minimalUnitDoc);
    const result = validateUnitCompleteness(unit);
    
    expect(result.isComplete).toBe(false);
    expect(result.completenessPercentage).toBe(0);
    expect(result.missingItems).toEqual(['unit.coverage.photos', 'unit.coverage.floorplans', 'unit.coverage.documents']);
  });

  test('should return 33.33% for unit with only photos', () => {
    const unitDoc: UnitDoc = {
      ...minimalUnitDoc,
      unitCoverage: {
        hasPhotos: true,
        hasFloorplans: false,
        hasDocuments: false,
        updatedAt: mockTimestamp
      }
    };
    
    const unit = normalizeUnit(unitDoc);
    const result = validateUnitCompleteness(unit);
    
    expect(result.isComplete).toBe(false);
    expect(result.completenessPercentage).toBeCloseTo(33.33, 1);
    expect(result.missingItems).toEqual(['unit.coverage.floorplans', 'unit.coverage.documents']);
  });

  test('should return 66.67% for unit with photos and floorplans', () => {
    const unitDoc: UnitDoc = {
      ...minimalUnitDoc,
      unitCoverage: {
        hasPhotos: true,
        hasFloorplans: true,
        hasDocuments: false,
        updatedAt: mockTimestamp
      }
    };
    
    const unit = normalizeUnit(unitDoc);
    const result = validateUnitCompleteness(unit);
    
    expect(result.isComplete).toBe(false);
    expect(result.completenessPercentage).toBeCloseTo(66.67, 1);
    expect(result.missingItems).toEqual(['unit.coverage.documents']);
  });

  test('should handle all missing items correctly', () => {
    const testCases = [
      { photos: false, floorplans: false, documents: false, expected: ['unit.coverage.photos', 'unit.coverage.floorplans', 'unit.coverage.documents'] },
      { photos: true, floorplans: false, documents: false, expected: ['unit.coverage.floorplans', 'unit.coverage.documents'] },
      { photos: false, floorplans: true, documents: false, expected: ['unit.coverage.photos', 'unit.coverage.documents'] },
      { photos: false, floorplans: false, documents: true, expected: ['unit.coverage.photos', 'unit.coverage.floorplans'] },
      { photos: true, floorplans: true, documents: false, expected: ['unit.coverage.documents'] },
      { photos: true, floorplans: false, documents: true, expected: ['unit.coverage.floorplans'] },
      { photos: false, floorplans: true, documents: true, expected: ['unit.coverage.photos'] },
      { photos: true, floorplans: true, documents: true, expected: [] }
    ];
    
    testCases.forEach(({ photos, floorplans, documents, expected }) => {
      const unitDoc: UnitDoc = {
        ...minimalUnitDoc,
        unitCoverage: {
          hasPhotos: photos,
          hasFloorplans: floorplans,
          hasDocuments: documents,
          updatedAt: mockTimestamp
        }
      };
      
      const unit = normalizeUnit(unitDoc);
      const result = validateUnitCompleteness(unit);
      
      expect(result.missingItems).toEqual(expected);
      expect(result.isComplete).toBe(expected.length === 0);
    });
  });
});

// ============================================================================
// TESTS: prepareUnitForFirestore
// ============================================================================

describe('prepareUnitForFirestore', () => {
  test('should include all required fields', () => {
    const unit = normalizeUnit(minimalUnitDoc);
    const doc = prepareUnitForFirestore(unit);
    
    // All required fields must be present
    expect(doc.id).toBe('unit-001');
    expect(doc.name).toBe('Unit 001');
    expect(doc.type).toBe('apartment');
    expect(doc.building).toBe('Building A');
    expect(doc.buildingId).toBe('building-a-id');
    expect(doc.project).toBe('Project Alpha');
    expect(doc.floorId).toBe('floor-01');
    expect(doc.floor).toBe(1);
    expect(doc.status).toBe('for-sale');
    expect(doc.unitCoverage).toBeDefined();
  });

  test('should exclude undefined optional fields', () => {
    const unit = normalizeUnit(minimalUnitDoc);
    const doc = prepareUnitForFirestore(unit);
    
    // Undefined fields should not be in the document
    expect('code' in doc).toBe(false);
    expect('useCategory' in doc).toBe(false);
    expect('operationalStatus' in doc).toBe(false);
    expect('price' in doc).toBe(false);
    expect('area' in doc).toBe(false);
    expect('description' in doc).toBe(false);
  });

  test('should include defined optional fields', () => {
    const unit = normalizeUnit(completeUnitDoc);
    const doc = prepareUnitForFirestore(unit);
    
    // All defined fields should be present
    expect(doc.code).toBe('U001');
    expect(doc.useCategory).toBe('residential');
    expect(doc.operationalStatus).toBe('ready');
    expect(doc.price).toBe(250000);
    expect(doc.area).toBe(85.5);
    expect(doc.description).toBe('Modern apartment with sea view');
  });

  test('should exclude empty arrays', () => {
    const unit = normalizeUnit(minimalUnitDoc);
    const doc = prepareUnitForFirestore(unit);
    
    // Empty arrays should not be in the document
    expect('orientations' in doc).toBe(false);
    expect('views' in doc).toBe(false);
    expect('interiorFeatures' in doc).toBe(false);
    expect('securityFeatures' in doc).toBe(false);
    expect('unitAmenities' in doc).toBe(false);
    expect('linkedSpaces' in doc).toBe(false);
  });

  test('should include non-empty arrays', () => {
    const unit = normalizeUnit(completeUnitDoc);
    const doc = prepareUnitForFirestore(unit);
    
    // Non-empty arrays should be present
    expect(doc.orientations).toEqual(['north', 'east']);
    expect(doc.views).toHaveLength(2);
    expect(doc.interiorFeatures).toEqual(['fireplace', 'smart-home']);
    expect(doc.securityFeatures).toEqual(['alarm', 'security-door', 'cctv']);
    expect(doc.unitAmenities).toEqual(['garden', 'pool']);
    expect(doc.linkedSpaces).toHaveLength(2);
  });

  test('should handle zero values correctly', () => {
    const unitDoc: UnitDoc = {
      ...minimalUnitDoc,
      price: 0,
      area: 0,
      floor: 0
    };
    
    const unit = normalizeUnit(unitDoc);
    const doc = prepareUnitForFirestore(unit);
    
    // Zero values should be preserved
    expect(doc.price).toBe(0);
    expect(doc.area).toBe(0);
    expect(doc.floor).toBe(0);
  });

  test('should preserve complex nested structures', () => {
    const unit = normalizeUnit(completeUnitDoc);
    const doc = prepareUnitForFirestore(unit);
    
    expect(doc.areas).toEqual(completeUnitDoc.areas);
    expect(doc.layout).toEqual(completeUnitDoc.layout);
    expect(doc.condition).toEqual(completeUnitDoc.condition);
    expect(doc.energy).toEqual(completeUnitDoc.energy);
    expect(doc.finishes).toEqual(completeUnitDoc.finishes);
    expect(doc.systemsOverride).toEqual(completeUnitDoc.systemsOverride);
  });
});

// ============================================================================
// TESTS: getUnitDisplaySummary
// ============================================================================

describe('getUnitDisplaySummary', () => {
  test('should generate correct title and subtitle with i18n', () => {
    const unit = normalizeUnit(minimalUnitDoc);
    const summary = getUnitDisplaySummary(unit);

    expect(summary.title).toBe('Unit 001');
    expect(summary.subtitle).toEqual({
      key: 'unit.subtitle.format',
      params: {
        type: 'apartment',
        building: 'Building A',
        floor: 1
      }
    });
  });

  test('should use unit ID as fallback title', () => {
    const unitDoc: UnitDoc = { ...minimalUnitDoc, name: '' };
    const unit = normalizeUnit(unitDoc, backfillDefaults);
    unit.name = ''; // Override after normalization
    const summary = getUnitDisplaySummary(unit);
    
    expect(summary.title).toBe('Unit unit-001');
  });

  test('should generate correct badges with i18n keys', () => {
    const unit = normalizeUnit(completeUnitDoc);
    const summary = getUnitDisplaySummary(unit);

    expect(summary.badges).toContainEqual({ key: 'unit.status.ready' });
    expect(summary.badges).toContainEqual({ key: 'unit.features.views', params: { count: 2 } });
    expect(summary.badges).toContainEqual({ key: 'unit.spaces.parking', params: { count: 1 } });
    expect(summary.badges).toContainEqual({ key: 'unit.spaces.storage', params: { count: 1 } });
  });

  test('should handle single view correctly with i18n', () => {
    const unitDoc: UnitDoc = {
      ...minimalUnitDoc,
      views: [{ type: 'sea' as const, quality: 'full' as const }]
    };

    const unit = normalizeUnit(unitDoc);
    const summary = getUnitDisplaySummary(unit);

    expect(summary.badges).toContainEqual({ key: 'unit.features.views', params: { count: 1 } });
  });

  test('should handle multiple parking spaces with i18n', () => {
    const unitDoc: UnitDoc = {
      ...minimalUnitDoc,
      linkedSpaces: [
        { spaceType: 'parking' as const, spaceId: 'p1', quantity: 1, inclusion: 'included' as const, metadata: {} },
        { spaceType: 'parking' as const, spaceId: 'p2', quantity: 1, inclusion: 'included' as const, metadata: {} },
        { spaceType: 'parking' as const, spaceId: 'p3', quantity: 1, inclusion: 'included' as const, metadata: {} }
      ]
    };

    const unit = normalizeUnit(unitDoc);
    const summary = getUnitDisplaySummary(unit);

    expect(summary.badges).toContainEqual({ key: 'unit.spaces.parking', params: { count: 3 } });
  });

  test('should return empty badges for minimal unit', () => {
    const unit = normalizeUnit(minimalUnitDoc);
    const summary = getUnitDisplaySummary(unit);
    
    expect(summary.badges).toEqual([]);
  });

  test('should not include Ready badge for non-ready units', () => {
    const unitDoc: UnitDoc = {
      ...completeUnitDoc,
      operationalStatus: 'under-construction' as const
    };

    const unit = normalizeUnit(unitDoc);
    const summary = getUnitDisplaySummary(unit);

    expect(summary.badges).not.toContainEqual({ key: 'unit.status.ready' });
  });

  test('should calculate correct completeness percentage', () => {
    const completeUnit = normalizeUnit(completeUnitDoc);
    const completeSummary = getUnitDisplaySummary(completeUnit);
    expect(completeSummary.completeness).toBe(100);
    
    const incompleteUnit = normalizeUnit(minimalUnitDoc);
    const incompleteSummary = getUnitDisplaySummary(incompleteUnit);
    expect(incompleteSummary.completeness).toBe(0);
  });
});

// ============================================================================
// TESTS: Performance and Scale
// ============================================================================

describe('Performance tests', () => {
  test('should handle large arrays efficiently', () => {
    const largeDoc: UnitDoc = {
      ...completeUnitDoc,
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
    const unit = normalizeUnit(largeDoc);
    const duration = performance.now() - start;
    
    expect(unit.interiorFeatures).toHaveLength(100);
    expect(unit.linkedSpaces).toHaveLength(50);
    expect(duration).toBeLessThan(10); // Should complete in less than 10ms
  });

  test('should handle deeply nested structures', () => {
    const deepDoc: UnitDoc = {
      ...completeUnitDoc,
      linkedSpaces: [{
        spaceType: 'parking' as const,
        spaceId: 'deep-1',
        quantity: 1,
        inclusion: 'included' as const,
        metadata: { level5: 'deep value' }
      }]
    };
    
    const unit = normalizeUnit(deepDoc);
    const doc = prepareUnitForFirestore(unit);
    
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
    const original = completeUnitDoc;
    const normalized = normalizeUnit(original);
    const prepared = prepareUnitForFirestore(normalized);
    const reNormalized = normalizeUnit(prepared);
    
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
      ...minimalUnitDoc,
      floor: '1' as unknown as number, // String instead of number
      price: '250000' as unknown as number // String instead of number
    };
    
    const unit = normalizeUnit(docWithWrongTypes);
    
    // Values should be passed through without coercion
    expect(typeof unit.floor).toBe('string');
    expect(typeof unit.price).toBe('string');
  });
});











