'use client';

import React from 'react';
import { FileText, Upload } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';

export function EmptyState() {
  const iconSizes = useIconSizes();
  return (
    <div className="flex items-center justify-center h-full bg-gray-50">
      <div className="text-center space-y-4 max-w-md">
        <FileText className={`${iconSizes['2xl']} text-gray-300 mx-auto`} />
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No Floor Plan Loaded
          </h3>
          <p className="text-gray-600 mb-4">
            Upload a PDF floor plan to get started with property management
          </p>
          <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
            <Upload className={iconSizes.sm} />
            <span>Use the "Upload PDF" button in the toolbar</span>
          </div>
        </div>
      </div>
    </div>
  );
}
