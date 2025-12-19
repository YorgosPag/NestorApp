"use client";

import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

interface HeaderBarProps {
  sectionsCount: number;
  readOnly: boolean;
  onAddSection: () => void;
}

export function HeaderBar({ sectionsCount, readOnly, onAddSection }: HeaderBarProps) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h3 className="font-semibold text-lg">Δομή Εγγράφου</h3>
        <p className="text-sm text-gray-600">
          {sectionsCount} {sectionsCount === 1 ? 'ενότητα' : 'ενότητες'}
        </p>
      </div>
      {!readOnly && (
        <div className="flex items-center gap-2">
          <Button onClick={onAddSection} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Νέα Ενότητα
          </Button>
        </div>
      )}
    </div>
  );
}
