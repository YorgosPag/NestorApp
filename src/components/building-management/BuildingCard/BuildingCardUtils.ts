'use client';

import { Users } from 'lucide-react';
// 🏢 ENTERPRISE: Using centralized entity config for Building & Unit icons
import { NAVIGATION_ENTITIES } from '@/components/navigation/config/navigation-entities';

// 🏢 ENTERPRISE: Centralized Unit Icon
const UnitIcon = NAVIGATION_ENTITIES.unit.icon;
import { formatFloorLabel, getCategoryLabel as getCategoryLabelI18n, getStatusLabel as getStatusLabelI18n, getPricePerSqmUnit, formatNumber, getDaysUntilCompletion as getDaysUntilCompletionI18n } from '@/lib/intl-utils';
import { brandClasses } from '@/styles/design-tokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

// ✅ CENTRALIZED: Re-export from intl-utils for backward compatibility
export { formatFloorLabel };

// 🏢 ENTERPRISE: Wrapper exports using centralized intl-utils
export const getCategoryLabel = getCategoryLabelI18n;
export const getStatusLabel = getStatusLabelI18n;
export const getDaysUntilCompletion = getDaysUntilCompletionI18n;

export const formatPricePerSqm = (price?: number, area?: number): string => {
    if (!price || !area || area === 0) return '-';
    const value = Math.round(price / area);
    return formatNumber(value) + getPricePerSqmUnit();
};

export const getProgressColor = (progress: number) => {
    if (progress < 25) return 'text-red-500';
    if (progress < 50) return 'text-yellow-500';
    if (progress < 75) return brandClasses.primary.text;
    return 'text-green-500';
};

// 🏢 ENTERPRISE: Centralized Category Icons - ZERO HARDCODED VALUES
export const getCategoryIcon = (category: string) => {
    switch (category) {
        case 'residential': return UnitIcon;
        case 'commercial': return NAVIGATION_ENTITIES.building.icon;
        case 'mixed': return Users;
        case 'industrial': return NAVIGATION_ENTITIES.building.icon;
        default: return NAVIGATION_ENTITIES.building.icon;
    }
};


export const getStatusColor = (status: string, colors?: ReturnType<typeof useSemanticColors>) => {
    if (!colors) {
        // Fallback for cases where colors hook is not available
        switch (status) {
            case 'active': return 'bg-green-500';
            case 'construction': return brandClasses.primary.bgDark;
            case 'planned': return 'bg-yellow-500';
            case 'completed': return 'bg-slate-600';
            default: return 'bg-slate-500';
        }
    }

    switch (status) {
        case 'active': return colors.bg.success;
        case 'construction': return brandClasses.primary.bgDark;
        case 'planned': return colors.bg.warning;
        case 'completed': return colors.bg.muted;
        default: return colors.bg.mutedLight;
    }
};

