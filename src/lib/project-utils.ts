'use client';

import type { ProjectStatus } from '@/types/project';
import { ENHANCED_STATUS_LABELS as PROPERTY_STATUS_LABELS, ENHANCED_STATUS_COLORS as PROPERTY_STATUS_COLORS } from '@/constants/property-statuses-enterprise';
import { getDaysUntilCompletion as getDaysUntilCompletionI18n } from '@/lib/intl-utils';
import { brandClasses } from '@/styles/design-tokens';

// ⚠️ DEPRECATED: Use formatCurrency from intl-utils.ts for enterprise currency formatting
// 🔄 BACKWARD COMPATIBILITY: This function is maintained for legacy support
// 📍 MIGRATION: import { formatCurrency } from '@/lib/intl-utils'
export const formatCurrency = (amount: number) => {
    // Re-export centralized function for backward compatibility
    const { formatCurrency: centralizedFormatter } = require('./intl-utils');
    return centralizedFormatter(amount, 'EUR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
};

// ✅ ENTERPRISE MIGRATION COMPLETE: formatDate fully migrated to intl-utils.ts
// All imports have been updated to use @/lib/intl-utils

export const getProgressColor = (progress: number) => {
    if (progress < 25) return 'text-red-500';
    if (progress < 50) return 'text-yellow-500';
    if (progress >= 75) return 'text-green-500';
    return brandClasses.primary.text;
};

// ✅ ENTERPRISE MIGRATION: Using centralized getDaysUntilCompletion
export const getDaysUntilCompletion = (completionDate?: string) => {
    return getDaysUntilCompletionI18n(completionDate);
};

// 🎯 ΚΕΝΤΡΙΚΟΠΟΙΗΜΕΝΟ: Χρησιμοποιούμε τα centralized constants αντί για διάσπαρτα
// ✅ MIGRATED: Property statuses τώρα στο /constants/property-statuses-enterprise.ts
// 🔄 BACKWARD COMPATIBILITY: Project statuses only (non-property)

export const STATUS_COLORS: Record<string, string> = {
    // Project-specific statuses (non-property)
    'planning': 'bg-yellow-100 text-yellow-800',
    'in_progress': brandClasses.primary.badge,
    'completed': 'bg-green-100 text-green-800',
    'on_hold': 'bg-gray-100 text-gray-800',
    'cancelled': 'bg-red-100 text-red-800',
    'default': 'bg-gray-100 text-gray-800',

    // 🎯 ΚΕΝΤΡΙΚΟΠΟΙΗΜΕΝΑ: Property statuses από centralized constants
    'for-sale': 'bg-green-100 text-green-800',     // Uses centralized logic
    'sold': 'bg-red-100 text-red-800',             // Uses centralized logic
    'for-rent': brandClasses.primary.badge,       // ✅ CENTRALIZED: brandClasses.primary.badge
    'rented': 'bg-orange-100 text-orange-800',     // Uses centralized logic
    'reserved': 'bg-yellow-100 text-yellow-800',   // Uses centralized logic
};

export const STATUS_LABELS: Record<string, string> = {
    // Project-specific statuses (non-property)
    'planning': 'Σχεδιασμός',
    'in_progress': 'Σε εξέλιξη',
    'completed': 'Ολοκληρωμένο',
    'on_hold': 'Σε αναμονή',
    'cancelled': 'Ακυρωμένο',
    'default': 'Άγνωστο',

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
