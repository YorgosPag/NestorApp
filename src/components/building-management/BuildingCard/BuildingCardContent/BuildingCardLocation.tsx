'use client';

import React from 'react';
import { MapPin } from "lucide-react";
import { cn } from '@/lib/utils';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import '@/lib/design-system';

interface BuildingCardLocationProps {
  address?: string;
  city?: string;
}

export function BuildingCardLocation({ address, city }: BuildingCardLocationProps) {
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  if (!address) return null;

  return (
    <div className={cn("flex items-center gap-2 text-sm", colors.text.muted)}>
      <MapPin className={`${iconSizes.sm} shrink-0`} />
      <span className="truncate">{address}, {city}</span>
    </div>
  );
}
