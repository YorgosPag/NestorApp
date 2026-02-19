'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { X, Package, Car } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { cn } from '@/lib/utils';
import type { StorageType } from '@/types/storage';

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
          ? "bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20"
          : "bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-950/20 dark:to-orange-950/20"
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              `flex ${iconSizes.xl2} items-center justify-center rounded-lg shadow-sm`,
              formType === 'storage'
                ? "bg-purple-100 text-purple-700"
                : "bg-orange-100 text-orange-700"
            )}
          >
            {formType === 'storage' ? <Package className={iconSizes.md} /> : <Car className={iconSizes.md} />}
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              {formTitle}
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
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
