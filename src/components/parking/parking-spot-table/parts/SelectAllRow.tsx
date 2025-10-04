'use client';

import React from 'react';
import { Checkbox } from '@/components/ui/checkbox';

interface SelectAllRowProps {
  width: number;
  allSelected: boolean;
  isIndeterminate: boolean;
  onToggle: () => void;
}

export function SelectAllRow({ width, allSelected, isIndeterminate, onToggle }: SelectAllRowProps) {
  return (
    <div className="flex items-center border-b px-2 py-1.5 h-10 bg-muted/30">
      <div style={{ flex: `0 0 ${width}px` }} className="flex items-center justify-center px-2">
        <Checkbox
          checked={allSelected}
          onCheckedChange={onToggle}
          aria-label="Select all rows"
          data-state={isIndeterminate ? 'indeterminate' : (allSelected ? 'checked' : 'unchecked')}
        />
      </div>
    </div>
  );
}
