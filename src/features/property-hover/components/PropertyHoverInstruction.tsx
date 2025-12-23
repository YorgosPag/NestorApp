'use client';
import { MousePointer } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
export function PropertyHoverInstruction() {
  const iconSizes = useIconSizes();
  return (
    <div className="flex items-center gap-1 text-xs text-muted-foreground">
      <MousePointer className={iconSizes.xs} />
      <span>Κάντε κλικ για περισσότερες πληροφορίες</span>
    </div>
  );
}
