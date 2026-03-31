/**
 * 🏢 ENTERPRISE PROPERTY NORMALIZER
 *
 * Clean normalization functions for Property documents
 * NO hardcoded defaults - uses server-provided backfill data
 *
 * @created 2026-01-23
 * @author Claude AI Assistant
 * @version 1.0.0
 * @enterprise Production-ready normalization system
 */

import type {
  PropertyDoc,
  PropertyModel,
  BackfillDefaults
} from '@/types/property';
import type { I18nParams } from '@/types/i18n-params';



/**
 * 🏢 ENTERPRISE: Clean normalizer function
 *
 * NO hardcoded domain defaults!
 * All defaults come from server-provided BackfillDefaults
 *
 * @param doc - Raw Firestore document (may have missing fields)
 * @param backfillData - Server-provided defaults for migration (optional)
 * @returns Normalized PropertyModel with all required fields
 * @throws Error if required fields missing post-backfill
 */
export function normalizeProperty(doc: PropertyDoc, backfillData?: BackfillDefaults): PropertyModel {
  // POST-BACKFILL: All required fields must exist
  if (!backfillData) {
    // Strict validation - no missing required fields allowed
    const missingFields: string[] = [];

    // Check all required fields
    if (!doc.id) missingFields.push('id');
    if (!doc.name) missingFields.push('name');
    if (!doc.type) missingFields.push('type');
    if (!doc.building) missingFields.push('building');
    if (!doc.buildingId) missingFields.push('buildingId');
    if (!doc.project) missingFields.push('project');
    if (!doc.floorId) missingFields.push('floorId');
    if (doc.floor === undefined || doc.floor === null) missingFields.push('floor');
    if (!doc.status) missingFields.push('status');

    if (missingFields.length > 0) {
      throw new Error(
        'Invalid property data: missing required fields post-backfill. ' +
        `Missing: ${missingFields.join(', ')}`
      );
    }

    if (!doc.unitCoverage?.updatedAt) {
      throw new Error('unitCoverage.updatedAt is required post-backfill');
    }

    // Return strictly typed model (all fields guaranteed to exist - NO DEFAULTS!)
    return {
      // Required identity fields
      id: doc.id,
      name: doc.name,
      type: doc.type,

      // Required hierarchy fields (MUST exist post-backfill)
      building: doc.building,
      buildingId: doc.buildingId,
      project: doc.project,
      floorId: doc.floorId,
      floor: doc.floor,

      // Legacy status field (MUST exist post-backfill)
      status: doc.status,

      // Optional fields with proper defaults
      code: doc.code,
      useCategory: doc.useCategory,
      operationalStatus: doc.operationalStatus,
      price: doc.price,
      area: doc.area,
      description: doc.description,
      soldTo: doc.soldTo,
      saleDate: doc.saleDate,
      unitName: doc.unitName,

      // Extended fields - arrays default to empty
      areas: doc.areas,
      layout: doc.layout,
      orientations: doc.orientations || [],
      views: doc.views || [],
      condition: doc.condition,
      renovationYear: doc.renovationYear,
      deliveryDate: doc.deliveryDate,
      systemsOverride: doc.systemsOverride,
      energy: doc.energy,
      finishes: doc.finishes,
      interiorFeatures: doc.interiorFeatures || [],
      securityFeatures: doc.securityFeatures || [],
      unitAmenities: doc.unitAmenities || [],
      linkedSpaces: doc.linkedSpaces || [],

      // Coverage with strict requirements
      unitCoverage: {
        hasPhotos: doc.unitCoverage?.hasPhotos ?? false,
        hasFloorplans: doc.unitCoverage?.hasFloorplans ?? false,
        hasDocuments: doc.unitCoverage?.hasDocuments ?? false,
        updatedAt: doc.unitCoverage.updatedAt
      }
    } as PropertyModel;
  }

  // PRE-BACKFILL: Use server-provided defaults (NO hardcoded values!)
  return {
    // Use server-generated values for required fields
    id: doc.id || backfillData.id,
    name: doc.name || backfillData.name,
    type: doc.type || backfillData.type,

    // Hierarchy fields from server backfill data
    building: doc.building || backfillData.building,
    buildingId: doc.buildingId || backfillData.buildingId,
    project: doc.project || backfillData.project,
    floorId: doc.floorId || backfillData.floorId,
    floor: doc.floor !== undefined ? doc.floor : backfillData.floor,

    // Status from server backfill
    status: doc.status || backfillData.status,

    // Optional fields
    code: doc.code,
    useCategory: doc.useCategory,
    operationalStatus: doc.operationalStatus,
    price: doc.price,
    area: doc.area,
    description: doc.description,
    soldTo: doc.soldTo,
    saleDate: doc.saleDate,
    unitName: doc.unitName,

    // Extended fields
    areas: doc.areas,
    layout: doc.layout,
    orientations: doc.orientations || [],
    views: doc.views || [],
    condition: doc.condition,
    renovationYear: doc.renovationYear,
    deliveryDate: doc.deliveryDate,
    systemsOverride: doc.systemsOverride,
    energy: doc.energy,
    finishes: doc.finishes,
    interiorFeatures: doc.interiorFeatures || [],
    securityFeatures: doc.securityFeatures || [],
    unitAmenities: doc.unitAmenities || [],
    linkedSpaces: doc.linkedSpaces || [],

    // Coverage with server timestamp
    unitCoverage: {
      hasPhotos: doc.unitCoverage?.hasPhotos ?? false,
      hasFloorplans: doc.unitCoverage?.hasFloorplans ?? false,
      hasDocuments: doc.unitCoverage?.hasDocuments ?? false,
      updatedAt: backfillData.updatedAt // Server-provided timestamp
    }
  } as PropertyModel;
}

/**
 * 🏢 ENTERPRISE: Validate property coverage completeness
 *
 * @param property - Property to validate
 * @returns Object with validation results and i18n keys for missing items
 */
export function validatePropertyCompleteness(property: PropertyModel): {
  isComplete: boolean;
  completenessPercentage: number;
  missingItems: string[]; // i18n keys
} {
  const missingItems: string[] = [];
  let score = 0;
  const totalItems = 3; // photos, floorplans, documents

  // Check documentation coverage - return i18n keys
  if (property.unitCoverage.hasPhotos) {
    score++;
  } else {
    missingItems.push('unit.coverage.photos');
  }

  if (property.unitCoverage.hasFloorplans) {
    score++;
  } else {
    missingItems.push('unit.coverage.floorplans');
  }

  if (property.unitCoverage.hasDocuments) {
    score++;
  } else {
    missingItems.push('unit.coverage.documents');
  }

  return {
    isComplete: missingItems.length === 0,
    completenessPercentage: (score / totalItems) * 100,
    missingItems // Returns i18n keys, not hardcoded strings
  };
}

/**
 * 🏢 ENTERPRISE: Prepare property for Firestore write
 *
 * Converts PropertyModel back to PropertyDoc format for storage
 * Removes undefined values to keep documents clean
 *
 * @param property - Normalized property model
 * @returns Clean document for Firestore
 */
export function preparePropertyForFirestore(property: PropertyModel): PropertyDoc {
  const doc: PropertyDoc = {
    // Required fields always included
    id: property.id,
    name: property.name,
    type: property.type,
    building: property.building,
    buildingId: property.buildingId,
    project: property.project,
    floorId: property.floorId,
    floor: property.floor,
    status: property.status,
    unitCoverage: property.unitCoverage
  };

  // Add optional fields only if they have values
  if (property.code) doc.code = property.code;
  if (property.useCategory) doc.useCategory = property.useCategory;
  if (property.operationalStatus) doc.operationalStatus = property.operationalStatus;
  if (property.price !== undefined) doc.price = property.price;
  if (property.area !== undefined) doc.area = property.area;
  if (property.description) doc.description = property.description;
  if (property.soldTo !== undefined) doc.soldTo = property.soldTo;
  if (property.saleDate) doc.saleDate = property.saleDate;
  if (property.unitName) doc.unitName = property.unitName;

  // Extended fields
  if (property.areas) doc.areas = property.areas;
  if (property.layout) doc.layout = property.layout;

  // Arrays - only include if not empty
  if (property.orientations && property.orientations.length > 0) {
    doc.orientations = property.orientations;
  }
  if (property.views && property.views.length > 0) {
    doc.views = property.views;
  }
  if (property.interiorFeatures && property.interiorFeatures.length > 0) {
    doc.interiorFeatures = property.interiorFeatures;
  }
  if (property.securityFeatures && property.securityFeatures.length > 0) {
    doc.securityFeatures = property.securityFeatures;
  }
  if (property.unitAmenities && property.unitAmenities.length > 0) {
    doc.unitAmenities = property.unitAmenities;
  }
  if (property.linkedSpaces && property.linkedSpaces.length > 0) {
    doc.linkedSpaces = property.linkedSpaces;
  }

  // Other optional complex fields
  if (property.condition) doc.condition = property.condition;
  if (property.renovationYear) doc.renovationYear = property.renovationYear;
  if (property.deliveryDate) doc.deliveryDate = property.deliveryDate;
  if (property.systemsOverride) doc.systemsOverride = property.systemsOverride;
  if (property.energy) doc.energy = property.energy;
  if (property.finishes) doc.finishes = property.finishes;

  return doc;
}

/**
 * 🏢 ENTERPRISE: Extract display-friendly property summary with i18n keys
 *
 * Returns i18n keys and params for UI display
 *
 * @param property - Property model
 * @returns Summary with i18n keys for localization
 */
export function getPropertyDisplaySummary(property: PropertyModel): {
  title: string;
  subtitle: { key: string; params: I18nParams };
  badges: Array<{ key: string; params?: I18nParams }>;
  completeness: number;
} {
  const { completenessPercentage } = validatePropertyCompleteness(property);

  const badges: Array<{ key: string; params?: I18nParams }> = [];

  // Add status badges with i18n keys
  if (property.operationalStatus === 'ready') {
    badges.push({ key: 'unit.status.ready' });
  }

  // Add feature badges with i18n keys and params
  if (property.views && property.views.length > 0) {
    badges.push({
      key: 'unit.features.views',
      params: { count: property.views.length }
    });
  }

  if (property.linkedSpaces && property.linkedSpaces.length > 0) {
    const parking = property.linkedSpaces.filter(s => s.spaceType === 'parking').length;
    const storage = property.linkedSpaces.filter(s => s.spaceType === 'storage').length;

    if (parking > 0) {
      badges.push({
        key: 'unit.spaces.parking',
        params: { count: parking }
      });
    }

    if (storage > 0) {
      badges.push({
        key: 'unit.spaces.storage',
        params: { count: storage }
      });
    }
  }

  return {
    title: property.name || `Property ${property.id}`,
    subtitle: {
      key: 'unit.subtitle.format',
      params: {
        type: property.type,
        building: property.building,
        floor: property.floor
      }
    },
    badges,
    completeness: completenessPercentage
  };
}