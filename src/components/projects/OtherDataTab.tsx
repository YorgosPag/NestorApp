'use client';

import React, { useState, useMemo, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useEnterFormNavigation } from '@/hooks/useEnterFormNavigation';
import { useFinancialCalculations } from '@/hooks/useFinancialCalculations';
import { FinancialLeftColumn } from './other-data/FinancialLeftColumn';
import { FinancialRightColumn } from './other-data/FinancialRightColumn';

export function OtherDataTab() {
    const formRef = useRef<HTMLDivElement>(null);
    const [financialData, setFinancialData] = useState({
        salePricePerSqm: 0,
        costPerSqm: 0,
        realizedValue: 3922222,
        financing: 0,
        grossOutsideStairwell: 0,
        relatedArea: 0,
        actualConstructionArea: 0,
        estimatedCost: 0,
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFinancialData(prev => ({ ...prev, [name]: parseFloat(value) || 0 }));
    };

    const handleEnterNavigation = useEnterFormNavigation(formRef);
    const calculatedData = useFinancialCalculations(financialData);

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-lg">Άλλα Στοιχεία</CardTitle>
                <CardDescription>
                    Οικονομικά στοιχεία και παρακολούθηση της προόδου του έργου.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-4" ref={formRef}>
                    <FinancialLeftColumn
                        financialData={financialData}
                        calculatedData={calculatedData}
                        onChange={handleChange}
                        onEnterPress={handleEnterNavigation}
                    />
                    <FinancialRightColumn
                        financialData={financialData}
                        calculatedData={calculatedData}
                        onChange={handleChange}
                        onEnterPress={handleEnterNavigation}
                    />
                </div>
            </CardContent>
        </Card>
    );
}
