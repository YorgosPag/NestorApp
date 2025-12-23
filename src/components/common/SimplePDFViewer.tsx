'use client';

import React from 'react';
import { FileText, ExternalLink } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { HOVER_TEXT_EFFECTS } from '@/components/ui/effects/hover-effects';

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
  const iconSizes = useIconSizes();
  return (
    <div className={`bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 p-6 ${className}`}>
      <div className="text-center space-y-3">
        <FileText className={`${iconSizes.xl3} text-gray-400 mx-auto`} />
        <div>
          <h3 className="font-medium text-gray-900">PDF Document</h3>
          <p className="text-sm text-gray-500 mt-1">{fallbackMessage}</p>
          <a
            href={file}
            target="_blank"
            rel="noopener noreferrer"
            className={`mt-3 inline-flex items-center gap-2 text-sm ${HOVER_TEXT_EFFECTS.BLUE} underline`}
          >
            <ExternalLink className={iconSizes.sm} />
            Άνοιγμα PDF σε νέα καρτέλα
          </a>
        </div>
      </div>
    </div>
  );
}
