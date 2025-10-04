'use client';

import { cn } from '@/lib/utils';

interface StorageCardOverlayProps {
    isHovered: boolean;
}

export function StorageCardOverlay({ isHovered }: StorageCardOverlayProps) {
    return (
        <div className={cn(
            "absolute inset-0 bg-gradient-to-t from-primary/10 to-transparent pointer-events-none transition-opacity duration-300",
            isHovered ? "opacity-100" : "opacity-0"
        )} />
    );
}
