'use client';

import type { ProjectStatus } from '@/types/project';
import { ENHANCED_STATUS_LABELS as PROPERTY_STATUS_LABELS, ENHANCED_STATUS_COLORS as PROPERTY_STATUS_COLORS } from '@/constants/property-statuses-enterprise';
import { getDaysUntilCompletion as getDaysUntilCompletionI18n } from '@/lib/intl-utils';
import { brandClasses } from '@/styles/design-tokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { hardcodedColorValues } from '@/design-system/tokens/colors';
import { COLOR_BRIDGE } from '@/design-system/color-bridge';
// 🏢 ENTERPRISE: i18n support for project status labels
import i18n from '@/i18n/config';

export const getProgressColor = (progress: number) => {
    if (progress < 25) return COLOR_BRIDGE.text.error;      // ✅ SEMANTIC: text-red-500 -> error
    if (progress < 50) return COLOR_BRIDGE.text.warning;    // ✅ SEMANTIC: text-yellow-500 -> warning
    if (progress >= 75) return COLOR_BRIDGE.text.success;   // ✅ SEMANTIC: text-green-500 -> success
    return brandClasses.primary.text;
};

// ✅ ENTERPRISE MIGRATION: Re-export centralized getDaysUntilCompletion
export const getDaysUntilCompletion = (completionDate?: string) => {
    return getDaysUntilCompletionI18n(completionDate);
};

// 🎯 ΚΕΝΤΡΙΚΟΠΟΙΗΜΕΝΟ: Χρησιμοποιούμε τα centralized constants αντί για διάσπαρτα
// ✅ MIGRATED: Property statuses τώρα στο /constants/property-statuses-enterprise.ts
// 🔄 BACKWARD COMPATIBILITY: Project statuses only (non-property)

// 🏢 Enterprise Status Colors Function με Semantic Color System
export const getProjectStatusColors = (colors?: ReturnType<typeof useSemanticColors>): Record<string, string> => {
    if (!colors) {
        // ✅ ENTERPRISE: Enterprise fallback για non-React contexts με semantic colors
        return {
            'planning': `${COLOR_BRIDGE.bg.warning} ${COLOR_BRIDGE.text.warning}`,        // ✅ SEMANTIC: yellow -> warning
            'in_progress': brandClasses.primary.badge,
            'completed': `${COLOR_BRIDGE.bg.success} ${COLOR_BRIDGE.text.success}`,      // ✅ SEMANTIC: green -> success
            'on_hold': `${hardcodedColorValues.background.gray[100]} text-slate-800`,
            'cancelled': `${COLOR_BRIDGE.bg.error} ${COLOR_BRIDGE.text.error}`,          // ✅ SEMANTIC: red -> error
            'default': `${hardcodedColorValues.background.gray[100]} text-slate-800`,
            'for-sale': `${COLOR_BRIDGE.bg.success} ${COLOR_BRIDGE.text.success}`,      // ✅ SEMANTIC: green -> success
            'sold': `${COLOR_BRIDGE.bg.error} ${COLOR_BRIDGE.text.error}`,              // ✅ SEMANTIC: red -> error
            'for-rent': brandClasses.primary.badge,
            'rented': `${COLOR_BRIDGE.bg.warning} ${COLOR_BRIDGE.text.warning}`,        // ✅ SEMANTIC: orange -> warning
        };
    }

    return {
        // Project-specific statuses με semantic colors
        'planning': `${colors.bg.warningSubtle} ${colors.text.warning}`,
        'in_progress': brandClasses.primary.badge, // Keep brand consistency
        'completed': `${colors.bg.successSubtle} ${colors.text.success}`,
        'on_hold': `${colors.bg.muted} ${colors.text.muted}`,
        'cancelled': `${colors.bg.errorSubtle} ${colors.text.error}`,
        'default': `${colors.bg.muted} ${colors.text.muted}`,

        // 🎯 ΚΕΝΤΡΙΚΟΠΟΙΗΜΕΝΑ: Property statuses με semantic colors
        'for-sale': `${colors.bg.successSubtle} ${colors.text.success}`,
        'sold': `${colors.bg.errorSubtle} ${colors.text.error}`,
        'for-rent': brandClasses.primary.badge, // Keep brand consistency
        'rented': `${colors.bg.warningSubtle} ${colors.text.warning}`,
    };
};

// Legacy export για backward compatibility
export const STATUS_COLORS: Record<string, string> = getProjectStatusColors();

// 🏢 ENTERPRISE: i18n-enabled project status label getter
const getProjectStatusLabel = (status: string): string => {
    // Map underscore format to camelCase for i18n keys
    const keyMap: Record<string, string> = {
        'planning': 'planning',
        'in_progress': 'inProgress',
        'completed': 'completed',
        'on_hold': 'onHold',
        'cancelled': 'cancelled',
        'default': 'unknown'
    };
    const key = keyMap[status];
    if (key === 'unknown') {
        return i18n.t('status.unknown', { ns: 'common' });
    }
    return key ? i18n.t(`status.${key}`, { ns: 'projects' }) : status;
};

// 🏢 ENTERPRISE: Dynamic STATUS_LABELS with i18n support
export const STATUS_LABELS: Record<string, string> = {
    // Project-specific statuses (non-property) - i18n enabled
    get 'planning'() { return getProjectStatusLabel('planning'); },
    get 'in_progress'() { return getProjectStatusLabel('in_progress'); },
    get 'completed'() { return getProjectStatusLabel('completed'); },
    get 'on_hold'() { return getProjectStatusLabel('on_hold'); },
    get 'cancelled'() { return getProjectStatusLabel('cancelled'); },
    get 'default'() { return getProjectStatusLabel('default'); },

    // 🎯 ΚΕΝΤΡΙΚΟΠΟΙΗΜΕΝΑ: Property statuses από centralized constants
    'for-sale': PROPERTY_STATUS_LABELS['for-sale'],
    'sold': PROPERTY_STATUS_LABELS['sold'],
    'for-rent': PROPERTY_STATUS_LABELS['for-rent'],
    'rented': PROPERTY_STATUS_LABELS['rented'],
    'reserved': PROPERTY_STATUS_LABELS['reserved'],
    'landowner': PROPERTY_STATUS_LABELS['landowner'],
};

export const getStatusColor = (status?: string) => {
    return STATUS_COLORS[status || 'default'];
};
  
export const getStatusLabel = (status?: string) => {
    return STATUS_LABELS[status || 'default'];
};

export const getProjectLabel = (status?: string): string => {
    return STATUS_LABELS[status as ProjectStatus] ?? (status || '—');
}
