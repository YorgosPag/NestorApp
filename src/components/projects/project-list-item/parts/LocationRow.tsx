
'use client';

import React from 'react';
import { MapPin } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';

interface LocationRowProps {
    address?: string;
    city?: string;
}

export function LocationRow({ address, city }: LocationRowProps) {
    const iconSizes = useIconSizes();
    if (!address) return null;

    return (
        <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
            <MapPin className={iconSizes.xs} />
            <span className="truncate">{address}, {city}</span>
        </div>
    );
}
