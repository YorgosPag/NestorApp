'use client';

import React from 'react';
import { FormField } from '../FormField';

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
    return (
        <div className="space-y-4">
            <FormField
                id="grossOutsideStairwell"
                label="Μικτά Εκτός Κλιμακοστασίου"
                unit="τ.μ."
                value={financialData.grossOutsideStairwell}
                onChange={onChange}
                onEnterPress={onEnterPress}
                tooltipText="Το συνολικό μικτό εμβαδόν εκτός του κλιμακοστασίου."
                labelPosition="left"
                inputClassName="w-48"
                unitPosition="left"
            />
            <FormField
                id="relatedArea"
                label="Εμβαδόν Που Ανάγεται"
                unit="τ.μ."
                value={financialData.relatedArea}
                onChange={onChange}
                onEnterPress={onEnterPress}
                tooltipText="Επιπλέον εμβαδόν που προστίθεται ή ανάγεται."
                labelPosition="left"
                inputClassName="w-48"
                unitPosition="left"
            />
            <FormField
                id="actualConstructionArea"
                label="Εμβαδόν Πραγμ. Δόμησης & Αναγωγής"
                unit="τ.μ."
                value={financialData.actualConstructionArea}
                onChange={onChange}
                onEnterPress={onEnterPress}
                tooltipText="Το τελικό εμβαδόν της πραγματικής δόμησης συμπεριλαμβανομένης της αναγωγής."
                labelPosition="left"
                inputClassName="w-48"
                unitPosition="left"
            />
            <FormField
                id="estimatedCost"
                label="Εκτιμώμενο Κόστος Έργου"
                unit="€"
                value={financialData.estimatedCost}
                onChange={onChange}
                onEnterPress={onEnterPress}
                tooltipText="Το συνολικό εκτιμώμενο κόστος για την ολοκλήρωση του έργου."
                labelPosition="left"
                inputClassName="w-48"
                useGrouping
            />
            <FormField
                id="progressPercentage"
                label="Ποσοστό Προόδου Έργου"
                unit="%"
                value={calculatedData.progressPercentage}
                readOnly
                tooltipText="Υπολογίζεται αυτόματα: (Αξία Πραγματοποιηθέντος / Εκτιμώμενο Κόστος) * 100"
                labelPosition="left"
                inputClassName="w-48"
                isPercentage
                unitPosition="left"
            />
        </div>
    );
}
