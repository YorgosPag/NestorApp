"use client";

import { NAVIGATION_ENTITIES } from '@/components/navigation/config';
import { useIconSizes } from '@/hooks/useIconSizes';

// 🏢 ENTERPRISE: Centralized Unit Icon & Color
const UnitIcon = NAVIGATION_ENTITIES.unit.icon;
const unitColor = NAVIGATION_ENTITIES.unit.color;

export function PropertyListEmptyState() {
    const iconSizes = useIconSizes();
    return (
        <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4">
            <UnitIcon className={`${iconSizes.xl} ${unitColor} mb-2`} />
            <p className="text-sm">Δεν βρέθηκαν ακίνητα</p>
            <p className="text-xs">Δοκιμάστε να αλλάξετε τα φίλτρα</p>
        </div>
    );
}
