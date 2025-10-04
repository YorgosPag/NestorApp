'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import type { StorageType } from '@/types/storage';

export function StorageCardBackground({ type }: { type: StorageType }) {
  return (
    <div className={cn(
      "absolute inset-0 opacity-100", // Adjusted opacity for visibility
      type === 'storage'
        ? "bg-gradient-to-br from-purple-100 via-blue-50 to-purple-50 dark:from-purple-950/50 dark:via-blue-950/20 dark:to-purple-950/50"
        : "bg-gradient-to-br from-orange-100 via-yellow-50 to-orange-50 dark:from-orange-950/50 dark:via-yellow-950/20 dark:to-orange-950/50"
    )}>
      <div className="absolute top-2 left-2 w-6 h-6 bg-white/30 rounded-full opacity-50"></div>
      <div className="absolute top-4 right-4 w-4 h-4 bg-white/20 rounded-full opacity-50"></div>
      <div className="absolute bottom-2 left-6 w-3 h-3 bg-white/40 rounded-full opacity-50"></div>
      <div className="absolute bottom-3 right-2 w-8 h-8 bg-white/20 rounded-full opacity-50"></div>
    </div>
  );
}
