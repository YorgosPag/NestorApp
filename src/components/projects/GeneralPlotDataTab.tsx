'use client';

import React, { useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { GeneralPlotFormFields } from './GeneralPlotFormFields';
import { PlotZoningSelectors } from './PlotZoningSelectors';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';

export interface PlotData {
    sdNoSocial: number;
    socialFactor: number;
    sdFinal?: number;
    plotArea: number;
    areaCompleteness: number;
    areaCompletenessDerogation: number;
    faceCompleteness: number;
    faceCompletenessDerogation: number;
    insideLimits: 'yes' | 'no';
    insideZone: 'yes' | 'no';
    pilotis: 'yes' | 'no';
    hasRoof: 'yes' | 'no';
    maxRoofHeight: number;
    maxRoofSlope: number;
}

interface GeneralPlotDataTabProps {
    plotData: PlotData;
    onPlotDataChange: (newData: Partial<PlotData>) => void;
    isEditing: boolean;
}

export function GeneralPlotDataTab({ plotData, onPlotDataChange, isEditing }: GeneralPlotDataTabProps) {
    // 🏢 ENTERPRISE: i18n hook
    const { t } = useTranslation('projects');
    const formRef = useRef<HTMLDivElement>(null);

    const handleEnterNavigation = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        if (!formRef.current) return;

        const focusable = Array.from(
            formRef.current.querySelectorAll(
                'input:not([readonly]), button, [role="combobox"]'
            )
        ) as HTMLElement[];

        const currentIndex = focusable.indexOf(e.currentTarget as HTMLElement);
        const nextIndex = (currentIndex + 1) % focusable.length;
        
        if (nextIndex < focusable.length) {
            focusable[nextIndex].focus();
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-lg text-center">{t('plotDataTab.title')}</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-4" ref={formRef}>
                   <GeneralPlotFormFields 
                        plotData={plotData}
                        onPlotDataChange={onPlotDataChange}
                        isEditing={isEditing}
                        onEnterPress={handleEnterNavigation}
                   />
                   <PlotZoningSelectors
                        plotData={plotData}
                        onPlotDataChange={onPlotDataChange}
                        isEditing={isEditing}
                        onEnterPress={handleEnterNavigation}
                   />
                </div>
            </CardContent>
        </Card>
    );
}
