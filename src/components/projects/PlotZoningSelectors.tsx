/* eslint-disable design-system/prefer-design-system-imports */
'use client';

import React from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FormField } from './FormField';
import type { PlotData } from './GeneralPlotDataTab';
import { getBooleanOptions } from '@/subapps/dxf-viewer/config/modal-select/core/options/encoding';
import { useTypography } from '@/hooks/useTypography';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';

interface PlotZoningSelectorsProps {
    plotData: PlotData;
    onPlotDataChange: (newData: Partial<PlotData>) => void;
    isEditing: boolean;
    onEnterPress: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}


type YesNoField = 'insideLimits' | 'insideZone' | 'pilotis' | 'hasRoof';

/**
 * 🔑 **ΕΝΑ ΣΩΜΑ ΓΙΑ ΤΙΣ ΤΕΣΣΕΡΙΣ ΝΑΙ/ΟΧΙ ΓΡΑΜΜΕΣ** (N.0.2 · CHECK 3.28).
 *
 * Τα `insideLimits` · `insideZone` · `pilotis` · `hasRoof` ζωγράφιζαν **token-ταυτόσημη**
 * σήμανση (14 γραμμές η καθεμία) με μόνη διαφορά το **πεδίο** και το **κλειδί ετικέτας**.
 *
 * ⚠️ **ΖΕΙ ΕΞΩ ΑΠΟ ΤΟ `PlotZoningSelectors`, ΚΑΙ ΕΙΝΑΙ ΑΠΟΦΑΣΗ**: component ορισμένο
 * **μέσα** σε άλλο ξαναδημιουργείται σε κάθε render, οπότε το React το βλέπει ως
 * **άλλον τύπο** και κάνει unmount/remount — ένα ανοιχτό dropdown θα **έκλεινε** μόλις
 * ο γονέας ξαναζωγράφιζε. Γι᾽ αυτό παίρνει τα πάντα από props.
 *
 * ⚠️ **ΤΟ `t(option.label)` ΕΙΝΑΙ ΜΕΡΟΣ ΤΟΥ ΚΑΝΟΝΑ, ΟΧΙ ΛΕΠΤΟΜΕΡΕΙΑ**: το
 * `getBooleanOptions()` επιστρέφει **i18n κλειδιά**, όχι κείμενο. Μια πέμπτη γραμμή
 * που ξεχνούσε τη μετάφραση θα ζωγράφιζε **ωμό κλειδί** στην οθόνη.
 */
function YesNoRow({ field, labelKey, value, disabled, onChange, t, typography, colors }: {
    field: YesNoField;
    labelKey: string;
    value: 'yes' | 'no';
    disabled: boolean;
    onChange: (field: YesNoField, value: 'yes' | 'no') => void;
    t: (key: string) => string;
    typography: ReturnType<typeof useTypography>;
    colors: ReturnType<typeof useSemanticColors>;
}) {
    return (
        <div className="grid grid-cols-[auto_1fr] items-center">
            <Select value={value} onValueChange={(v) => onChange(field, v as 'yes' | 'no')} disabled={disabled}>
                <SelectTrigger className="h-8 w-28">
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    {getBooleanOptions().map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                            {t(option.label)}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
            <Label className={cn(typography.label.sm, colors.text.muted, "text-left pl-2")}>{t(`plotZoning.${labelKey}`)}</Label>
        </div>
    );
}

export function PlotZoningSelectors({ plotData, onPlotDataChange, isEditing, onEnterPress }: PlotZoningSelectorsProps) {
    // 🏢 ENTERPRISE: i18n hook
    const { t } = useTranslation(['projects', 'projects-data', 'projects-ika']);
    const typography = useTypography();
    const colors = useSemanticColors();

    const handleSelectChange = (field: keyof PlotData, value: 'yes' | 'no') => {
        onPlotDataChange({ [field]: value });
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        onPlotDataChange({ [name]: parseFloat(value) || 0 });
    };

    return (
        <div className="space-y-2">
            <YesNoRow field="insideLimits" labelKey="insideLimits" value={plotData.insideLimits} disabled={!isEditing} onChange={handleSelectChange} t={t} typography={typography} colors={colors} />
            <YesNoRow field="insideZone" labelKey="insideZone" value={plotData.insideZone} disabled={!isEditing} onChange={handleSelectChange} t={t} typography={typography} colors={colors} />
            <YesNoRow field="pilotis" labelKey="pilotis" value={plotData.pilotis} disabled={!isEditing} onChange={handleSelectChange} t={t} typography={typography} colors={colors} />
            <YesNoRow field="hasRoof" labelKey="roof" value={plotData.hasRoof} disabled={!isEditing} onChange={handleSelectChange} t={t} typography={typography} colors={colors} />

            <FormField id="maxRoofHeight" label={t('plotZoning.maxRoofHeight')} value={plotData.maxRoofHeight} onChange={handleChange} unit={t('units.linearMeters')} labelPosition='left' unitPosition='left' onEnterPress={onEnterPress} inputClassName="w-32" labelClassName={colors.text.muted} readOnly={!isEditing} />
            <FormField id="maxRoofSlope" label={t('plotZoning.maxRoofSlope')} value={plotData.maxRoofSlope} onChange={handleChange} unit={t('units.percentage')} labelPosition='left' unitPosition='left' onEnterPress={onEnterPress} inputClassName="w-32" labelClassName={colors.text.muted} readOnly={!isEditing} />
            <FormField id="plotArea" label={t('plotZoning.plotArea')} value={plotData.plotArea} onChange={handleChange} unit={t('units.sqm')} labelPosition='left' unitPosition='left' useGrouping onEnterPress={onEnterPress} inputClassName="w-32" labelClassName={colors.text.muted} readOnly={!isEditing} />
        </div>
    );
}
