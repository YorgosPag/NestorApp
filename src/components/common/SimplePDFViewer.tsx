'use client';

import React from 'react';
import { FileText, ExternalLink } from 'lucide-react';

interface SimplePDFViewerProps {
  file: string;
  className?: string;
  fallbackMessage?: string;
}

export function SimplePDFViewer({
  file,
  className,
  fallbackMessage = "PDF προεπισκόπηση"
}: SimplePDFViewerProps) {
  return (
    <div className={`bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 p-6 ${className}`}>
      <div className="text-center space-y-3">
        <FileText className="h-12 w-12 text-gray-400 mx-auto" />
        <div>
          <h3 className="font-medium text-gray-900">PDF Document</h3>
          <p className="text-sm text-gray-500 mt-1">{fallbackMessage}</p>
          <a
            href={file}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 underline"
          >
            <ExternalLink className="h-4 w-4" />
            Άνοιγμα PDF σε νέα καρτέλα
          </a>
        </div>
      </div>
    </div>
  );
}
