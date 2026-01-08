'use client';

import React from 'react';
// 🏢 ENTERPRISE: Using centralized entity config for Building icon
import { NAVIGATION_ENTITIES } from '@/components/navigation/config/navigation-entities';
import { cn } from '@/lib/utils';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';

export function EmptyState() {
    const iconSizes = useIconSizes();
    const { quick } = useBorderTokens();
    return (
        <div className={`flex-1 flex flex-col items-center justify-center bg-card ${quick.card} min-w-0 shadow-sm text-center p-8`}>
            <NAVIGATION_ENTITIES.building.icon className={cn(iconSizes.xl2, NAVIGATION_ENTITIES.building.color, 'mb-4')} />
            <h2 className="text-xl font-semibold text-foreground">Επιλέξτε ένα κτίριο</h2>
            <p className="text-muted-foreground">Επιλέξτε ένα κτίριο από τη λίστα για να δείτε τις λεπτομέρειές του.</p>
        </div>
    );
}
