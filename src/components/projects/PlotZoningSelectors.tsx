'use client';

import React from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FormField } from './FormField';
import type { PlotData } from './GeneralPlotDataTab';

interface PlotZoningSelectorsProps {
    plotData: PlotData;
    onPlotDataChange: (newData: Partial<PlotData>) => void;
    isEditing: boolean;
    onEnterPress: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}

export function PlotZoningSelectors({ plotData, onPlotDataChange, isEditing, onEnterPress }: PlotZoningSelectorsProps) {
    const handleSelectChange = (field: keyof PlotData, value: 'yes' | 'no') => {
        onPlotDataChange({ [field]: value });
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        onPlotDataChange({ [name]: parseFloat(value) || 0 });
    };

    return (
        <div className="space-y-3">
            <div className="grid grid-cols-[auto_1fr] items-center">
                 <Select value={plotData.insideLimits} onValueChange={(v) => handleSelectChange('insideLimits', v as 'yes' | 'no')} disabled={!isEditing}>
                    <SelectTrigger className="h-8 w-28">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="yes">Ναι</SelectItem>
                        <SelectItem value="no">Όχι</SelectItem>
                    </SelectContent>
                </Select>
                <Label className="text-sm font-medium text-muted-foreground text-left pl-2">Εντός Ορίων</Label>
            </div>
             <div className="grid grid-cols-[auto_1fr] items-center">
                 <Select value={plotData.insideZone} onValueChange={(v) => handleSelectChange('insideZone', v as 'yes' | 'no')} disabled={!isEditing}>
                    <SelectTrigger className="h-8 w-28">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="yes">Ναι</SelectItem>
                        <SelectItem value="no">Όχι</SelectItem>
                    </SelectContent>
                </Select>
                <Label className="text-sm font-medium text-muted-foreground text-left pl-2">Εντός Ζώνης</Label>
            </div>
            <div className="grid grid-cols-[auto_1fr] items-center">
                 <Select value={plotData.pilotis} onValueChange={(v) => handleSelectChange('pilotis', v as 'yes' | 'no')} disabled={!isEditing}>
                    <SelectTrigger className="h-8 w-28">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="yes">Ναι</SelectItem>
                        <SelectItem value="no">Όχι</SelectItem>
                    </SelectContent>
                </Select>
                <Label className="text-sm font-medium text-muted-foreground text-left pl-2">Πυλωτή</Label>
            </div>
             <div className="grid grid-cols-[auto_1fr] items-center">
                 <Select value={plotData.hasRoof} onValueChange={(v) => handleSelectChange('hasRoof', v as 'yes' | 'no')} disabled={!isEditing}>
                    <SelectTrigger className="h-8 w-28">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="yes">Ναι</SelectItem>
                        <SelectItem value="no">Όχι</SelectItem>
                    </SelectContent>
                </Select>
                <Label className="text-sm font-medium text-muted-foreground text-left pl-2">Στέγη</Label>
            </div>
            
            <FormField id="maxRoofHeight" label="Μέγιστο Ύψος Στέγης" value={plotData.maxRoofHeight} onChange={handleChange} unit="μ.μ." labelPosition='left' unitPosition='left' onEnterPress={onEnterPress} inputClassName="w-32" labelClassName="text-muted-foreground" readOnly={!isEditing} />
            <FormField id="maxRoofSlope" label="Μέγιστη Κλίση Στέγης" value={plotData.maxRoofSlope} onChange={handleChange} unit="%" labelPosition='left' unitPosition='left' onEnterPress={onEnterPress} inputClassName="w-32" labelClassName="text-muted-foreground" readOnly={!isEditing} />
            <FormField id="plotArea" label="Εμβαδόν Οικοπέδου (Ε.Ο.)" value={plotData.plotArea} onChange={handleChange} unit="τ.μ." labelPosition='left' unitPosition='left' useGrouping={true} onEnterPress={onEnterPress} inputClassName="w-32" labelClassName="text-muted-foreground" readOnly={!isEditing} />
        </div>
    );
}
