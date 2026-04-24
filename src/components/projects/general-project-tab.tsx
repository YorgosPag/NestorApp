'use client';
import React from 'react';
import { GeneralProjectTab as GeneralTab, type GeneralProjectTabProps } from './general-tab';

// Named export που χρειάζεται το project-details.tsx
export function GeneralProjectTab(props: GeneralProjectTabProps) {
    return <GeneralTab {...props} />
}

