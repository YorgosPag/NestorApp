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
import { AdministrativeAddressPicker } from '@/components/contacts/pickers/AdministrativeAddressPicker';
import type { AdministrativeAddress } from '@/components/contacts/pickers/AdministrativeAddressPicker';
import { ADDRESS_TYPE_KEYS, BLOCK_SIDE_KEYS } from '@/components/projects/tabs/locations/address-constants';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';
import '@/lib/design-system';

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
  /** External values to sync into form (e.g. from reverse geocoding drag) */
  externalValues?: Partial<ProjectAddress> | null;
}

// =============================================================================
// FORM DATA TYPE
// =============================================================================

interface AddressFormData {
  street: string;
  number: string;
  city: string;
  neighborhood: string;
  postalCode: string;
  region: string;
  regionalUnit: string;
  municipality: string;
  country: string;
  type: ProjectAddressType;
  isPrimary: boolean;
  blockSide: BlockSideDirection | typeof SELECT_CLEAR_VALUE;
  label: string;
}

// =============================================================================
// TYPE/BLOCK SIDE KEYS — imported from SSOT: address-constants.ts
// =============================================================================

// =============================================================================
// COMPONENT
// =============================================================================

export function AddressFormSection({
  initialValues,
  onChange,
  showErrors: _showErrors = false,
  externalValues
}: AddressFormSectionProps) {
  const { t } = useTranslation('addresses');
  const colors = useSemanticColors();

  // Form state
  const [formData, setFormData] = useState<AddressFormData>({
    street: initialValues?.street || '',
    number: initialValues?.number || '',
    city: initialValues?.city || '',
    neighborhood: initialValues?.neighborhood || '',
    postalCode: initialValues?.postalCode || '',
    region: initialValues?.region || '',
    regionalUnit: initialValues?.regionalUnit || '',
    municipality: initialValues?.municipality || '',
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

  // =========================================================================
  // EXTERNAL VALUES SYNC (e.g. reverse geocoding drag update)
  // =========================================================================
  useEffect(() => {
    if (!externalValues) return;

    setFormData(prev => {
      const merged: AddressFormData = {
        ...prev,
        street: externalValues.street ?? prev.street,
        number: externalValues.number ?? prev.number,
        city: externalValues.city ?? prev.city,
        neighborhood: externalValues.neighborhood ?? prev.neighborhood,
        postalCode: externalValues.postalCode ?? prev.postalCode,
        region: externalValues.region ?? prev.region,
        country: externalValues.country ?? prev.country,
      };

      // Notify parent immediately (no debounce — this is a discrete update)
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      if (onChangeRef.current) {
        const blockSideValue = merged.blockSide === SELECT_CLEAR_VALUE || !merged.blockSide
          ? undefined
          : (merged.blockSide as BlockSideDirection);

        onChangeRef.current({
          street: merged.street,
          number: merged.number,
          city: merged.city,
          neighborhood: merged.neighborhood || undefined,
          postalCode: merged.postalCode,
          region: merged.region || undefined,
          regionalUnit: merged.regionalUnit || undefined,
          municipality: merged.municipality || undefined,
          country: merged.country || GEOGRAPHIC_CONFIG.DEFAULT_COUNTRY,
          type: merged.type,
          isPrimary: merged.isPrimary,
          blockSide: blockSideValue,
          label: merged.label,
        });
      }

      return merged;
    });
  }, [externalValues]);

  const notifyParent = useCallback((data: AddressFormData) => {
    if (!onChangeRef.current) return;

    const blockSideValue = data.blockSide === SELECT_CLEAR_VALUE || !data.blockSide
      ? undefined
      : (data.blockSide as BlockSideDirection);

    onChangeRef.current({
      street: data.street,
      number: data.number,
      city: data.city,
      neighborhood: data.neighborhood || undefined,
      postalCode: data.postalCode,
      region: data.region || undefined,
      regionalUnit: data.regionalUnit || undefined,
      municipality: data.municipality || undefined,
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

  // Validation — street is optional (villages/settlements may not have streets)
  // Note: errors computed but not yet used in UI — keeping showErrors prop for future use

  return (
    <div className="space-y-4">
      {/* Street + Number */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2">
          <Label htmlFor="street" className="text-sm font-medium">
            {t('form.street')}
          </Label>
          <Input
            id="street"
            value={formData.street}
            onChange={(e) => handleTextChange('street', e.target.value)}
            placeholder={t('form.streetPlaceholder')}
          />
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

      {/* Greek Administrative Division Hierarchy */}
      <AdministrativeAddressPicker
        value={{
          settlementName: formData.city,
          regionName: formData.region,
          postalCode: formData.postalCode,
        }}
        onChange={(adminAddr: AdministrativeAddress) => {
          // Map administrative hierarchy fields to address form
          const updatedCity = adminAddr.settlementName || adminAddr.municipalityName || formData.city;
          const updatedRegion = adminAddr.regionName || formData.region;
          const updatedRegionalUnit = adminAddr.regionalUnitName || formData.regionalUnit;
          const updatedMunicipality = adminAddr.municipalityName || formData.municipality;
          const updatedNeighborhood = adminAddr.communityName || formData.neighborhood;
          const updatedPostalCode = adminAddr.postalCode || formData.postalCode;

          setFormData(prev => {
            const newData = {
              ...prev,
              city: updatedCity,
              neighborhood: updatedNeighborhood,
              region: updatedRegion,
              regionalUnit: updatedRegionalUnit,
              municipality: updatedMunicipality,
              postalCode: updatedPostalCode,
            };
            // Immediate parent notification (discrete change)
            if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
            notifyParent(newData);
            return newData;
          });
        }}
        showPostalCode
      />

      {/* Country */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
        <p className={cn("text-xs", colors.text.muted)}>
          {t('form.requiredFields')}
        </p>
      </div>
    </div>
  );
}
