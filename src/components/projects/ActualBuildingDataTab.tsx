'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FormField } from './FormField';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';

export interface ActualData {
    construction: number;
    plotCoverage: number;
    semiOutdoorArea: number;
    balconyArea: number;
    height: number;
}

export interface CalculatedActualData {
    coveragePercentage: number;
    semiOutdoorPercentage: number;
    balconyPercentage: number;
    combinedArea: number;
    combinedPercentage: number;
    volumeExploitation: number;
    volumeCoefficient: number;
}

interface ActualBuildingDataTabProps {
    actualData: ActualData;
    calculatedData: CalculatedActualData;
    onActualDataChange: (newData: Partial<ActualData>) => void;
    isEditing: boolean;
}

export function ActualBuildingDataTab({ actualData, calculatedData, onActualDataChange, isEditing }: ActualBuildingDataTabProps) {
    // 🏢 ENTERPRISE: i18n hook
    const { t } = useTranslation('properties');

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        onActualDataChange({ [name]: parseFloat(value) || 0 });
    };

    // 🏢 ENTERPRISE: Centralized units from i18n
    const units = {
        sqm: t('projects.actualBuildingData.units.sqm'),
        cbm: t('projects.actualBuildingData.units.cbm'),
        percent: t('projects.actualBuildingData.units.percent'),
        meters: t('projects.actualBuildingData.units.meters')
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-lg text-center">{t('projects.actualBuildingData.title')}</CardTitle>
            </CardHeader>
            <CardContent className="pt-4 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                <FormField label={t('projects.actualBuildingData.fields.construction')} id="construction" value={actualData.construction} unit={units.sqm} onChange={handleChange} useGrouping readOnly={!isEditing} />
                <FormField label={t('projects.actualBuildingData.fields.plotCoverage')} id="plotCoverage" value={actualData.plotCoverage} unit={units.sqm} onChange={handleChange} useGrouping readOnly={!isEditing} />
                <FormField label={t('projects.actualBuildingData.fields.coveragePercentage')} id="coveragePercentage" value={calculatedData.coveragePercentage * 100} unit={units.percent} readOnly isPercentage />
                <FormField label={t('projects.actualBuildingData.fields.semiOutdoorArea')} id="semiOutdoorArea" value={actualData.semiOutdoorArea} unit={units.sqm} onChange={handleChange} useGrouping readOnly={!isEditing} />
                <FormField label={t('projects.actualBuildingData.fields.semiOutdoorPercentage')} id="semiOutdoorPercentage" value={calculatedData.semiOutdoorPercentage * 100} unit={units.percent} readOnly isPercentage />
                <FormField label={t('projects.actualBuildingData.fields.balconyArea')} id="balconyArea" value={actualData.balconyArea} unit={units.sqm} onChange={handleChange} useGrouping readOnly={!isEditing} />
                <FormField label={t('projects.actualBuildingData.fields.balconyPercentage')} id="balconyPercentage" value={calculatedData.balconyPercentage * 100} unit={units.percent} readOnly isPercentage />
                <FormField label={t('projects.actualBuildingData.fields.combinedArea')} id="combinedArea" value={calculatedData.combinedArea} unit={units.sqm} readOnly useGrouping />
                <FormField label={t('projects.actualBuildingData.fields.combinedPercentage')} id="combinedPercentage" value={calculatedData.combinedPercentage * 100} unit={units.percent} readOnly isPercentage />
                <FormField label={t('projects.actualBuildingData.fields.volumeExploitation')} id="volumeExploitation" value={calculatedData.volumeExploitation} unit={units.cbm} readOnly useGrouping />
                <FormField label={t('projects.actualBuildingData.fields.volumeCoefficient')} id="volumeCoefficient" value={calculatedData.volumeCoefficient} unit="" readOnly />
                <FormField label={t('projects.actualBuildingData.fields.height')} id="height" value={actualData.height} unit={units.meters} onChange={handleChange} readOnly={!isEditing} />
            </CardContent>
        </Card>
    );
}
