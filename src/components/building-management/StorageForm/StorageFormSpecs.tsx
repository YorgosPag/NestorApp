'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Building } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { FormRowSelect } from './form/FormRowSelect';
import { FormRowInput } from './form/FormRowInput';
import { FormRowCoordinates } from './form/FormRowCoordinates';
import type { StorageUnit } from '@/types/storage';

interface Props {
  formData: Partial<StorageUnit>;
  errors: { [key: string]: string };
  updateField: (field: string, value: any) => void;
  isCalculatingPrice: boolean;
  availableFloors: string[];
}

export function StorageFormSpecs({
  formData,
  errors,
  updateField,
  isCalculatingPrice,
  availableFloors,
}: Props) {
  const iconSizes = useIconSizes();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Building className={iconSizes.md} />
          Τοποθεσία & Προδιαγραφές
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FormRowSelect
            label="Όροφος"
            value={formData.floor || ''}
            options={availableFloors}
            onChange={(val) => updateField('floor', val)}
            required
          />
          <FormRowInput
            label="Επιφάνεια (m²)"
            value={formData.area || ''}
            onChange={(val) => updateField('area', val)}
            type="number"
            placeholder="0.00"
            error={errors.area}
            required
          />
          <FormRowInput
            label="Τιμή (€)"
            value={formData.price || ''}
            onChange={(val) => updateField('price', val)}
            type="number"
            placeholder="0.00"
            error={errors.price}
            required
            trailingElement={isCalculatingPrice ? (
              <div className={`animate-spin rounded-full ${iconSizes.sm} border-b-2 border-primary`} />
            ) : undefined}
            helper={
              formData.area && formData.price && formData.area > 0
                ? `${Math.round(formData.price / formData.area).toLocaleString('el-GR')} €/m²`
                : undefined
            }
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormRowInput
            label="Συνδεδεμένο Ακίνητο"
            value={formData.linkedProperty || ''}
            onChange={(val) => updateField('linkedProperty', val || null)}
            placeholder="π.χ. Δ2.1"
            helper="Κωδικός ακινήτου που συνοδεύει αυτή την μονάδα"
          />

          <FormRowCoordinates
            x={formData.coordinates?.x || 0}
            y={formData.coordinates?.y || 0}
            onChange={(coords) => updateField('coordinates', coords)}
          />
        </div>
      </CardContent>
    </Card>
  );
}
