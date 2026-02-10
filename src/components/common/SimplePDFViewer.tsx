'use client';

import React from 'react';
import { FileText, ExternalLink } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { colors as tokenColors } from '@/styles/design-tokens';
import { HOVER_TEXT_EFFECTS } from '@/components/ui/effects/hover-effects';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';

interface SimplePDFViewerProps {
  file: string;
  className?: string;
  fallbackMessage?: string;
}

export function SimplePDFViewer({
  file,
  className,
  fallbackMessage
}: SimplePDFViewerProps) {
  const iconSizes = useIconSizes();
  const { createBorder, quick } = useBorderTokens();
  const colors = useSemanticColors();
  // 🏢 ENTERPRISE: i18n hook for translations
  const { t } = useTranslation('files');

  return (
    <div className={`${colors.bg.secondary} ${quick.card} ${createBorder('medium', tokenColors.gray['300'], 'dashed')} p-6 ${className}`}>
      <div className="text-center space-y-3">
        <FileText className={`${iconSizes.xl3} ${colors.text.muted} mx-auto`} />
        <div>
          <h3 className={`font-medium ${colors.text.primary}`}>{t('pdf.title')}</h3>
          <p className={`text-sm ${colors.text.muted} mt-1`}>{fallbackMessage || t('pdf.preview')}</p>
          <a
            href={file}
            target="_blank"
            rel="noopener noreferrer"
            className={`mt-3 inline-flex items-center gap-2 text-sm ${HOVER_TEXT_EFFECTS.BLUE} underline`}
          >
            <ExternalLink className={iconSizes.sm} />
            {t('pdf.openInNewTab')}
          </a>
        </div>
      </div>
    </div>
  );
}
