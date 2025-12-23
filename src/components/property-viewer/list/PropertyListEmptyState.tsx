"use client";

import { Home } from "lucide-react";
import { useIconSizes } from '@/hooks/useIconSizes';

export function PropertyListEmptyState() {
    const iconSizes = useIconSizes();
    return (
        <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4">
            <Home className={`${iconSizes.xl} mb-2`} />
            <p className="text-sm">Δεν βρέθηκαν ακίνητα</p>
            <p className="text-xs">Δοκιμάστε να αλλάξετε τα φίλτρα</p>
        </div>
    );
}
