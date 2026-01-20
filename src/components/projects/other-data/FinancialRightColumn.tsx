'use client';

import React from 'react';
import { FormField } from '../FormField';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';

interface FinancialRightColumnProps {
    financialData: {
        grossOutsideStairwell: number;
        relatedArea: number;
        actualConstructionArea: number;
        estimatedCost: number;
    };
    calculatedData: {
        progressPercentage: number;
    };
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onEnterPress: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}

export function FinancialRightColumn({ financialData, calculatedData, onChange, onEnterPress }: FinancialRightColumnProps) {
    // 🏢 ENTERPRISE: i18n hook
    const { t } = useTranslation('projects');

    return (
        <div className="space-y-4">
            <FormField
                id="grossOutsideStairwell"
                label={t('financial.grossExcludingStaircase')}
                unit={t('units.sqm')}
                value={financialData.grossOutsideStairwell}
                onChange={onChange}
                onEnterPress={onEnterPress}
                tooltipText={t('financial.tooltips.grossExcludingStaircase')}
                labelPosition="left"
                inputClassName="w-48"
                unitPosition="left"
            />
            <FormField
                id="relatedArea"
                label={t('financial.areaReduced')}
                unit={t('units.sqm')}
                value={financialData.relatedArea}
                onChange={onChange}
                onEnterPress={onEnterPress}
                tooltipText={t('financial.tooltips.areaReduced')}
                labelPosition="left"
                inputClassName="w-48"
                unitPosition="left"
            />
            <FormField
                id="actualConstructionArea"
                label={t('financial.actualBuildingArea')}
                unit={t('units.sqm')}
                value={financialData.actualConstructionArea}
                onChange={onChange}
                onEnterPress={onEnterPress}
                tooltipText={t('financial.tooltips.actualBuildingArea')}
                labelPosition="left"
                inputClassName="w-48"
                unitPosition="left"
            />
            <FormField
                id="estimatedCost"
                label={t('financial.estimatedCost')}
                unit="€"
                value={financialData.estimatedCost}
                onChange={onChange}
                onEnterPress={onEnterPress}
                tooltipText={t('financial.tooltips.estimatedCost')}
                labelPosition="left"
                inputClassName="w-48"
                useGrouping
            />
            <FormField
                id="progressPercentage"
                label={t('financial.progressPercentage')}
                unit={t('units.percentage')}
                value={calculatedData.progressPercentage}
                readOnly
                tooltipText={t('financial.tooltips.progressPercentage')}
                labelPosition="left"
                inputClassName="w-48"
                isPercentage
                unitPosition="left"
            />
        </div>
    );
}
