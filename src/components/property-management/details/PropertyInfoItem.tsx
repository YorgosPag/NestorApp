'use client';

import React from 'react';
import { cn } from '@/lib/utils';

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
  iconClassName = "text-muted-foreground",
  valueClassName = "",
  className,
}: PropertyInfoItemProps) {
  if (!value) return null;

  return (
    <div className={className}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="flex items-center gap-2 mt-1">
        <div className={cn("h-4 w-4", iconClassName)}>{icon}</div>
        <div className={cn("text-sm", valueClassName)}>{value}</div>
      </div>
    </div>
  );
}
