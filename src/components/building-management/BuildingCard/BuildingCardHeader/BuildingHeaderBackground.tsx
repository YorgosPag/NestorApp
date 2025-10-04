'use client';

import React from 'react';

export function BuildingHeaderBackground() {
    return (
        <div className="absolute inset-0 opacity-20">
            <div className="absolute top-4 left-4 w-8 h-8 bg-white/30 rounded-full"></div>
            <div className="absolute top-8 right-8 w-6 h-6 bg-white/20 rounded-full"></div>
            <div className="absolute bottom-6 left-8 w-4 h-4 bg-white/40 rounded-full"></div>
            <div className="absolute bottom-8 right-4 w-10 h-10 bg-white/20 rounded-full"></div>
        </div>
    );
}
