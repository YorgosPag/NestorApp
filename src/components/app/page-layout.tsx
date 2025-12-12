'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface PageLayoutProps {
    children: React.ReactNode;
    className?: string;
}

export function PageLayout({ children, className }: PageLayoutProps) {
    return (
        <main className={cn("h-full", className)}>
            {children}
        </main>
    );
}
