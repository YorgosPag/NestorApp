'use client';
import { MapPin } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import '@/lib/design-system';

export function PropertyHoverLocation({ floorLabel }:{ floorLabel: string }) {
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 text-xs">
        <MapPin className={`${iconSizes.xs} ${colors.text.muted}`} />
        <span>{floorLabel}</span>
      </div>
    </div>
  );
}
