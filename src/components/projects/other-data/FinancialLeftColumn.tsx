'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import { FormField } from '../FormField';
// 🏢 ENTERPRISE: Centralized spacing tokens
import { useSpacingTokens } from '@/hooks/useSpacingTokens';

interface FinancialLeftColumnProps {
    financialData: {
        salePricePerSqm: number;
        costPerSqm: number;
        realizedValue: number;
        financing: number;
    };
    calculatedData: {
        completionAmount: number;
    };
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onEnterPress: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}

export function FinancialLeftColumn({ financialData, calculatedData, onChange, onEnterPress }: FinancialLeftColumnProps) {
    const { t } = useTranslation('forms');
    // 🏢 ENTERPRISE: Centralized spacing tokens
    const spacing = useSpacingTokens();

    return (
        <div className={spacing.spaceBetween.md}>
            <FormField
                id="salePricePerSqm"
                label={t('labels.salePricePerSqm')}
                unit="€"
                value={financialData.salePricePerSqm}
                onChange={onChange}
                onEnterPress={onEnterPress}
                tooltipText={t('tooltips.salePricePerSqm')}
                labelPosition="left"
                inputClassName="w-48"
                useGrouping
            />
            <FormField
                id="costPerSqm"
                label={t('labels.costPerSqm')}
                unit="€"
                value={financialData.costPerSqm}
                onChange={onChange}
                onEnterPress={onEnterPress}
                tooltipText={t('tooltips.costPerSqm')}
                labelPosition="left"
                inputClassName="w-48"
                useGrouping
            />
            <FormField
                id="realizedValue"
                label={t('labels.realizedValue')}
                unit="€"
                value={financialData.realizedValue}
                onChange={onChange}
                onEnterPress={onEnterPress}
                tooltipText={t('tooltips.realizedValue')}
                labelPosition="left"
                inputClassName="w-48"
                useGrouping
            />
            <FormField
                id="completionAmount"
                label={t('labels.completionAmount')}
                unit="€"
                value={calculatedData.completionAmount}
                readOnly
                tooltipText={t('tooltips.completionAmount')}
                labelPosition="left"
                inputClassName="w-48"
                useGrouping
            />
            <FormField
                id="financing"
                label={t('labels.financing')}
                unit="€"
                value={financialData.financing}
                onChange={onChange}
                onEnterPress={onEnterPress}
                tooltipText={t('tooltips.financing')}
                labelPosition="left"
                inputClassName="w-48"
                useGrouping
            />
        </div>
    );
}
