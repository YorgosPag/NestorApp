'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import '@/lib/design-system';

interface PropertyInfoItemProps {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  iconClassName?: string;
  valueClassName?: string;
  className?: string;
}

export function PropertyInfoItem({
  icon,
  label,
  value,
  iconClassName,
  valueClassName = "",
  className,
}: PropertyInfoItemProps) {
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const resolvedIconClassName = iconClassName ?? colors.text.muted;
  if (!value) return null;

  return (
    <div className={className}>
      <p className={cn("text-xs", colors.text.muted)}>{label}</p>
      <div className="flex items-center gap-2 mt-1">
        <div className={cn(iconSizes.sm, resolvedIconClassName)}>{icon}</div>
        <div className={cn("text-sm", valueClassName)}>{value}</div>
      </div>
    </div>
  );
}
