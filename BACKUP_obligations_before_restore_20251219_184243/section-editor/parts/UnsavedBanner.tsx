"use client";

import React from 'react';

interface UnsavedBannerProps {
  show: boolean;
}

export function UnsavedBanner({ show }: UnsavedBannerProps) {
  if (!show) return null;

  return (
    <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
      <div className="flex items-center gap-2 text-orange-800 text-sm">
        <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
        <span>Έχετε μη αποθηκευμένες αλλαγές σε αυτό το άρθρο</span>
      </div>
    </div>
  );
}
