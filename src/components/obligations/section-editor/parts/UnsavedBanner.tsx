"use client";

import React from 'react';
import { useIconSizes } from '@/hooks/useIconSizes';

interface UnsavedBannerProps {
  show: boolean;
}

export function UnsavedBanner({ show }: UnsavedBannerProps) {
  const iconSizes = useIconSizes();
  if (!show) return null;

  return (
    <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
      <div className="flex items-center gap-2 text-orange-800 text-sm">
        <div className={`${iconSizes.xs.replace('w-3 h-3', 'w-2 h-2')} bg-orange-500 rounded-full`}></div>
        <span>Έχετε μη αποθηκευμένες αλλαγές σε αυτό το άρθρο</span>
      </div>
    </div>
  );
}
