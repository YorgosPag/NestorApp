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
  InteriorFeatureCodeType,
  SecurityFeatureCodeType,
} from '@/constants/property-features-enterprise';
import type { PropertyFieldsFormData } from './property-fields-form-types';
import { changedCommercialAmounts } from '@/lib/properties/commercial-draft';
import { readCommonCharges, sameCommonCharges } from '@/lib/common-charges/common-charges';
import { readEnergyCertificate, sameEnergyCertificate } from '@/lib/energy-certificate/energy-certificate';
import { energyOfForm } from '@/lib/energy-certificate/energy-certificate-form';
import { sameAreas, writtenAreasOf } from '@/lib/properties/property-areas';

/**
 * Builds the Firestore update payload from the current form state.
 *
 * Rules:
 * - Uses suggestedCode as fallback if user hasn't typed a custom one (ADR-233)
 * - Preserves existing property.floorId when present (ADR-232)
 * - Emits commercial.askingPrice only when it differs from current value
 * - Emits areas only when they differ — `0` and absent are the same "not measured" (ADR-777 §8.97)
 * - For multi-level units, auto-aggregates per-level data (ADR-236 Phase 2)
 */
export function buildPropertyUpdatesFromForm(params: {
  formData: PropertyFieldsFormData;
  property: Property;
  isMultiLevel: boolean | undefined;
}): Partial<Property> {
  const { formData, property, isMultiLevel } = params;

  // ADR-233: Preserve existing code when formData.code is empty (suggestion not yet applied).
  // Never use latestSuggestion as fallback here — EntityCodeField already applies it via onChange.
  // Using a stale suggestion would cause spurious code-change warnings in ImpactGuard.
  const resolvedCode = formData.code || property.code || undefined;
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

  // ADR-777 §8.97 — τα εμβαδά: ολόκληρο το μπλοκ, και μόνο όταν άλλαξε. Ως τώρα έφευγε σε **κάθε** αποθήκευση, και ένα
  // αποθηκευμένο `terrace: 0` (≡ «δεν μετρήθηκε») έβγαινε «αλλαγή» στον διάλογο επιπτώσεων και σβηνόταν.
  const areas = writtenAreasOf({
    gross: formData.areaGross,
    net: formData.areaNet,
    balcony: formData.areaBalcony,
    terrace: formData.areaTerrace,
    garden: formData.areaGarden,
  });
  if (!sameAreas(areas, property.areas)) updates.areas = areas;

  if (formData.condition) updates.condition = formData.condition as ConditionType;
  // ADR-777 §8.94 — το ΠΕΑ: ολόκληρο το μπλοκ, και μόνο όταν άλλαξε. Ως τώρα έφευγε `{ class }` σε **κάθε**
  // αποθήκευση — που αντικαθιστούσε όλο το αντικείμενο (θα έσβηνε τους αριθμούς) και δεν μπορούσε να **σβήσει** κλάση.
  const energy = energyOfForm(formData);
  if (!sameEnergyCertificate(energy, readEnergyCertificate(property.energy))) updates.energy = energy;

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

  // Commercial data — preserve existing fields, write only the amounts that changed.
  // ADR-777 §8.60.18: ο ΙΔΙΟΣ κριτής «τι άλλαξε» με τους επεξεργαστές θέσεων/αποθηκών.
  const amountChanges = changedCommercialAmounts(formData, property.commercial);
  if (Object.keys(amountChanges).length > 0) {
    updates.commercial = {
      ...(property.commercial as Record<string, unknown>),
      ...amountChanges,
    } as Property['commercial'];
  }

  // ADR-777 §8.93 — τα κοινόχρηστα: ολόκληρο το μπλοκ, και μόνο όταν άλλαξε (αλλιώς κάθε αποθήκευση θα έγραφε ίχνος).
  if (!sameCommonCharges(formData.commonCharges, readCommonCharges(property.commonCharges))) {
    updates.commonCharges = formData.commonCharges;
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
