'use client';
import React from 'react';
import { GeneralProjectTab as GeneralTab } from './general-tab';

// Named export που χρειάζεται το project-details.tsx
export function GeneralProjectTab(props: any) {
    return <GeneralTab {...props} />
}

// Υπάρχων wrapper - διατηρείται για backward compatibility
export function GeneralProjectTabWrapper(props: any) {
    return <GeneralProjectTab {...props} />
}
