'use client';

/**
 * @fileoverview Shared InfoRow component for detail panels
 * @description Displays a label-value pair with an icon — SSoT for all sales detail panels
 * @pattern Used by SaleInfoContent, StorageDetailPanel, ParkingDetailPanel
 */

import React from 'react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { COLOR_BRIDGE } from '@/design-system/color-bridge';
import '@/lib/design-system';

interface InfoRowProps {
  icon: React.ElementType;
  iconColor?: string;
  label: string;
  value: string;
  valueColor?: string;
}

export function InfoRow({
  icon: Icon,
  iconColor = COLOR_BRIDGE.text.muted,
  label,
  value,
  valueColor,
}: InfoRowProps) {
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();

  return (
    <div className="flex items-center justify-between py-1.5">
      <span className={cn("flex items-center gap-2 text-sm", colors.text.muted)}>
        <Icon className={`${iconSizes.sm} ${iconColor} flex-shrink-0`} />
        {label}
      </span>
      <span className={`text-sm font-medium ${valueColor ?? 'text-foreground'}`}>
        {value}
      </span>
    </div>
  );
}
