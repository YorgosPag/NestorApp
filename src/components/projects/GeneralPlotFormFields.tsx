'use client';

import React from 'react';
import { FormField } from './FormField';
import type { PlotData } from './GeneralPlotDataTab';
// 🏢 ENTERPRISE: i18n - Full internationalization support
import { useTranslation } from '@/i18n/hooks/useTranslation';

interface GeneralPlotFormFieldsProps {
    plotData: PlotData;
    onPlotDataChange: (newData: Partial<PlotData>) => void;
    isEditing: boolean;
    onEnterPress: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}

export function GeneralPlotFormFields({ plotData, onPlotDataChange, isEditing, onEnterPress }: GeneralPlotFormFieldsProps) {
    // 🏢 ENTERPRISE: i18n hook
    const { t } = useTranslation('projects');

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        onPlotDataChange({ [name]: parseFloat(value) || 0 });
    };

    return (
        <div className="space-y-3">
            <FormField id="sdNoSocial" label={t('plot.labels.sdNoSocial')} value={plotData.sdNoSocial} onChange={handleChange} onEnterPress={onEnterPress} labelPosition='left' inputClassName="w-32" labelClassName="text-muted-foreground" readOnly={!isEditing} />
            <FormField id="socialFactor" label={t('plot.labels.socialFactor')} value={plotData.socialFactor} onChange={handleChange} onEnterPress={onEnterPress} labelPosition='left' inputClassName="w-32" labelClassName="text-muted-foreground" readOnly={!isEditing} />
            <FormField id="sdFinal" label={t('plot.labels.sdFinal')} value={plotData.sdFinal!} readOnly labelPosition='left' inputClassName="w-32" labelClassName="text-muted-foreground" />
            <FormField id="areaCompleteness" label={t('plot.labels.areaCompleteness')} value={plotData.areaCompleteness} unit={t('plot.units.sqm')} onChange={handleChange} labelPosition='left' unitPosition='left' onEnterPress={onEnterPress} inputClassName="w-32" labelClassName="text-muted-foreground" readOnly={!isEditing} />
            <FormField id="areaCompletenessDerogation" label={t('plot.labels.areaCompletenessDerogation')} value={plotData.areaCompletenessDerogation} unit={t('plot.units.sqm')} onChange={handleChange} labelPosition='left' unitPosition='left' onEnterPress={onEnterPress} inputClassName="w-32" labelClassName="text-muted-foreground" readOnly={!isEditing} />
            <FormField id="faceCompleteness" label={t('plot.labels.faceCompleteness')} value={plotData.faceCompleteness} unit={t('plot.units.linearMeters')} onChange={handleChange} labelPosition='left' unitPosition='left' onEnterPress={onEnterPress} inputClassName="w-32" labelClassName="text-muted-foreground" readOnly={!isEditing} />
            <FormField id="faceCompletenessDerogation" label={t('plot.labels.faceCompletenessDerogation')} value={plotData.faceCompletenessDerogation} unit={t('plot.units.linearMeters')} onChange={handleChange} labelPosition='left' unitPosition='left' onEnterPress={onEnterPress} inputClassName="w-32" labelClassName="text-muted-foreground" readOnly={!isEditing} />
        </div>
    );
}
