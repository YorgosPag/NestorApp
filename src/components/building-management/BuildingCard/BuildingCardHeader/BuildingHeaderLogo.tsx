'use client';

import React from 'react';

interface BuildingHeaderLogoProps {
    category: string;
    getCategoryIcon: (category: string) => React.ElementType;
}

export function BuildingHeaderLogo({ category, getCategoryIcon }: BuildingHeaderLogoProps) {
    const CategoryIcon = getCategoryIcon(category);
    return (
        <div className="absolute top-4 left-4 z-10">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/90 shadow-lg backdrop-blur-sm">
                <CategoryIcon className="w-6 h-6 text-primary" />
            </div>
        </div>
    );
}
