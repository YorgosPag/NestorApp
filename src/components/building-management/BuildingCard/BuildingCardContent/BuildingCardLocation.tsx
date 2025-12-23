'use client';

import React from 'react';
import { MapPin } from "lucide-react";
import { useIconSizes } from '@/hooks/useIconSizes';

interface BuildingCardLocationProps {
  address?: string;
  city?: string;
}

export function BuildingCardLocation({ address, city }: BuildingCardLocationProps) {
  const iconSizes = useIconSizes();
  if (!address) return null;

  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <MapPin className={`${iconSizes.sm} shrink-0`} />
      <span className="truncate">{address}, {city}</span>
    </div>
  );
}
