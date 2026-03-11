'use client';

/**
 * @fileoverview Shared InfoRow component for detail panels
 * @description Displays a label-value pair with an icon — SSoT for all sales detail panels
 * @pattern Used by SaleInfoContent, StorageDetailPanel, ParkingDetailPanel
 */

import React from 'react';
import { useIconSizes } from '@/hooks/useIconSizes';

interface InfoRowProps {
  icon: React.ElementType;
  iconColor?: string;
  label: string;
  value: string;
  valueColor?: string;
}

export function InfoRow({
  icon: Icon,
  iconColor = 'text-muted-foreground',
  label,
  value,
  valueColor,
}: InfoRowProps) {
  const iconSizes = useIconSizes();

  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className={`${iconSizes.sm} ${iconColor} flex-shrink-0`} />
        {label}
      </span>
      <span className={`text-sm font-medium ${valueColor ?? 'text-foreground'}`}>
        {value}
      </span>
    </div>
  );
}
