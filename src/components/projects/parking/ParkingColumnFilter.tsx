'use client';

import React from 'react';
import { Input } from '@/components/ui/input';
import { parkingComponentsStyles } from './ParkingComponents.styles';
import { useTypography } from '@/hooks/useTypography';
import '@/lib/design-system';

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
  const typography = useTypography();
  return (
    <div style={parkingComponentsStyles.columns.filter(width)}>
      <Input
        type="text"
        placeholder="..."
        className={`h-7 ${typography.body.xs} rounded-sm border-0 focus-visible:ring-1 focus-visible:ring-primary`}
        value={value}
        onChange={(e) => onFilterChange(column.key, e.target.value)}
      />
    </div>
  );
}
