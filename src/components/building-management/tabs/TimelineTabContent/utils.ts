
'use client';

import { Rocket, Zap, Palette, Target, ClipboardList } from 'lucide-react';
// 🏢 ENTERPRISE: Using centralized entity config for Building icon
import { NAVIGATION_ENTITIES } from '@/components/navigation/config/navigation-entities';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

// 🏢 ENTERPRISE: Type for translate function (from useTranslation hook)
type TranslateFunction = (key: string) => string;

// 🏢 ENTERPRISE: Milestone data structure (without hardcoded strings)
interface MilestoneData {
    id: number;
    titleKey: string;
    descriptionKey: string;
    date: string;
    status: string;
    progress: number;
    type: string;
}

// 🏢 ENTERPRISE: Raw milestone data with translation keys
const milestonesData: MilestoneData[] = [
    { id: 1, titleKey: 'projectStart', descriptionKey: 'projectStartDesc', date: "2006-05-02", status: "completed", progress: 100, type: "start" },
    { id: 2, titleKey: 'foundation', descriptionKey: 'foundationDesc', date: "2006-08-15", status: "completed", progress: 100, type: "construction" },
    { id: 3, titleKey: 'structure', descriptionKey: 'structureDesc', date: "2007-12-20", status: "completed", progress: 100, type: "construction" },
    { id: 4, titleKey: 'walls', descriptionKey: 'wallsDesc', date: "2008-06-30", status: "completed", progress: 100, type: "construction" },
    { id: 5, titleKey: 'systems', descriptionKey: 'systemsDesc', date: "2008-11-15", status: "in-progress", progress: 85, type: "systems" },
    { id: 6, titleKey: 'finishing', descriptionKey: 'finishingDesc', date: "2009-01-30", status: "pending", progress: 45, type: "finishing" },
    { id: 7, titleKey: 'delivery', descriptionKey: 'deliveryDesc', date: "2009-02-28", status: "pending", progress: 0, type: "delivery" }
];

// 🏢 ENTERPRISE: Get milestones with i18n support
export const getMilestones = (t: TranslateFunction) => {
    return milestonesData.map(m => ({
        id: m.id,
        title: t(`tabs.timeline.milestones.${m.titleKey}`),
        description: t(`tabs.timeline.milestones.${m.descriptionKey}`),
        date: m.date,
        status: m.status,
        progress: m.progress,
        type: m.type
    }));
};

// 🏢 ENTERPRISE: Legacy export for backward compatibility (DEPRECATED)
export const milestones = milestonesData.map(m => ({
    id: m.id,
    title: m.titleKey, // Will show key if not using getMilestones()
    description: m.descriptionKey,
    date: m.date,
    status: m.status,
    progress: m.progress,
    type: m.type
}));

export const getStatusColor = (status: string) => {
    const colors = useSemanticColors();

    switch (status) {
        case 'completed': return `${colors.status.success.bg} ${colors.status.success.border}`;
        case 'in-progress': return `${colors.status.info.bg} ${colors.status.info.border}`;
        case 'pending': return `${colors.status.muted.bg} ${colors.status.muted.border}`;
        case 'delayed': return `${colors.status.error.bg} ${colors.status.error.border}`;
        default: return `${colors.status.muted.bg} ${colors.status.muted.border}`;
    }
};

// 🏢 ENTERPRISE: i18n-enabled status text function
export const getStatusText = (status: string, t?: TranslateFunction) => {
    // Use translation function if provided
    if (t) {
        const statusMap: Record<string, string> = {
            'completed': 'tabs.timeline.status.completed',
            'in-progress': 'tabs.timeline.status.inProgress',
            'pending': 'tabs.timeline.status.pending',
            'delayed': 'tabs.timeline.status.delayed'
        };
        const key = statusMap[status] || 'tabs.timeline.status.unknown';
        return t(key);
    }
    // Fallback to hardcoded values (backward compatibility)
    switch (status) {
        case 'completed': return 'Ολοκληρώθηκε';
        case 'in-progress': return 'Σε εξέλιξη';
        case 'pending': return 'Εκκρεμεί';
        case 'delayed': return 'Καθυστέρηση';
        default: return 'Άγνωστο';
    }
};

export const getTypeIcon = (type: string) => {
    switch (type) {
        case 'start': return Rocket;
        case 'construction': return NAVIGATION_ENTITIES.building.icon;
        case 'systems': return Zap;
        case 'finishing': return Palette;
        case 'delivery': return Target;
        default: return ClipboardList;
    }
};
