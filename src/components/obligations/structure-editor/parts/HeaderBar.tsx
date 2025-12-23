"use client";

import { Button } from '@/components/ui/button';
import { useIconSizes } from '@/hooks/useIconSizes';
import { Plus } from 'lucide-react';

interface HeaderBarProps {
  sectionsCount: number;
  readOnly: boolean;
  onAddSection: () => void;
}

export function HeaderBar({ sectionsCount, readOnly, onAddSection }: HeaderBarProps) {
  const iconSizes = useIconSizes();

  return (
    <div className="flex items-center justify-between">
      <div>
        <h3 className="font-semibold text-lg">Δομή Εγγράφου</h3>
        <p className="text-sm text-muted-foreground">
          {sectionsCount} {sectionsCount === 1 ? 'ενότητα' : 'ενότητες'}
        </p>
      </div>
      {!readOnly && (
        <div className="flex items-center gap-2">
          <Button onClick={onAddSection} className="flex items-center gap-2">
            <Plus className={iconSizes.sm} />
            Νέα Ενότητα
          </Button>
        </div>
      )}
    </div>
  );
}
