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

import React, { useState } from 'react';
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
  type: ProjectAddressType;
  isPrimary: boolean;
  blockSide: BlockSideDirection | typeof SELECT_CLEAR_VALUE;
  label: string;
}

// =============================================================================
// LABELS & OPTIONS
// =============================================================================

const ADDRESS_TYPE_LABELS: Record<ProjectAddressType, string> = {
  site: 'Εργοτάξιο',
  entrance: 'Είσοδος',
  delivery: 'Παράδοση',
  legal: 'Νομική Έδρα',
  postal: 'Ταχυδρομείο',
  billing: 'Τιμολόγηση',
  correspondence: 'Αλληλογραφία',
  other: 'Άλλο'
};

const BLOCK_SIDE_LABELS: Record<BlockSideDirection, string> = {
  north: 'Βόρεια',
  south: 'Νότια',
  east: 'Ανατολική',
  west: 'Δυτική',
  northeast: 'Βορειοανατολική',
  northwest: 'Βορειοδυτική',
  southeast: 'Νοτιοανατολική',
  southwest: 'Νοτιοδυτική',
  corner: 'Γωνία',
  internal: 'Εσωτερική'
};

// =============================================================================
// COMPONENT
// =============================================================================

export function AddressFormSection({
  initialValues,
  onChange,
  showErrors = false
}: AddressFormSectionProps) {
  // Form state
  const [formData, setFormData] = useState<AddressFormData>({
    street: initialValues?.street || '',
    number: initialValues?.number || '',
    city: initialValues?.city || '',
    postalCode: initialValues?.postalCode || '',
    type: initialValues?.type || 'site',
    isPrimary: initialValues?.isPrimary || false,
    blockSide: initialValues?.blockSide || SELECT_CLEAR_VALUE,
    label: initialValues?.label || ''
  });

  // Update parent when form changes
  const handleChange = (field: keyof AddressFormData, value: string | boolean) => {
    const newData = { ...formData, [field]: value };
    setFormData(newData);

    // Notify parent
    if (onChange) {
      // Handle SELECT_CLEAR_VALUE for blockSide - convert to undefined
      const blockSideValue = newData.blockSide === SELECT_CLEAR_VALUE || !newData.blockSide
        ? undefined
        : (newData.blockSide as BlockSideDirection);

      onChange({
        street: newData.street,
        number: newData.number,
        city: newData.city,
        postalCode: newData.postalCode,
        type: newData.type,
        isPrimary: newData.isPrimary,
        blockSide: blockSideValue,
        label: newData.label,
        country: 'Greece' // Default
      });
    }
  };

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
            Οδός *
          </Label>
          <Input
            id="street"
            value={formData.street}
            onChange={(e) => handleChange('street', e.target.value)}
            placeholder="π.χ. Σαμοθράκης"
            className={errors.street ? 'border-red-500' : ''}
          />
          {errors.street && (
            <p className="text-xs text-red-500 mt-1">Η οδός είναι υποχρεωτική</p>
          )}
        </div>

        <div>
          <Label htmlFor="number" className="text-sm font-medium">
            Αριθμός
          </Label>
          <Input
            id="number"
            value={formData.number}
            onChange={(e) => handleChange('number', e.target.value)}
            placeholder="π.χ. 16"
          />
        </div>
      </div>

      {/* City + Postal Code */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="city" className="text-sm font-medium">
            Πόλη *
          </Label>
          <Input
            id="city"
            value={formData.city}
            onChange={(e) => handleChange('city', e.target.value)}
            placeholder="π.χ. Θεσσαλονίκη"
            className={errors.city ? 'border-red-500' : ''}
          />
          {errors.city && (
            <p className="text-xs text-red-500 mt-1">Η πόλη είναι υποχρεωτική</p>
          )}
        </div>

        <div>
          <Label htmlFor="postalCode" className="text-sm font-medium">
            Τ.Κ. *
          </Label>
          <Input
            id="postalCode"
            value={formData.postalCode}
            onChange={(e) => handleChange('postalCode', e.target.value)}
            placeholder="π.χ. 54621"
            className={errors.postalCode ? 'border-red-500' : ''}
          />
          {errors.postalCode && (
            <p className="text-xs text-red-500 mt-1">Ο Τ.Κ. είναι υποχρεωτικός</p>
          )}
        </div>
      </div>

      {/* Address Type + Block Side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="type" className="text-sm font-medium">
            Τύπος Διεύθυνσης
          </Label>
          <Select
            value={formData.type}
            onValueChange={(value) => handleChange('type', value as ProjectAddressType)}
          >
            <SelectTrigger id="type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(ADDRESS_TYPE_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="blockSide" className="text-sm font-medium">
            Πλευρά Οικοδομικού Τετραγώνου
          </Label>
          <Select
            value={formData.blockSide}
            onValueChange={(value) => handleChange('blockSide', value)}
          >
            <SelectTrigger id="blockSide">
              <SelectValue placeholder="Επιλέξτε πλευρά..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={SELECT_CLEAR_VALUE}>Καμία</SelectItem>
              {Object.entries(BLOCK_SIDE_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Label (Optional) */}
      <div>
        <Label htmlFor="label" className="text-sm font-medium">
          Ετικέτα (Προαιρετική)
        </Label>
        <Input
          id="label"
          value={formData.label}
          onChange={(e) => handleChange('label', e.target.value)}
          placeholder="π.χ. Κύρια Είσοδος"
        />
      </div>

      {/* Primary Checkbox */}
      <div className="flex items-center space-x-2 pt-2">
        <Checkbox
          id="isPrimary"
          checked={formData.isPrimary}
          onCheckedChange={(checked) => handleChange('isPrimary', !!checked)}
        />
        <Label
          htmlFor="isPrimary"
          className="text-sm font-medium cursor-pointer"
        >
          Κύρια Διεύθυνση
        </Label>
      </div>

      {/* Help text */}
      <div className="pt-2 border-t border-border">
        <p className="text-xs text-muted-foreground">
          * Υποχρεωτικά πεδία
        </p>
      </div>
    </div>
  );
}
