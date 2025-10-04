'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { X, Package, Car } from 'lucide-react';
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
  return (
    <div
      className={cn(
        "p-6 border-b",
        formType === 'storage'
          ? "bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20"
          : "bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-950/20 dark:to-orange-950/20"
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-lg shadow-sm",
              formType === 'storage'
                ? "bg-purple-100 text-purple-700"
                : "bg-orange-100 text-orange-700"
            )}
          >
            {formType === 'storage' ? <Package className="w-5 h-5" /> : <Car className="w-5 h-5" />}
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
        <Button variant="ghost" size="icon" onClick={onCancel} className="h-8 w-8">
          <X className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
