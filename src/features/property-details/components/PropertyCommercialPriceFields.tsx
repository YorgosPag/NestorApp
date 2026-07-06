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
 * Price entry uses a format-on-blur input (see PriceInputField): while focused the
 * raw el-GR decimal (comma, no grouping) is shown so a typed `.`/`,` is unambiguously
 * the decimal mark; on blur the grouped "125.500,50" display is rendered. Parsing is
 * delegated to the locale-number SSoT (ADR-576).
 *
 * @module features/property-details/components/PropertyCommercialPriceFields
 * @since 2026-04-20
 */

import React, { useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { SalesDashboardRequirementsAlert } from '@/components/properties/shared/SalesDashboardRequirementsAlert';
import { PricePlausibilityWarning } from '@/components/properties/shared/PricePlausibilityWarning';
import { normalizeDecimalString } from '@/lib/number/locale-number';
import '@/lib/design-system';
import type { TFunction } from 'i18next';
import type { PropertyFieldsFormData } from './property-fields-form-types';

/** Canonical machine-decimal string: digits with an optional single `.` decimal. */
const MACHINE_NUMBER_RE = /^\d+\.?\d*$/;

interface PriceInputFieldProps {
  id: string;
  label: string;
  /** Machine-decimal string ('.' decimal, no grouping), e.g. "125500.5". */
  value: string;
  onValueChange: (raw: string) => void;
  disabled: boolean;
  placeholder: string;
}

function PriceInputField({ id, label, value, onValueChange, disabled, placeholder }: PriceInputFieldProps) {
  const colors = useSemanticColors();
  const [isFocused, setIsFocused] = useState(false);

  const displayValue = isFocused
    ? value.replace('.', ',')
    : value ? Number(value).toLocaleString('el-GR') : '';

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = normalizeDecimalString(e.target.value);
    if (raw === '' || MACHINE_NUMBER_RE.test(raw)) {
      onValueChange(raw);
    }
  };

  return (
    <>
      <Label className={cn('text-xs', colors.text.muted)}>{label}</Label>
      <Input
        id={id}
        type="text"
        inputMode="decimal"
        value={displayValue}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        onChange={handleChange}
        size="sm" className="text-xs text-right"
        placeholder={placeholder}
        disabled={disabled}
      />
    </>
  );
}

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
  const disabled = !isEditing || isSoldOrRented || isHierarchyLocked;
  return (
    <>
      {/* Sale price — shown for for-sale, for-sale-and-rent, and default */}
      {commercialStatus !== 'for-rent' && (
        <fieldset className="space-y-1">
          <PriceInputField
            id="unit-asking-price"
            label={t('fields.commercial.askingPrice')}
            value={askingPrice}
            onValueChange={(raw) => setFormData(prev => ({ ...prev, askingPrice: raw }))}
            disabled={disabled}
            placeholder={t('placeholders.priceExample')}
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
          <PriceInputField
            id="unit-rent-price"
            label={t('fields.commercial.rentPrice')}
            value={rentPrice}
            onValueChange={(raw) => setFormData(prev => ({ ...prev, rentPrice: raw }))}
            disabled={disabled}
            placeholder={t('placeholders.priceExample')}
          />
          <PricePlausibilityWarning
            commercialStatus="for-rent"
            propertyType={propertyType}
            askingPrice={rentPrice ?? null}
            grossArea={grossArea}
            className="py-2 px-3 mt-1"
          />
        </fieldset>
      )}
      {/* Unified requirements alert — missing price(s) or gross area */}
      <SalesDashboardRequirementsAlert
        commercialStatus={commercialStatus}
        askingPrice={commercialStatus !== 'for-rent' ? (askingPrice ?? null) : undefined}
        rentPrice={rentPrice ?? null}
        grossArea={grossArea}
        className="py-2 px-3 mt-1"
      />
    </>
  );
}
