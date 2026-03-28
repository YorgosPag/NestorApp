
'use client';

import React from 'react';
import { MapPin } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTypography } from '@/hooks/useTypography';
import { cn } from '@/lib/utils';
import '@/lib/design-system';

interface LocationRowProps {
    address?: string;
    city?: string;
}

export function LocationRow({ address, city }: LocationRowProps) {
    const iconSizes = useIconSizes();
    const typography = useTypography();
    if (!address) return null;

    return (
        <div className={cn("flex items-center gap-1 mb-1", typography.special.tertiary)}>
            <MapPin className={iconSizes.xs} />
            <span className="truncate">{address}, {city}</span>
        </div>
    );
}
