'use client';

import React, { useEffect, useState } from 'react';
import { Loader2, FileWarning } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useTranslation } from '@/i18n/hooks/useTranslation';

interface ExcelPreviewProps {
  fileId: string;
  title: string;
}

type ExcelState = 'loading' | 'ready' | 'error';

export function ExcelPreview({ fileId, title }: ExcelPreviewProps) {
  const { t } = useTranslation(['files', 'files-media']);
  const colors = useSemanticColors();
  const [state, setState] = useState<ExcelState>('loading');
  const [html, setHtml] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setState('loading');
      try {
        const response = await fetch(`/api/files/${fileId}/excel-preview`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const text = await response.text();
        if (cancelled) return;
        setHtml(text);
        setState('ready');
      } catch {
        if (cancelled) return;
        setState('error');
      }
    }

    load();
    return () => { cancelled = true; };
  }, [fileId]);

  if (state === 'error') {
    return (
      <section className="flex-1 flex flex-col items-center justify-center gap-3 p-8 text-center">
        <FileWarning className="h-8 w-8 text-destructive" aria-hidden="true" />
        <p className={cn('text-sm font-medium', colors.text.muted)}>
          {t('preview.excelError')}
        </p>
      </section>
    );
  }

  if (state === 'loading') {
    return (
      <section className="flex-1 flex flex-col items-center justify-center gap-3 p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-hidden="true" />
        <p className={cn('text-sm', colors.text.muted)}>{t('preview.excelLoading')}</p>
      </section>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden" aria-label={title}>
      <iframe
        srcDoc={html}
        aria-label={title}
        className="flex-1 w-full border-0"
        sandbox="allow-same-origin"
      />
    </div>
  );
}
