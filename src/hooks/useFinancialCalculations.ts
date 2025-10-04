'use client';

import { useMemo } from 'react';

export function useFinancialCalculations(data: {
    estimatedCost: number;
    realizedValue: number;
}) {
    return useMemo(() => {
        const completionAmount = data.estimatedCost - data.realizedValue;
        const progressPercentage =
            data.estimatedCost > 0
                ? (data.realizedValue / data.estimatedCost) * 100
                : 0;

        return { completionAmount, progressPercentage };
    }, [data.estimatedCost, data.realizedValue]);
}
