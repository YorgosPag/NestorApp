'use client';

import React from 'react';
import { Input } from '@/components/ui/input';

interface ParkingColumnFilterProps {
  column: { key: string };
  width: number;
  value: string;
  onFilterChange: (columnKey: string, value: string) => void;
}

export function ParkingColumnFilter({
  column,
  width,
  value,
  onFilterChange
}: ParkingColumnFilterProps) {
  return (
    <div style={{ width: `${width}px`}}>
      <Input
        type="text"
        placeholder="..."
        className="h-7 text-xs rounded-sm border-0 focus-visible:ring-1 focus-visible:ring-primary"
        value={value}
        onChange={(e) => onFilterChange(column.key, e.target.value)}
      />
    </div>
  );
}
