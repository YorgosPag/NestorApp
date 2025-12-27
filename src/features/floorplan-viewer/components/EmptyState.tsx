'use client';

import React from 'react';
import { FileText, Upload } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

export function EmptyState() {
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  return (
    <div className={`flex items-center justify-center h-full ${colors.bg.secondary}`}>
      <div className="text-center space-y-4 max-w-md">
        <FileText className={`${iconSizes['2xl']} ${colors.text.muted} mx-auto`} />
        <div>
          <h3 className={`text-lg font-medium ${colors.text.primary} mb-2`}>
            No Floor Plan Loaded
          </h3>
          <p className={`${colors.text.muted} mb-4`}>
            Upload a PDF floor plan to get started with property management
          </p>
          <div className={`flex items-center justify-center gap-2 text-sm ${colors.text.muted}`}>
            <Upload className={iconSizes.sm} />
            <span>Use the "Upload PDF" button in the toolbar</span>
          </div>
        </div>
      </div>
    </div>
  );
}
