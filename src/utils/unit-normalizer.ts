/**
 * 🏢 ENTERPRISE UNIT NORMALIZER
 *
 * Clean normalization functions for Unit documents
 * NO hardcoded defaults - uses server-provided backfill data
 *
 * @created 2026-01-23
 * @author Claude AI Assistant
 * @version 1.0.0
 * @enterprise Production-ready normalization system
 */

import type { Timestamp } from 'firebase/firestore';
import type {
  Unit,
  UnitDoc,
  UnitModel,
  BackfillDefaults,
  UnitCoverage
} from '@/types/unit';
import type { I18nParams } from '@/types/i18n-params';
import type {
  OrientationType,
  ViewTypeValue,
  ViewQuality,
  InteriorFeatureCodeType,
  SecurityFeatureCodeType,
  AmenityCodeType
} from '@/constants/unit-features-enterprise';

/**
 * 🏢 ENTERPRISE: Clean normalizer function
 *
 * NO hardcoded domain defaults!
 * All defaults come from server-provided BackfillDefaults
 *
 * @param doc - Raw Firestore document (may have missing fields)
 * @param backfillData - Server-provided defaults for migration (optional)
 * @returns Normalized UnitModel with all required fields
 * @throws Error if required fields missing post-backfill
 */
export function normalizeUnit(doc: UnitDoc, backfillData?: BackfillDefaults): UnitModel {
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
        'Invalid unit data: missing required fields post-backfill. ' +
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
    } as UnitModel;
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
  } as UnitModel;
}

/**
 * 🏢 ENTERPRISE: Validate unit coverage completeness
 *
 * @param unit - Unit to validate
 * @returns Object with validation results and i18n keys for missing items
 */
export function validateUnitCompleteness(unit: UnitModel): {
  isComplete: boolean;
  completenessPercentage: number;
  missingItems: string[]; // i18n keys
} {
  const missingItems: string[] = [];
  let score = 0;
  const totalItems = 3; // photos, floorplans, documents

  // Check documentation coverage - return i18n keys
  if (unit.unitCoverage.hasPhotos) {
    score++;
  } else {
    missingItems.push('unit.coverage.photos');
  }

  if (unit.unitCoverage.hasFloorplans) {
    score++;
  } else {
    missingItems.push('unit.coverage.floorplans');
  }

  if (unit.unitCoverage.hasDocuments) {
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
 * 🏢 ENTERPRISE: Prepare unit for Firestore write
 *
 * Converts UnitModel back to UnitDoc format for storage
 * Removes undefined values to keep documents clean
 *
 * @param unit - Normalized unit model
 * @returns Clean document for Firestore
 */
export function prepareUnitForFirestore(unit: UnitModel): UnitDoc {
  const doc: UnitDoc = {
    // Required fields always included
    id: unit.id,
    name: unit.name,
    type: unit.type,
    building: unit.building,
    buildingId: unit.buildingId,
    project: unit.project,
    floorId: unit.floorId,
    floor: unit.floor,
    status: unit.status,
    unitCoverage: unit.unitCoverage
  };

  // Add optional fields only if they have values
  if (unit.code) doc.code = unit.code;
  if (unit.useCategory) doc.useCategory = unit.useCategory;
  if (unit.operationalStatus) doc.operationalStatus = unit.operationalStatus;
  if (unit.price !== undefined) doc.price = unit.price;
  if (unit.area !== undefined) doc.area = unit.area;
  if (unit.description) doc.description = unit.description;
  if (unit.soldTo !== undefined) doc.soldTo = unit.soldTo;
  if (unit.saleDate) doc.saleDate = unit.saleDate;
  if (unit.unitName) doc.unitName = unit.unitName;

  // Extended fields
  if (unit.areas) doc.areas = unit.areas;
  if (unit.layout) doc.layout = unit.layout;

  // Arrays - only include if not empty
  if (unit.orientations && unit.orientations.length > 0) {
    doc.orientations = unit.orientations;
  }
  if (unit.views && unit.views.length > 0) {
    doc.views = unit.views;
  }
  if (unit.interiorFeatures && unit.interiorFeatures.length > 0) {
    doc.interiorFeatures = unit.interiorFeatures;
  }
  if (unit.securityFeatures && unit.securityFeatures.length > 0) {
    doc.securityFeatures = unit.securityFeatures;
  }
  if (unit.unitAmenities && unit.unitAmenities.length > 0) {
    doc.unitAmenities = unit.unitAmenities;
  }
  if (unit.linkedSpaces && unit.linkedSpaces.length > 0) {
    doc.linkedSpaces = unit.linkedSpaces;
  }

  // Other optional complex fields
  if (unit.condition) doc.condition = unit.condition;
  if (unit.renovationYear) doc.renovationYear = unit.renovationYear;
  if (unit.deliveryDate) doc.deliveryDate = unit.deliveryDate;
  if (unit.systemsOverride) doc.systemsOverride = unit.systemsOverride;
  if (unit.energy) doc.energy = unit.energy;
  if (unit.finishes) doc.finishes = unit.finishes;

  return doc;
}

/**
 * 🏢 ENTERPRISE: Extract display-friendly unit summary with i18n keys
 *
 * Returns i18n keys and params for UI display
 *
 * @param unit - Unit model
 * @returns Summary with i18n keys for localization
 */
export function getUnitDisplaySummary(unit: UnitModel): {
  title: string;
  subtitle: { key: string; params: I18nParams };
  badges: Array<{ key: string; params?: I18nParams }>;
  completeness: number;
} {
  const { completenessPercentage } = validateUnitCompleteness(unit);

  const badges: Array<{ key: string; params?: I18nParams }> = [];

  // Add status badges with i18n keys
  if (unit.operationalStatus === 'ready') {
    badges.push({ key: 'unit.status.ready' });
  }

  // Add feature badges with i18n keys and params
  if (unit.views && unit.views.length > 0) {
    badges.push({
      key: 'unit.features.views',
      params: { count: unit.views.length }
    });
  }

  if (unit.linkedSpaces && unit.linkedSpaces.length > 0) {
    const parking = unit.linkedSpaces.filter(s => s.spaceType === 'parking').length;
    const storage = unit.linkedSpaces.filter(s => s.spaceType === 'storage').length;

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
    title: unit.name || `Unit ${unit.id}`, // Title stays as-is (it's the actual name)
    subtitle: {
      key: 'unit.subtitle.format',
      params: {
        type: unit.type,
        building: unit.building,
        floor: unit.floor
      }
    },
    badges,
    completeness: completenessPercentage
  };
}