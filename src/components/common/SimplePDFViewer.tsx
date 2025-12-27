'use client';

import React from 'react';
import { FileText, ExternalLink } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
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
  const { createBorder, quick } = useBorderTokens();
  const colors = useSemanticColors();
  return (
    <div className={`${colors.bg.secondary} ${quick.card} ${createBorder('medium', 'rgb(209 213 219)', 'dashed')} p-6 ${className}`}>
      <div className="text-center space-y-3">
        <FileText className={`${iconSizes.xl3} ${colors.text.muted} mx-auto`} />
        <div>
          <h3 className={`font-medium ${colors.text.primary}`}>PDF Document</h3>
          <p className={`text-sm ${colors.text.muted} mt-1`}>{fallbackMessage}</p>
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
