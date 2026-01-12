
'use client';

// 🏢 ENTERPRISE: Type for translate function (from useTranslation hook)
type TranslateFunction = (key: string) => string;

// 🏢 ENTERPRISE: Raw cost breakdown data with translation keys
const costBreakdownData = [
    { categoryKey: 'materials', amount: 450000, percentage: 45, color: 'bg-blue-500' },
    { categoryKey: 'labor', amount: 300000, percentage: 30, color: 'bg-green-500' },
    { categoryKey: 'equipment', amount: 150000, percentage: 15, color: 'bg-yellow-500' },
    { categoryKey: 'other', amount: 100000, percentage: 10, color: 'bg-purple-500' }
];

// 🏢 ENTERPRISE: Get cost breakdown with i18n support
export const getCostBreakdown = (t: TranslateFunction) => {
    return costBreakdownData.map(item => ({
        category: t(`analytics.costCategories.${item.categoryKey}`),
        amount: item.amount,
        percentage: item.percentage,
        color: item.color
    }));
};

// 🏢 ENTERPRISE: Legacy export for backward compatibility
export const costBreakdown = costBreakdownData.map(item => ({
    category: item.categoryKey,
    amount: item.amount,
    percentage: item.percentage,
    color: item.color
}));

// 🏢 ENTERPRISE: Raw monthly progress data with month keys
const monthlyProgressData = [
    { monthKey: 'jan', planned: 10, actual: 8, cost: 85000 },
    { monthKey: 'feb', planned: 20, actual: 18, cost: 92000 },
    { monthKey: 'mar', planned: 35, actual: 32, cost: 98000 },
    { monthKey: 'apr', planned: 50, actual: 48, cost: 105000 },
    { monthKey: 'may', planned: 65, actual: 62, cost: 89000 },
    { monthKey: 'jun', planned: 80, actual: 75, cost: 94000 },
    { monthKey: 'jul', planned: 90, actual: 85, cost: 87000 }
];

// 🏢 ENTERPRISE: Get monthly progress with i18n support
export const getMonthlyProgress = (t: TranslateFunction) => {
    return monthlyProgressData.map(item => ({
        month: t(`analytics.months.${item.monthKey}`),
        planned: item.planned,
        actual: item.actual,
        cost: item.cost
    }));
};

// 🏢 ENTERPRISE: Legacy export for backward compatibility
export const monthlyProgress = monthlyProgressData.map(item => ({
    month: item.monthKey,
    planned: item.planned,
    actual: item.actual,
    cost: item.cost
}));

// 🏢 ENTERPRISE: KPIs with risk level key
const kpisData = {
    costEfficiency: 92.5,
    timeEfficiency: 88.7,
    qualityScore: 95.2,
    riskLevelKey: 'low',
    roi: 15.8,
    profitMargin: 12.3
};

// 🏢 ENTERPRISE: Get KPIs with i18n support
export const getKpis = (t: TranslateFunction) => ({
    ...kpisData,
    riskLevel: t(`analytics.riskLevels.${kpisData.riskLevelKey}`)
});

// 🏢 ENTERPRISE: Legacy export for backward compatibility
export const kpis = {
    ...kpisData,
    riskLevel: kpisData.riskLevelKey
};

export const getEfficiencyColor = (value: number) => {
    if (value >= 90) return 'text-green-600 dark:text-green-400';
    if (value >= 75) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
};
