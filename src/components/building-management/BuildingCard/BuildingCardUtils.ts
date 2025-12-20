'use client';

import { Home, Building2, Users } from 'lucide-react';
import { formatFloorLabel as formatFloorLabelI18n, getCategoryLabel as getCategoryLabelI18n, getStatusLabel as getStatusLabelI18n, getPricePerSqmUnit, formatNumber, getDaysUntilCompletion as getDaysUntilCompletionI18n } from '@/lib/intl-utils';



export const formatFloorLabel = (floor: number): string => {
    return formatFloorLabelI18n(floor);
}

export const formatPricePerSqm = (price?: number, area?: number): string => {
    if (!price || !area || area === 0) return '-';
    const value = Math.round(price / area);
    return formatNumber(value) + getPricePerSqmUnit();
}


export const getProgressColor = (progress: number) => {
    if (progress < 25) return 'text-red-500';
    if (progress < 50) return 'text-yellow-500';
    if (progress < 75) return 'text-blue-500';
    return 'text-green-500';
};

export const getCategoryIcon = (category: string) => {
    switch (category) {
        case 'residential': return Home;
        case 'commercial': return Building2;
        case 'mixed': return Users;
        case 'industrial': return Building2;
        default: return Building2;
    }
};

export const getCategoryLabel = (category: string) => {
    return getCategoryLabelI18n(category);
};

// ✅ ENTERPRISE MIGRATION: Using centralized getDaysUntilCompletion
export const getDaysUntilCompletion = (completionDate?: string) => {
    return getDaysUntilCompletionI18n(completionDate);
};

export const getStatusColor = (status: string) => {
    switch (status) {
        case 'active': return 'bg-green-500';
        case 'construction': return 'bg-blue-500';
        case 'planned': return 'bg-yellow-500';
        case 'completed': return 'bg-gray-500';
        default: return 'bg-gray-400';
    }
};

export const getStatusLabel = (status: string) => {
    return getStatusLabelI18n(status);
};
