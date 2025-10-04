
'use client';

import React from 'react';

interface SelectedStripeProps {
    isSelected: boolean;
}

export function SelectedStripe({ isSelected }: SelectedStripeProps) {
    if (!isSelected) return null;
    return <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500 rounded-l-md" />;
}
