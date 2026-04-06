/**
 * ADR-284/ADR-236: Property creation payload builder
 * Extracted from PropertyFieldsBlock for SRP compliance (N.7.1).
 *
 * @module features/property-details/components/property-fields-save-handler
 */

import type { Property } from '@/types/property-viewer';
import type { PropertyType } from '@/types/property';
import { isStandaloneUnitType } from '@/hooks/properties/usePropertyCreateValidation';
import type { PropertyFieldsFormData } from './property-fields-form-types';

/**
 * Build the creation payload from form data + computed updates.
 * Pure function — no side effects, no Firestore calls.
 */
export function buildCreationPayload(params: {
  formData: PropertyFieldsFormData;
  updates: Partial<Property>;
  suggestedCode: string;
  defaultName: string;
}): Record<string, unknown> {
  const { formData, updates, suggestedCode, defaultName } = params;
  const standalone = isStandaloneUnitType(formData.type as PropertyType | '');

  return {
    ...updates,
    name: formData.name || defaultName,
    code: formData.code || suggestedCode || '',
    type: formData.type || 'apartment',
    status: 'reserved' as const,
    operationalStatus: 'draft' as const,
    floor: standalone ? 0 : formData.floor,
    area: formData.areaGross,
    projectId: formData.projectId,
    // ADR-236 Phase 4: Multi-level during creation
    ...(formData.levels.length >= 2 ? {
      isMultiLevel: true,
      levels: formData.levels,
    } : {}),
    ...(standalone
      ? {}
      : { buildingId: formData.buildingId, floorId: formData.floorId }),
  };
}
