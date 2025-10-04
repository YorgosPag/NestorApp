'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FormField } from './FormField';

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
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        onActualDataChange({ [name]: parseFloat(value) || 0 });
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-lg text-center">Πραγματοποιούμενα Στοιχεία Δόμησης</CardTitle>
            </CardHeader>
            <CardContent className="pt-4 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                <FormField label="Δόμηση" id="construction" value={actualData.construction} unit="τ.μ." onChange={handleChange} useGrouping readOnly={!isEditing} />
                <FormField label="Κάλυψη Οικοπέδου" id="plotCoverage" value={actualData.plotCoverage} unit="τ.μ." onChange={handleChange} useGrouping readOnly={!isEditing} />
                <FormField label="Ποσοστό Κάλυψης" id="coveragePercentage" value={calculatedData.coveragePercentage * 100} unit="%" readOnly isPercentage />
                <FormField label="Επιφάνεια Η/Χ" id="semiOutdoorArea" value={actualData.semiOutdoorArea} unit="τ.μ." onChange={handleChange} useGrouping readOnly={!isEditing} />
                <FormField label="Ποσοστό Η/Χ" id="semiOutdoorPercentage" value={calculatedData.semiOutdoorPercentage * 100} unit="%" readOnly isPercentage />
                <FormField label="Επιφάνεια Εξωστών" id="balconyArea" value={actualData.balconyArea} unit="τ.μ." onChange={handleChange} useGrouping readOnly={!isEditing} />
                <FormField label="Ποσοστό Εξωστών" id="balconyPercentage" value={calculatedData.balconyPercentage * 100} unit="%" readOnly isPercentage />
                <FormField label="Σύνολο Επιφ. Η/Χ & Εξωστών" id="combinedArea" value={calculatedData.combinedArea} unit="τ.μ." readOnly useGrouping />
                <FormField label="Ποσοστό Η/Χ & Εξωστών" id="combinedPercentage" value={calculatedData.combinedPercentage * 100} unit="%" readOnly isPercentage />
                <FormField label="Κατ’ Όγκον Εκμετάλλευση" id="volumeExploitation" value={calculatedData.volumeExploitation} unit="κ.μ." readOnly useGrouping />
                <FormField label="Συντελεστής Όγκου (Σ.Ο.)" id="volumeCoefficient" value={calculatedData.volumeCoefficient} unit="" readOnly />
                <FormField label="Ύψος" id="height" value={actualData.height} unit="m" onChange={handleChange} readOnly={!isEditing} />
            </CardContent>
        </Card>
    );
}
