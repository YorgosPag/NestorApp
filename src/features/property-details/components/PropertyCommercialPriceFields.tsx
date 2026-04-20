'use client';
/* eslint-disable design-system/prefer-design-system-imports, design-system/enforce-semantic-colors */
/**
 * =============================================================================
 * 🏢 ENTERPRISE: Property Commercial Price Fields
 * =============================================================================
 *
 * Conditional price fieldsets for the property edit form.
 * Extracted from PropertyFieldsEditForm for SRP compliance (ADR N.7.1).
 * Shows sale price (askingPrice) and/or monthly rent (rentPrice) depending on
 * commercialStatus:
 *   - for-sale / unavailable / default → askingPrice only
 *   - for-rent → rentPrice only
 *   - for-sale-and-rent → both fields
 *
 * @module features/property-details/components/PropertyCommercialPriceFields
 * @since 2026-04-20
 */

import React from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { SalesDashboardRequirementsAlert } from '@/components/properties/shared/SalesDashboardRequirementsAlert';
import { PricePlausibilityWarning } from '@/components/properties/shared/PricePlausibilityWarning';
import type { TFunction } from 'i18next';
import type { PropertyFieldsFormData } from './property-fields-form-types';

export interface PropertyCommercialPriceFieldsProps {
  commercialStatus: string;
  askingPrice: string;
  rentPrice: string;
  grossArea: number | undefined;
  propertyType: string;
  setFormData: Dispatch<SetStateAction<PropertyFieldsFormData>>;
  isEditing: boolean;
  isSoldOrRented: boolean;
  isHierarchyLocked: boolean;
  t: TFunction;
}

export function PropertyCommercialPriceFields({
  commercialStatus,
  askingPrice,
  rentPrice,
  grossArea,
  propertyType,
  setFormData,
  isEditing,
  isSoldOrRented,
  isHierarchyLocked,
  t,
}: PropertyCommercialPriceFieldsProps) {
  const colors = useSemanticColors();
  return (
    <>
      {/* Sale price — shown for for-sale, for-sale-and-rent, and default */}
      {commercialStatus !== 'for-rent' && (
        <fieldset className="space-y-1">
          <Label className={cn("text-xs", colors.text.muted)}>
            {t('fields.commercial.askingPrice')}
          </Label>
          <Input
            id="unit-asking-price"
            type="text"
            inputMode="decimal"
            value={askingPrice ? Number(askingPrice).toLocaleString('el-GR') : ''}
            onChange={(e) => {
              const raw = e.target.value.replace(/\./g, '').replace(/,/g, '.');
              if (raw === '' || /^\d+\.?\d*$/.test(raw)) {
                setFormData(prev => ({ ...prev, askingPrice: raw }));
              }
            }}
            size="sm" className="text-xs text-right"
            placeholder={t('placeholders.priceExample')}
            disabled={!isEditing || isSoldOrRented || isHierarchyLocked}
          />
          <SalesDashboardRequirementsAlert
            commercialStatus={commercialStatus}
            askingPrice={askingPrice ?? null}
            grossArea={grossArea}
            className="py-2 px-3 mt-1"
          />
          <PricePlausibilityWarning
            commercialStatus={commercialStatus}
            propertyType={propertyType}
            askingPrice={askingPrice ?? null}
            grossArea={grossArea}
            className="py-2 px-3 mt-1"
          />
        </fieldset>
      )}
      {/* Rent price — shown for for-rent and for-sale-and-rent */}
      {(commercialStatus === 'for-rent' || commercialStatus === 'for-sale-and-rent') && (
        <fieldset className="space-y-1">
          <Label className={cn("text-xs", colors.text.muted)}>
            {t('fields.commercial.rentPrice')}
          </Label>
          <Input
            id="unit-rent-price"
            type="text"
            inputMode="decimal"
            value={rentPrice ? Number(rentPrice).toLocaleString('el-GR') : ''}
            onChange={(e) => {
              const raw = e.target.value.replace(/\./g, '').replace(/,/g, '.');
              if (raw === '' || /^\d+\.?\d*$/.test(raw)) {
                setFormData(prev => ({ ...prev, rentPrice: raw }));
              }
            }}
            size="sm" className="text-xs text-right"
            placeholder={t('placeholders.priceExample')}
            disabled={!isEditing || isSoldOrRented || isHierarchyLocked}
          />
        </fieldset>
      )}
    </>
  );
}
