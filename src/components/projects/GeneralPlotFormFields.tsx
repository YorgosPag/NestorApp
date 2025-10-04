'use client';

import React from 'react';
import { FormField } from './FormField';
import type { PlotData } from './GeneralPlotDataTab';

interface GeneralPlotFormFieldsProps {
    plotData: PlotData;
    onPlotDataChange: (newData: Partial<PlotData>) => void;
    isEditing: boolean;
    onEnterPress: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}

export function GeneralPlotFormFields({ plotData, onPlotDataChange, isEditing, onEnterPress }: GeneralPlotFormFieldsProps) {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        onPlotDataChange({ [name]: parseFloat(value) || 0 });
    };

    return (
        <div className="space-y-3">
            <FormField id="sdNoSocial" label="Συντελεστής Δόμησης (Χωρίς Κοιν. Συντελ.)" value={plotData.sdNoSocial} onChange={handleChange} onEnterPress={onEnterPress} labelPosition='left' inputClassName="w-32" labelClassName="text-muted-foreground" readOnly={!isEditing} />
            <FormField id="socialFactor" label="Κοινωνικός Συντελεστής" value={plotData.socialFactor} onChange={handleChange} onEnterPress={onEnterPress} labelPosition='left' inputClassName="w-32" labelClassName="text-muted-foreground" readOnly={!isEditing} />
            <FormField id="sdFinal" label="Συντελεστής Δόμησης (Τελικός)" value={plotData.sdFinal!} readOnly labelPosition='left' inputClassName="w-32" labelClassName="text-muted-foreground" />
            <FormField id="areaCompleteness" label="Εμβαδόν Αρτιότητας" value={plotData.areaCompleteness} unit="τ.μ." onChange={handleChange} labelPosition='left' unitPosition='left' onEnterPress={onEnterPress} inputClassName="w-32" labelClassName="text-muted-foreground" readOnly={!isEditing} />
            <FormField id="areaCompletenessDerogation" label="Εμβαδόν Αρτιότητας Κατά Παρέκκλιση" value={plotData.areaCompletenessDerogation} unit="τ.μ." onChange={handleChange} labelPosition='left' unitPosition='left' onEnterPress={onEnterPress} inputClassName="w-32" labelClassName="text-muted-foreground" readOnly={!isEditing} />
            <FormField id="faceCompleteness" label="Πρόσωπο Αρτιότητας" value={plotData.faceCompleteness} unit="μ.μ." onChange={handleChange} labelPosition='left' unitPosition='left' onEnterPress={onEnterPress} inputClassName="w-32" labelClassName="text-muted-foreground" readOnly={!isEditing} />
            <FormField id="faceCompletenessDerogation" label="Πρόσωπο Αρτιότητας Κατά Παρέκκλιση" value={plotData.faceCompletenessDerogation} unit="μ.μ." onChange={handleChange} labelPosition='left' unitPosition='left' onEnterPress={onEnterPress} inputClassName="w-32" labelClassName="text-muted-foreground" readOnly={!isEditing} />
        </div>
    );
}
