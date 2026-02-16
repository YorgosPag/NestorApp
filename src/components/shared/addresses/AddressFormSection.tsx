'use client';

/**
 * =============================================================================
 * 🏢 ADDRESS FORM SECTION - Add/Edit Address Form
 * =============================================================================
 *
 * Form section for adding or editing project addresses
 *
 * Features:
 * - Street, number, city, postal code fields
 * - Address type dropdown (Radix Select - ADR-001)
 * - Block side dropdown
 * - Primary address toggle
 * - Simple validation (required fields only)
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SELECT_CLEAR_VALUE } from '@/config/domain-constants';
import { GEOGRAPHIC_CONFIG } from '@/config/geographic-config';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type {
  ProjectAddress,
  ProjectAddressType,
  BlockSideDirection,
  PartialProjectAddress
} from '@/types/project/addresses';

// =============================================================================
// COMPONENT PROPS
// =============================================================================

interface AddressFormSectionProps {
  /** Initial values (for edit mode) */
  initialValues?: Partial<ProjectAddress>;
  /** Callback when form data changes */
  onChange?: (data: PartialProjectAddress) => void;
  /** Show validation errors? */
  showErrors?: boolean;
}

// =============================================================================
// FORM DATA TYPE
// =============================================================================

interface AddressFormData {
  street: string;
  number: string;
  city: string;
  postalCode: string;
  region: string;
  country: string;
  type: ProjectAddressType;
  isPrimary: boolean;
  blockSide: BlockSideDirection | typeof SELECT_CLEAR_VALUE;
  label: string;
}

// =============================================================================
// TYPE/BLOCK SIDE KEYS (for iteration — labels come from i18n)
// =============================================================================

const ADDRESS_TYPE_KEYS: readonly ProjectAddressType[] = [
  'site', 'entrance', 'delivery', 'legal', 'postal', 'billing', 'correspondence', 'other'
] as const;

const BLOCK_SIDE_KEYS: readonly BlockSideDirection[] = [
  'north', 'south', 'east', 'west', 'northeast', 'northwest', 'southeast', 'southwest', 'corner', 'internal'
] as const;

// =============================================================================
// COMPONENT
// =============================================================================

export function AddressFormSection({
  initialValues,
  onChange,
  showErrors = false
}: AddressFormSectionProps) {
  const { t } = useTranslation('addresses');

  // Form state
  const [formData, setFormData] = useState<AddressFormData>({
    street: initialValues?.street || '',
    number: initialValues?.number || '',
    city: initialValues?.city || '',
    postalCode: initialValues?.postalCode || '',
    region: initialValues?.region || '',
    country: initialValues?.country || GEOGRAPHIC_CONFIG.DEFAULT_COUNTRY,
    type: initialValues?.type || 'site',
    isPrimary: initialValues?.isPrimary || false,
    blockSide: initialValues?.blockSide || SELECT_CLEAR_VALUE,
    label: initialValues?.label || ''
  });

  // =========================================================================
  // DEBOUNCED PARENT NOTIFICATION (INP optimization)
  // =========================================================================
  // Text inputs: update local state immediately, debounce parent onChange.
  // Select/Checkbox: notify parent immediately (discrete interactions).

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onChangeRef = useRef(onChange);

  // Keep ref in sync without re-creating callbacks
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, []);

  const notifyParent = useCallback((data: AddressFormData) => {
    if (!onChangeRef.current) return;

    const blockSideValue = data.blockSide === SELECT_CLEAR_VALUE || !data.blockSide
      ? undefined
      : (data.blockSide as BlockSideDirection);

    onChangeRef.current({
      street: data.street,
      number: data.number,
      city: data.city,
      postalCode: data.postalCode,
      region: data.region || undefined,
      country: data.country || GEOGRAPHIC_CONFIG.DEFAULT_COUNTRY,
      type: data.type,
      isPrimary: data.isPrimary,
      blockSide: blockSideValue,
      label: data.label,
    });
  }, []);

  /** Text field change — debounced parent notification (300ms) */
  const handleTextChange = useCallback((field: keyof AddressFormData, value: string) => {
    setFormData(prev => {
      const newData = { ...prev, [field]: value };

      // Debounce parent notification
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(() => notifyParent(newData), 300);

      return newData;
    });
  }, [notifyParent]);

  /** Discrete change (Select, Checkbox) — immediate parent notification */
  const handleDiscreteChange = useCallback((field: keyof AddressFormData, value: string | boolean) => {
    setFormData(prev => {
      const newData = { ...prev, [field]: value };

      // Cancel any pending debounce, notify immediately
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      notifyParent(newData);

      return newData;
    });
  }, [notifyParent]);

  // Validation
  const errors = {
    street: showErrors && !formData.street.trim(),
    city: showErrors && !formData.city.trim(),
    postalCode: showErrors && !formData.postalCode.trim()
  };

  return (
    <div className="space-y-4">
      {/* Street + Number */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2">
          <Label htmlFor="street" className="text-sm font-medium">
            {t('form.street')} *
          </Label>
          <Input
            id="street"
            value={formData.street}
            onChange={(e) => handleTextChange('street', e.target.value)}
            placeholder={t('form.streetPlaceholder')}
            className={errors.street ? 'border-red-500' : ''}
          />
          {errors.street && (
            <p className="text-xs text-red-500 mt-1">{t('form.validation.streetRequired')}</p>
          )}
        </div>

        <div>
          <Label htmlFor="number" className="text-sm font-medium">
            {t('form.number')}
          </Label>
          <Input
            id="number"
            value={formData.number}
            onChange={(e) => handleTextChange('number', e.target.value)}
            placeholder={t('form.numberPlaceholder')}
          />
        </div>
      </div>

      {/* City + Postal Code */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="city" className="text-sm font-medium">
            {t('form.city')} *
          </Label>
          <Input
            id="city"
            value={formData.city}
            onChange={(e) => handleTextChange('city', e.target.value)}
            placeholder={t('form.cityPlaceholder')}
            className={errors.city ? 'border-red-500' : ''}
          />
          {errors.city && (
            <p className="text-xs text-red-500 mt-1">{t('form.validation.cityRequired')}</p>
          )}
        </div>

        <div>
          <Label htmlFor="postalCode" className="text-sm font-medium">
            {t('form.postalCode')} *
          </Label>
          <Input
            id="postalCode"
            value={formData.postalCode}
            onChange={(e) => handleTextChange('postalCode', e.target.value)}
            placeholder={t('form.postalCodePlaceholder')}
            className={errors.postalCode ? 'border-red-500' : ''}
          />
          {errors.postalCode && (
            <p className="text-xs text-red-500 mt-1">{t('form.validation.postalCodeRequired')}</p>
          )}
        </div>
      </div>

      {/* Region + Country */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="region" className="text-sm font-medium">
            {t('form.region')}
          </Label>
          <Input
            id="region"
            value={formData.region}
            onChange={(e) => handleTextChange('region', e.target.value)}
            placeholder={t('form.regionPlaceholder')}
          />
        </div>

        <div>
          <Label htmlFor="country" className="text-sm font-medium">
            {t('form.country')}
          </Label>
          <Input
            id="country"
            value={formData.country}
            onChange={(e) => handleTextChange('country', e.target.value)}
            placeholder={t('form.countryPlaceholder')}
          />
        </div>
      </div>

      {/* Address Type + Block Side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="type" className="text-sm font-medium">
            {t('form.type')}
          </Label>
          <Select
            value={formData.type}
            onValueChange={(value) => handleDiscreteChange('type', value as ProjectAddressType)}
          >
            <SelectTrigger id="type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ADDRESS_TYPE_KEYS.map((typeKey) => (
                <SelectItem key={typeKey} value={typeKey}>
                  {t(`types.${typeKey}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="blockSide" className="text-sm font-medium">
            {t('form.blockSide')}
          </Label>
          <Select
            value={formData.blockSide}
            onValueChange={(value) => handleDiscreteChange('blockSide', value)}
          >
            <SelectTrigger id="blockSide">
              <SelectValue placeholder={t('form.blockSidePlaceholder')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={SELECT_CLEAR_VALUE}>{t('form.blockSideNone')}</SelectItem>
              {BLOCK_SIDE_KEYS.map((sideKey) => (
                <SelectItem key={sideKey} value={sideKey}>
                  {t(`blockSides.${sideKey}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Label (Optional) */}
      <div>
        <Label htmlFor="label" className="text-sm font-medium">
          {t('form.label')}
        </Label>
        <Input
          id="label"
          value={formData.label}
          onChange={(e) => handleTextChange('label', e.target.value)}
          placeholder={t('form.labelPlaceholder')}
        />
      </div>

      {/* Primary Checkbox */}
      <div className="flex items-center space-x-2 pt-2">
        <Checkbox
          id="isPrimary"
          checked={formData.isPrimary}
          onCheckedChange={(checked) => handleDiscreteChange('isPrimary', !!checked)}
        />
        <Label
          htmlFor="isPrimary"
          className="text-sm font-medium cursor-pointer"
        >
          {t('form.isPrimary')}
        </Label>
      </div>

      {/* Help text */}
      <div className="pt-2 border-t border-border">
        <p className="text-xs text-muted-foreground">
          {t('form.requiredFields')}
        </p>
      </div>
    </div>
  );
}
