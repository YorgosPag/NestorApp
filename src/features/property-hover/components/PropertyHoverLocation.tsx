'use client';
import { MapPin } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';

export function PropertyHoverLocation({ floorLabel }:{ floorLabel: string }) {
  const iconSizes = useIconSizes();
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 text-xs">
        <MapPin className={`${iconSizes.xs} text-muted-foreground`} />
        <span>{floorLabel}</span>
      </div>
    </div>
  );
}
