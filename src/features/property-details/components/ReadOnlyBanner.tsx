'use client';
import { Eye } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { CommonBadge } from '@/core/badges';

export function ReadOnlyBanner() {
  const iconSizes = useIconSizes();
  return (
    <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-md">
      <Eye className={`${iconSizes.sm} text-muted-foreground`} />
      <span className="text-xs text-muted-foreground">Μόνο Προβολή</span>
      <CommonBadge
        status="property"
        customLabel="Δημόσια Προβολή"
        variant="outline"
        className="text-xs ml-auto"
      />
    </div>
  );
}
