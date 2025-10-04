'use client';

import React, { useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { FormField } from './FormField';
import { useTranslation } from '@/i18n';

export interface AllowedDataInput {
    maxCoveragePercentage: number;
    maxSemiOutdoorPercentage: number;
    maxBalconyPercentage: number;
    maxCombinedPercentage: number;
    maxVolumeCoefficient: number;
    maxAllowedHeight: number;
}

export interface AllowedDataCalculated {
    maxAllowedConstruction: number;
    maxPlotCoverage: number;
    maxAllowedSemiOutdoorArea: number;
    maxBalconyArea: number;
    maxCombinedArea: number;
    maxVolumeExploitation: number;
}

interface AllowedBuildingDataTabProps {
    allowedDataInput: AllowedDataInput;
    calculatedData: AllowedDataCalculated;
    onInputChange: (newData: Partial<AllowedDataInput>) => void;
    isEditing: boolean;
}

const CalculationFormula = ({ text, className }: { text: string; className?: string }) => {
    if (!text) return <div className="h-8" />;
    return (
        <div className={cn("h-8 flex items-center text-sm")}>
            <span className="mr-2 text-muted-foreground">=</span>
            <span className={cn("text-muted-foreground", className)}>{text}</span>
        </div>
    );
};

export function AllowedBuildingDataTab({ allowedDataInput, calculatedData, onInputChange, isEditing }: AllowedBuildingDataTabProps) {
    const { t } = useTranslation('properties');
    const formRef = useRef<HTMLDivElement>(null);
    
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        onInputChange({ [name]: parseFloat(value) || 0 });
    };

    const handleEnterNavigation = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        if (!formRef.current) return;

        const focusable = Array.from(
            formRef.current.querySelectorAll(
                'input:not([readonly])'
            )
        ) as HTMLElement[];

        const currentIndex = focusable.indexOf(e.currentTarget);
        const nextIndex = (currentIndex + 1) % focusable.length;
        
        if (nextIndex < focusable.length) {
            focusable[nextIndex].focus();
        }
    };

    return (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg text-center">{t('projects.buildingData.title')}</CardTitle>
          </CardHeader>
          <CardContent className="pt-4 flex justify-center">
            <div className="flex gap-x-8" ref={formRef}>
                {/* Left Column - Fields */}
                <div className="space-y-3">
                    <FormField label={t('projects.buildingData.fields.maxAllowedConstruction')} id="maxAllowedConstruction" value={calculatedData.maxAllowedConstruction} unit="τ.μ." readOnly labelPosition='left' inputClassName="w-40" unitPosition="left" useGrouping />
                    <FormField label={t('projects.buildingData.fields.maxCoveragePercentage')} id="maxCoveragePercentage" value={allowedDataInput.maxCoveragePercentage} unit="%" labelClassName="text-green-600 dark:text-green-500" onChange={handleChange} onEnterPress={handleEnterNavigation} isPercentage labelPosition='left' inputClassName="w-40" unitPosition="left" readOnly={!isEditing} />
                    <FormField label={t('projects.buildingData.fields.maxPlotCoverage')} id="maxPlotCoverage" value={calculatedData.maxPlotCoverage} unit="τ.μ." labelClassName="text-blue-600 dark:text-blue-500" readOnly labelPosition='left' inputClassName="w-40" unitPosition="left" useGrouping />
                    <FormField label={t('projects.buildingData.fields.maxSemiOutdoorPercentage')} id="maxSemiOutdoorPercentage" value={allowedDataInput.maxSemiOutdoorPercentage} unit="%" labelClassName="text-orange-600 dark:text-orange-500" onChange={handleChange} onEnterPress={handleEnterNavigation} isPercentage labelPosition='left' inputClassName="w-40" unitPosition="left" readOnly={!isEditing} />
                    <FormField label={t('projects.buildingData.fields.maxAllowedSemiOutdoorArea')} id="maxAllowedSemiOutdoorArea" value={calculatedData.maxAllowedSemiOutdoorArea} unit="τ.μ." labelClassName="text-red-500" readOnly labelPosition='left' inputClassName="w-40" unitPosition="left" useGrouping />
                    <FormField label={t('projects.buildingData.fields.maxBalconyPercentage')} id="maxBalconyPercentage" value={allowedDataInput.maxBalconyPercentage} unit="%" labelClassName="text-cyan-600 dark:text-cyan-500" onChange={handleChange} onEnterPress={handleEnterNavigation} isPercentage labelPosition='left' inputClassName="w-40" unitPosition="left" readOnly={!isEditing} />
                    <FormField label={t('projects.buildingData.fields.maxBalconyArea')} id="maxBalconyArea" value={calculatedData.maxBalconyArea} unit="τ.μ." labelClassName="text-fuchsia-600 dark:text-fuchsia-500" readOnly labelPosition='left' inputClassName="w-40" unitPosition="left" useGrouping />
                    <FormField label={t('projects.buildingData.fields.maxCombinedPercentage')} id="maxCombinedPercentage" value={allowedDataInput.maxCombinedPercentage} unit="%" labelClassName="text-teal-600 dark:text-teal-500" onChange={handleChange} onEnterPress={handleEnterNavigation} isPercentage labelPosition='left' inputClassName="w-40" unitPosition="left" readOnly={!isEditing} />
                    <FormField label={t('projects.buildingData.fields.maxCombinedArea')} id="maxCombinedArea" value={calculatedData.maxCombinedArea} unit="τ.μ." labelClassName="text-sky-600 dark:text-sky-500" readOnly labelPosition='left' inputClassName="w-40" unitPosition="left" useGrouping />
                    <FormField label={t('projects.buildingData.fields.maxVolumeCoefficient')} id="maxVolumeCoefficient" value={allowedDataInput.maxVolumeCoefficient} unit="" labelClassName="text-lime-600 dark:text-lime-500" onChange={handleChange} onEnterPress={handleEnterNavigation} labelPosition='left' inputClassName="w-40" readOnly={!isEditing} />
                    <FormField label={t('projects.buildingData.fields.maxVolumeExploitation')} id="maxVolumeExploitation" value={calculatedData.maxVolumeExploitation} unit="κ.μ." labelClassName="text-red-600 dark:text-red-500" readOnly labelPosition='left' inputClassName="w-40" unitPosition="left" useGrouping />
                    <FormField label={t('projects.buildingData.fields.maxAllowedHeight')} id="maxAllowedHeight" value={allowedDataInput.maxAllowedHeight} unit="m" labelClassName="text-indigo-500" onChange={handleChange} onEnterPress={handleEnterNavigation} labelPosition='left' inputClassName="w-40" unitPosition="left" readOnly={!isEditing} />
                </div>
                {/* Right Column - Formulas */}
                <div className="space-y-3 border-l pl-4">
                     <CalculationFormula text={t('projects.buildingData.formulas.construction')} />
                     <CalculationFormula text="" />
                     <CalculationFormula text={t('projects.buildingData.formulas.plotCoverage')} className="text-blue-600 dark:text-blue-500" />
                     <CalculationFormula text="" />
                     <CalculationFormula text={t('projects.buildingData.formulas.semiOutdoor')} className="text-red-500" />
                     <CalculationFormula text="" />
                     <CalculationFormula text={t('projects.buildingData.formulas.balcony')} className="text-fuchsia-600 dark:text-fuchsia-500" />
                     <CalculationFormula text="" />
                     <CalculationFormula text={t('projects.buildingData.formulas.combined')} className="text-sky-600 dark:text-sky-500" />
                     <CalculationFormula text="" />
                     <CalculationFormula text={t('projects.buildingData.formulas.volume')} className="text-red-600 dark:text-red-500" />
                     <CalculationFormula text="" />
                </div>
            </div>
          </CardContent>
        </Card>
    );
}
