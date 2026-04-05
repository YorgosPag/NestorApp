/**
 * =============================================================================
 * 🏢 ENTERPRISE: Property Fields Form → Updates Mapper
 * =============================================================================
 *
 * Pure mapping function that converts PropertyFieldsFormData + Property context
 * into a Partial<Property> update payload ready for Firestore persistence.
 *
 * Extracted from PropertyFieldsBlock.tsx for SRP compliance (CLAUDE.md N.7.1)
 * and to act as SSoT for form → domain mapping (can be reused by tests, other
 * mutation sites, or server-side validation).
 *
 * @module features/property-details/components/property-fields-form-mapper
 * @since 2026-04-05
 */

import { aggregateLevelData } from '@/services/multi-level.service';
import type { Property } from '@/types/property-viewer';
import type {
  ConditionType,
  OrientationType,
  EnergyClassType,
  InteriorFeatureCodeType,
  SecurityFeatureCodeType,
} from '@/constants/property-features-enterprise';
import type { PropertyFieldsFormData } from './property-fields-form-types';

/**
 * Builds the Firestore update payload from the current form state.
 *
 * Rules:
 * - Uses suggestedCode as fallback if user hasn't typed a custom one (ADR-233)
 * - Preserves existing property.floorId when present (ADR-232)
 * - Emits commercial.askingPrice only when it differs from current value
 * - For multi-level units, auto-aggregates per-level data (ADR-236 Phase 2)
 */
export function buildPropertyUpdatesFromForm(params: {
  formData: PropertyFieldsFormData;
  property: Property;
  suggestedCode: string | null | undefined;
  isMultiLevel: boolean | undefined;
}): Partial<Property> {
  const { formData, property, suggestedCode, isMultiLevel } = params;

  // ADR-233: Use suggested code as fallback if user hasn't typed a custom one
  const resolvedCode = formData.code || suggestedCode || undefined;
  const updates: Partial<Property> = {
    name: formData.name,
    code: resolvedCode,
    type: formData.type,
    operationalStatus: formData.operationalStatus,
    commercialStatus: formData.commercialStatus,
    floor: formData.floor,
    // 🔒 ADR-232: Include floorId from property (set via FloorSelectField)
    ...(property.floorId ? { floorId: property.floorId } : {}),
    layout: {
      bedrooms: formData.bedrooms,
      bathrooms: formData.bathrooms,
      wc: formData.wc,
    },
    orientations: formData.orientations as OrientationType[],
  };

  if (formData.description.trim()) {
    updates.description = formData.description.trim();
  }

  const areasData: { gross: number; net?: number; balcony?: number; terrace?: number; garden?: number } = {
    gross: formData.areaGross,
  };
  if (formData.areaNet > 0) areasData.net = formData.areaNet;
  if (formData.areaBalcony > 0) areasData.balcony = formData.areaBalcony;
  if (formData.areaTerrace > 0) areasData.terrace = formData.areaTerrace;
  if (formData.areaGarden > 0) areasData.garden = formData.areaGarden;
  updates.areas = areasData;

  if (formData.condition) updates.condition = formData.condition as ConditionType;
  if (formData.energyClass) updates.energy = { class: formData.energyClass as EnergyClassType };

  if (formData.heatingType || formData.coolingType) {
    const systemsOverride: Record<string, string> = {};
    if (formData.heatingType) systemsOverride.heatingType = formData.heatingType;
    if (formData.coolingType) systemsOverride.coolingType = formData.coolingType;
    updates.systemsOverride = systemsOverride as Property['systemsOverride'];
  }

  if (formData.flooring.length > 0 || formData.windowFrames || formData.glazing) {
    const finishes: Record<string, unknown> = {};
    if (formData.flooring.length > 0) finishes.flooring = formData.flooring;
    if (formData.windowFrames) finishes.windowFrames = formData.windowFrames;
    if (formData.glazing) finishes.glazing = formData.glazing;
    updates.finishes = finishes as Property['finishes'];
  }

  if (formData.interiorFeatures.length > 0) {
    updates.interiorFeatures = formData.interiorFeatures as InteriorFeatureCodeType[];
  }
  if (formData.securityFeatures.length > 0) {
    updates.securityFeatures = formData.securityFeatures as SecurityFeatureCodeType[];
  }

  // Commercial data — preserve existing fields, update only askingPrice
  const parsedPrice = formData.askingPrice ? Number(formData.askingPrice) : null;
  const priceChanged = parsedPrice !== (property.commercial?.askingPrice ?? null);
  if (priceChanged) {
    updates.commercial = {
      ...(property.commercial as Record<string, unknown>),
      askingPrice: parsedPrice && parsedPrice > 0 ? parsedPrice : null,
    } as Property['commercial'];
  }

  // ADR-236 Phase 2: Per-level data + auto-aggregation
  if (isMultiLevel && Object.keys(formData.levelData).length > 0) {
    (updates as Record<string, unknown>).levelData = formData.levelData;
    const agg = aggregateLevelData(formData.levelData);
    updates.areas = agg.areas;
    updates.layout = {
      bedrooms: agg.layout.bedrooms,
      bathrooms: agg.layout.bathrooms,
      wc: agg.layout.wc,
    };
    updates.orientations = agg.orientations;
  }

  return updates;
}
