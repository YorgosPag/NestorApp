"use client";

import { cn } from '@/lib/design-system';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { createModuleLogger } from '@/lib/telemetry';
import { useTranslation } from '@/i18n/hooks/useTranslation';

const logger = createModuleLogger('Preview');

interface PreviewProps {
  html: string;
  placeholder: string;
  minHeight: number;
  maxHeight: number;
}

export function Preview({ html, placeholder, minHeight, maxHeight }: PreviewProps) {
  const colors = useSemanticColors();
  const { t } = useTranslation('obligations');
  logger.info('Preview component received HTML', { htmlLength: html?.length ?? 0 });

  if (typeof window === 'undefined') {
    return (
      <div
        style={{ minHeight: `${minHeight}px`, maxHeight: `${maxHeight}px` }}
        className={cn("prose prose-sm max-w-none p-4 border rounded-md overflow-y-auto", colors.bg.secondary)}
      >
        <p className="text-muted-foreground italic">{t('richText.previewBrowserOnly')}</p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "prose prose-sm max-w-none p-4 border rounded-md overflow-y-auto",
        colors.bg.secondary,
        "prose-headings:text-foreground prose-p:text-foreground prose-li:text-foreground",
        "prose-strong:text-foreground prose-em:text-muted-foreground"
      )}
      style={{ minHeight: `${minHeight}px`, maxHeight: `${maxHeight}px` }}
    >
      {html ? (
        <div dangerouslySetInnerHTML={{ __html: html }} />
      ) : (
        <p className="text-muted-foreground italic">{placeholder}</p>
      )}
    </div>
  );
}


