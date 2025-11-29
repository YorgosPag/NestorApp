
'use client';

import React from 'react';
import { ThemeProgressBar } from '@/core/progress/ThemeProgressBar';

interface ProgressBlockProps {
    progress: number;
}

export function ProgressBlock({ progress }: ProgressBlockProps) {
    return (
        <ThemeProgressBar
            progress={progress}
            label="Πρόοδος"
            size="md"
            showPercentage={true}
        />
    );
}
