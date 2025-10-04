'use client';

import React from 'react';
import { MapPin } from "lucide-react";

interface BuildingCardLocationProps {
  address?: string;
  city?: string;
}

export function BuildingCardLocation({ address, city }: BuildingCardLocationProps) {
  if (!address) return null;

  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <MapPin className="w-4 h-4 shrink-0" />
      <span className="truncate">{address}, {city}</span>
    </div>
  );
}
