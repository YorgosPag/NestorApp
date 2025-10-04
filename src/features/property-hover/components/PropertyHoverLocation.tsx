'use client';
import { MapPin } from 'lucide-react';

export function PropertyHoverLocation({ floorLabel }:{ floorLabel: string }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 text-xs">
        <MapPin className="h-3 w-3 text-muted-foreground" />
        <span>{floorLabel}</span>
      </div>
    </div>
  );
}
