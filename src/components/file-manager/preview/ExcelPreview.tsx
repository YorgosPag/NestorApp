'use client';

import React, { useState } from 'react';
import { FileWarning } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useTranslation } from '@/i18n/hooks/useTranslation';

interface ExcelPreviewProps {
  url: string;
  title: string;
}

const OFFICE_VIEWER_BASE = 'https://view.officeapps.live.com/op/embed.aspx';

export function ExcelPreview({ url, title }: ExcelPreviewProps) {
  const { t } = useTranslation(['files', 'files-media']);
  const colors = useSemanticColors();
  const [hasError, setHasError] = useState(false);

  const embedUrl = `${OFFICE_VIEWER_BASE}?src=${encodeURIComponent(url)}`;

  if (hasError) {
    return (
      <section className="flex-1 flex flex-col items-center justify-center gap-3 p-8 text-center">
        <FileWarning className="h-8 w-8 text-destructive" aria-hidden="true" />
        <p className={cn('text-sm font-medium', colors.text.muted)}>
          {t('preview.excelError')}
        </p>
      </section>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden" aria-label={title}>
      <iframe
        src={embedUrl}
        title={title}
        className="flex-1 w-full border-0"
        onError={() => setHasError(true)}
        allow="fullscreen"
      />
    </div>
  );
}
