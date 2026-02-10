'use client';

import React, { useState, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useEnterFormNavigation } from '@/hooks/useEnterFormNavigation';
import { useFinancialCalculations } from '@/hooks/useFinancialCalculations';
import { FinancialLeftColumn } from './other-data/FinancialLeftColumn';
import { FinancialRightColumn } from './other-data/FinancialRightColumn';
import { useTypography } from '@/hooks/useTypography';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';

export function OtherDataTab() {
    // 🏢 ENTERPRISE: i18n hook
    const { t } = useTranslation('projects');
    const typography = useTypography();
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
                <CardTitle className={typography.card.titleCompact}>{t('otherDataTab.title')}</CardTitle>
                <CardDescription>
                    {t('otherDataTab.description')}
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
