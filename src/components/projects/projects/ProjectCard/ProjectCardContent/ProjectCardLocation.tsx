'use client';

import React from 'react';
import { MapPin } from "lucide-react";

interface ProjectCardLocationProps {
  address?: string;
  city?: string;
}

export function ProjectCardLocation({ address, city }: ProjectCardLocationProps) {
  if (!address) return null;

  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <MapPin className="w-4 h-4 shrink-0" />
      <span className="truncate">{address}, {city}</span>
    </div>
  );
}
