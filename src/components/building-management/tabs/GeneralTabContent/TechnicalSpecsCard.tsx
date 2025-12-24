'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIconSizes } from '@/hooks/useIconSizes';
import { calculateBuildingRatio, calculateCostPerSqm } from './utils';
import { formatCurrency, formatNumber } from '@/lib/intl-utils';

interface TechnicalSpecsCardProps {
    formData: { 
        totalArea: number;
        builtArea: number;
        floors: number;
        units: number;
        totalValue: number;
    };
    updateField: (field: string, value: any) => void;
    isEditing: boolean;
    errors: { [key: string]: string };
}

export function TechnicalSpecsCard({ formData, updateField, isEditing, errors }: TechnicalSpecsCardProps) {
  const iconSizes = useIconSizes();
  const costPerSqm = calculateCostPerSqm(formData.totalValue, formData.totalArea);
  const buildingRatio = calculateBuildingRatio(formData.builtArea, formData.totalArea);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className={iconSizes.md} />
          Τεχνικά Χαρακτηριστικά
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <div className="space-y-2">
            <Label>Συνολική Επιφάνεια (m²) *</Label>
            <Input 
              type="number"
              value={formData.totalArea}
              onChange={(e) => updateField('totalArea', parseFloat(e.target.value) || 0)}
              disabled={!isEditing}
              className={cn(!isEditing && "bg-muted", errors.totalArea && "border-red-500")}
            />
            {errors.totalArea && <p className="text-sm text-red-500">{errors.totalArea}</p>}
          </div>
          
          <div className="space-y-2">
            <Label>Δομημένη Επιφάνεια (m²) *</Label>
            <Input 
              type="number"
              value={formData.builtArea}
              onChange={(e) => updateField('builtArea', parseFloat(e.target.value) || 0)}
              disabled={!isEditing}
              className={cn(!isEditing && "bg-muted", errors.builtArea && "border-red-500")}
            />
            {errors.builtArea && <p className="text-sm text-red-500">{errors.builtArea}</p>}
            {formData.totalArea > 0 && (
              <p className="text-xs text-muted-foreground">
                Συντελεστής δόμησης: {buildingRatio.toFixed(1)}%
              </p>
            )}
          </div>
          
          <div className="space-y-2">
            <Label>Αριθμός Ορόφων *</Label>
            <Input 
              type="number"
              value={formData.floors}
              onChange={(e) => updateField('floors', parseInt(e.target.value) || 0)}
              disabled={!isEditing}
              className={cn(!isEditing && "bg-muted", errors.floors && "border-red-500")}
            />
            {errors.floors && <p className="text-sm text-red-500">{errors.floors}</p>}
          </div>
          
          <div className="space-y-2">
            <Label>Αριθμός Μονάδων *</Label>
            <Input 
              type="number"
              value={formData.units}
              onChange={(e) => updateField('units', parseInt(e.target.value) || 0)}
              disabled={!isEditing}
              className={cn(!isEditing && "bg-muted", errors.units && "border-red-500")}
            />
            {errors.units && <p className="text-sm text-red-500">{errors.units}</p>}
            {formData.floors > 0 && (
              <p className="text-xs text-muted-foreground">
                ~{(formData.units / formData.floors).toFixed(1)} μονάδες/όροφο
              </p>
            )}
          </div>
        </div>

        {costPerSqm > 0 && (
          <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
            <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
              💡 Αυτόματοι Υπολογισμοί
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-blue-700 dark:text-blue-300">Κόστος/m²:</span>
                <p className="font-semibold">{formatCurrency(costPerSqm, 'EUR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
              </div>
              <div>
                <span className="text-blue-700 dark:text-blue-300">Συντ. Δόμησης:</span>
                <p className="font-semibold">{buildingRatio.toFixed(1)}%</p>
              </div>
              <div>
                <span className="text-blue-700 dark:text-blue-300">m²/Μονάδα:</span>
                <p className="font-semibold">{formData.units > 0 ? (formData.builtArea / formData.units).toFixed(1) : 0} m²</p>
              </div>
              <div>
                <span className="text-blue-700 dark:text-blue-300">Αξία/Μονάδα:</span>
                <p className="font-semibold">{formData.units > 0 ? formatCurrency(formData.totalValue / formData.units, 'EUR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) : '0€'}</p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
