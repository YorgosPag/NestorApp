'use client';

import { Users } from 'lucide-react';
// 🏢 ENTERPRISE: Using centralized entity config for Building & Unit icons
import { NAVIGATION_ENTITIES } from '@/components/navigation/config/navigation-entities';

// 🏢 ENTERPRISE: Centralized Property Icon
const PropertyIcon = NAVIGATION_ENTITIES.property.icon;

// 🏢 ENTERPRISE: Dead exports REMOVED 2026-04-18 (ADR-314 Phase B)
// - formatFloorLabel re-export → import from '@/lib/intl-utils'
// - getCategoryLabel/getStatusLabel/getDaysUntilCompletion wrappers → '@/lib/intl-utils' or '@/lib/status-helpers'
// - formatPricePerSqm/getProgressColor → were dead (zero callers)
// - getStatusColor → '@/lib/status-helpers' getStatusColor('buildingProject', ...)

// 🏢 ENTERPRISE: Centralized Category Icons - ZERO HARDCODED VALUES
export const getCategoryIcon = (category: string) => {
    switch (category) {
        case 'residential': return PropertyIcon;
        case 'commercial': return NAVIGATION_ENTITIES.building.icon;
        case 'mixed': return Users;
        case 'industrial': return NAVIGATION_ENTITIES.building.icon;
        default: return NAVIGATION_ENTITIES.building.icon;
    }
};
