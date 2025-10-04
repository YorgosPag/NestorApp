
'use client';

import React from 'react';
import { MapPin } from 'lucide-react';

interface LocationRowProps {
    address?: string;
    city?: string;
}

export function LocationRow({ address, city }: LocationRowProps) {
    if (!address) return null;

    return (
        <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
            <MapPin className="w-3 h-3" />
            <span className="truncate">{address}, {city}</span>
        </div>
    );
}
