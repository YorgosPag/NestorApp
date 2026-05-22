'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { X, Package, Car } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { cn } from '@/lib/utils';
import type { StorageType } from '@/types/storage';
import '@/lib/design-system';

interface StorageFormHeaderProps {
  formType: StorageType;
  building: { name: string; project: string };
  formTitle: string;
  onCancel: () => void;
}

export function StorageFormHeader({
  formType,
  building,
  formTitle,
  onCancel,
}: StorageFormHeaderProps) {
  const iconSizes = useIconSizes();
  return (
    <div
      className={cn(
        "p-2 border-b flex-shrink-0",
        formType === 'storage'
          ? "bg-gradient-to-r from-[hsl(var(--bg-info))]/20 to-accent"
          : "bg-gradient-to-r from-[hsl(var(--bg-warning))]/40 to-[hsl(var(--bg-warning))]/20"
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              `flex ${iconSizes.xl2} items-center justify-center rounded-lg shadow-sm`,
              formType === 'storage'
                ? "bg-accent text-primary"
                : "bg-[hsl(var(--bg-warning))]/40 text-[hsl(var(--text-warning))]"
            )}
          >
            {formType === 'storage' ? <Package className={iconSizes.md} /> : <Car className={iconSizes.md} />}
          </div>
          <div>
            <h2 className="text-xl font-semibold text-foreground">
              {formTitle}
            </h2>
            <p className="text-sm text-muted-foreground">
              {building.name} - {building.project}
            </p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onCancel} className={iconSizes.xl}>
          <X className={iconSizes.sm} />
        </Button>
      </div>
    </div>
  );
}
