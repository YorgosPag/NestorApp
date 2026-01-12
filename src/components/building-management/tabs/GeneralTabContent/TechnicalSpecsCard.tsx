'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { calculateBuildingRatio, calculateCostPerSqm } from './utils';
import { formatCurrency, formatNumber } from '@/lib/intl-utils';
// 🏢 ENTERPRISE: i18n - Full internationalization support
import { useTranslation } from '@/i18n/hooks/useTranslation';

interface TechnicalSpecsCardProps {
    formData: {
        totalArea: number;
        builtArea: number;
        floors: number;
        units: number;
        totalValue: number;
    };
    updateField: (field: string, value: string | number) => void;
    isEditing: boolean;
    errors: { [key: string]: string };
}

export function TechnicalSpecsCard({ formData, updateField, isEditing, errors }: TechnicalSpecsCardProps) {
  // 🏢 ENTERPRISE: i18n hook for translations
  const { t } = useTranslation('building');
  const iconSizes = useIconSizes();
  const { getStatusBorder } = useBorderTokens();
  const colors = useSemanticColors();
  const costPerSqm = calculateCostPerSqm(formData.totalValue, formData.totalArea);
  const buildingRatio = calculateBuildingRatio(formData.builtArea, formData.totalArea);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className={iconSizes.md} />
          {t('tabs.general.technicalSpecs.title')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <div className="space-y-2">
            <Label>{t('tabs.general.technicalSpecs.totalArea')}</Label>
            <Input
              type="number"
              value={formData.totalArea}
              onChange={(e) => updateField('totalArea', parseFloat(e.target.value) || 0)}
              disabled={!isEditing}
              className={cn(!isEditing && "bg-muted", errors.totalArea && getStatusBorder('error'))}
            />
            {errors.totalArea && <p className={`text-sm ${colors.text.error}`}>{errors.totalArea}</p>}
          </div>

          <div className="space-y-2">
            <Label>{t('tabs.general.technicalSpecs.builtArea')}</Label>
            <Input
              type="number"
              value={formData.builtArea}
              onChange={(e) => updateField('builtArea', parseFloat(e.target.value) || 0)}
              disabled={!isEditing}
              className={cn(!isEditing && "bg-muted", errors.builtArea && getStatusBorder('error'))}
            />
            {errors.builtArea && <p className={`text-sm ${colors.text.error}`}>{errors.builtArea}</p>}
            {formData.totalArea > 0 && (
              <p className="text-xs text-muted-foreground">
                {t('tabs.general.technicalSpecs.buildingRatio', { ratio: buildingRatio.toFixed(1) })}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>{t('tabs.general.technicalSpecs.numberOfFloors')}</Label>
            <Input
              type="number"
              value={formData.floors}
              onChange={(e) => updateField('floors', parseInt(e.target.value) || 0)}
              disabled={!isEditing}
              className={cn(!isEditing && "bg-muted", errors.floors && getStatusBorder('error'))}
            />
            {errors.floors && <p className={`text-sm ${colors.text.error}`}>{errors.floors}</p>}
          </div>

          <div className="space-y-2">
            <Label>{t('tabs.general.technicalSpecs.numberOfUnits')}</Label>
            <Input
              type="number"
              value={formData.units}
              onChange={(e) => updateField('units', parseInt(e.target.value) || 0)}
              disabled={!isEditing}
              className={cn(!isEditing && "bg-muted", errors.units && getStatusBorder('error'))}
            />
            {errors.units && <p className={`text-sm ${colors.text.error}`}>{errors.units}</p>}
            {formData.floors > 0 && (
              <p className="text-xs text-muted-foreground">
                {t('tabs.general.technicalSpecs.unitsPerFloor', { count: (formData.units / formData.floors).toFixed(1) })}
              </p>
            )}
          </div>
        </div>

        {costPerSqm > 0 && (
          <div className={`mt-6 p-4 ${colors.bg.info} rounded-lg`}>
            <h4 className={`font-medium ${colors.text.info} mb-2`}>
              💡 {t('tabs.general.technicalSpecs.autoCalculations')}
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className={`${colors.text.info}`}>{t('tabs.general.technicalSpecs.costPerSqm')}</span>
                <p className="font-semibold">{formatCurrency(costPerSqm, 'EUR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
              </div>
              <div>
                <span className="text-blue-700 dark:text-blue-300">{t('tabs.general.technicalSpecs.buildingRatioShort')}</span>
                <p className="font-semibold">{buildingRatio.toFixed(1)}%</p>
              </div>
              <div>
                <span className="text-blue-700 dark:text-blue-300">{t('tabs.general.technicalSpecs.sqmPerUnit')}</span>
                <p className="font-semibold">{formData.units > 0 ? (formData.builtArea / formData.units).toFixed(1) : 0} m²</p>
              </div>
              <div>
                <span className="text-blue-700 dark:text-blue-300">{t('tabs.general.technicalSpecs.valuePerUnit')}</span>
                <p className="font-semibold">{formData.units > 0 ? formatCurrency(formData.totalValue / formData.units, 'EUR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) : '0€'}</p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
