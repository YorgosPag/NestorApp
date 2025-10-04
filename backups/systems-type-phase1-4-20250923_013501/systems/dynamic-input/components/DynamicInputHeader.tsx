'use client';

import React from 'react';

interface DynamicInputHeaderProps {
  activeTool: string;
}

export function DynamicInputHeader({ activeTool }: DynamicInputHeaderProps) {
  return (
    <div className="text-xs text-gray-300 mb-2">
      Δυναμική Εισαγωγή ({activeTool})
    </div>
  );
}