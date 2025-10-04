'use client';

import React from 'react';

export function useEnterFormNavigation(ref: React.RefObject<HTMLElement | null>) {
    return (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key !== 'Enter') return;
        
        // Guard against running on server or if ref is not set
        if (typeof window === 'undefined' || !ref.current) return;
        
        e.preventDefault();

        const focusable = Array.from(
            ref.current.querySelectorAll(
                'input:not([readonly])'
            )
        ) as HTMLElement[];

        const currentIndex = focusable.indexOf(e.currentTarget as HTMLElement);
        const nextIndex = (currentIndex + 1) % focusable.length;
        
        if (nextIndex < focusable.length) {
            focusable[nextIndex].focus();
        }
    };
}
