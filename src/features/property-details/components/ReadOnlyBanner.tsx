'use client';
import { Eye } from 'lucide-react';
import { CommonBadge } from '@/core/badges';

export function ReadOnlyBanner() {
  return (
    <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-md">
      <Eye className="w-4 h-4 text-muted-foreground" />
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
