'use client';

import { useState } from 'react';

export function usePropertyViewer() {
    const [selectedProperty, setSelectedProperty] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<'list' | 'grid' | 'map'>('list');
    
    return {
        selectedProperty,
        setSelectedProperty,
        viewMode,
        setViewMode,
        // Placeholder state
        properties: [],
        loading: false,
        error: null,
    };
}

// Stub for backward compatibility
export const usePropertyState = usePropertyViewer;
