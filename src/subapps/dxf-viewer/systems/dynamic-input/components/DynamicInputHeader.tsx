'use client';

import React from 'react';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

interface DynamicInputHeaderProps {
  activeTool: string;
}

export function DynamicInputHeader({ activeTool }: DynamicInputHeaderProps) {
  const colors = useSemanticColors();
  return (
    <div className={`text-xs ${colors.text.secondary} mb-2`}>
      Δυναμική Εισαγωγή ({activeTool})
    </div>
  );
}