'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { Star } from 'lucide-react';

interface BuildingHeaderProgressProps {
    isFavorite: boolean;
    progress: number;
    status: string;
    getStatusColor: (status: string) => string;
}

export function BuildingHeaderProgress({ isFavorite, progress, status, getStatusColor }: BuildingHeaderProgressProps) {
    return (
        <>
            {isFavorite && (
                <Star className="w-5 h-5 text-yellow-500 fill-yellow-500 filter drop-shadow-sm" />
            )}
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
                <div 
                    className={cn("h-full transition-all duration-500", getStatusColor(status).replace('text-', 'bg-'))}
                    style={{ width: `${progress}%` }}
                />
            </div>
        </>
    );
}
