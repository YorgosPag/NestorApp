/**
 * =============================================================================
 * DocxPreview — Inline DOCX rendering via docx-preview
 * =============================================================================
 *
 * Fetches DOCX binary from the canonical download URL and renders it
 * directly into the DOM using docx-preview. Preserves fonts, colors,
 * spacing, page breaks, headers/footers — much closer to Word fidelity
 * than plain HTML conversion.
 *
 * Used exclusively inside FilePreviewPanel — not standalone.
 *
 * @module components/file-manager/preview/DocxPreview
 * @enterprise ADR-031
 */

'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Loader2, FileWarning } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useTranslation } from '@/i18n/hooks/useTranslation';

// ============================================================================
// TYPES
// ============================================================================

interface DocxPreviewProps {
  url: string;
  title: string;
}

type DocxState = 'loading' | 'ready' | 'error';

// ============================================================================
// LAZY IMPORT (heavy library — load on demand)
// ============================================================================

async function renderDocxToContainer(
  arrayBuffer: ArrayBuffer,
  container: HTMLElement,
): Promise<void> {
  const docxPreview = await import('docx-preview');
  await docxPreview.renderAsync(arrayBuffer, container, undefined, {
    className: 'docx-preview-wrapper',
    inWrapper: true,
    ignoreWidth: false,
    ignoreHeight: false,
    ignoreFonts: false,
    breakPages: true,
    ignoreLastRenderedPageBreak: false,
    experimental: false,
    renderHeaders: true,
    renderFooters: true,
    renderFootnotes: true,
    renderEndnotes: true,
  });
}

// ============================================================================
// COMPONENT
// ============================================================================

export function DocxPreview({ url, title }: DocxPreviewProps) {
  const { t } = useTranslation(['files', 'files-media']);
  const colors = useSemanticColors();
  const containerRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<DocxState>('loading');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setState('loading');

      if (!containerRef.current) return;
      containerRef.current.innerHTML = '';

      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const arrayBuffer = await response.arrayBuffer();
        if (cancelled || !containerRef.current) return;

        await renderDocxToContainer(arrayBuffer, containerRef.current);
        if (cancelled) return;

        setState('ready');
      } catch {
        if (cancelled) return;
        setState('error');
      }
    }

    load();
    return () => { cancelled = true; };
  }, [url]);

  // ── Error ──
  if (state === 'error') {
    return (
      <section className="flex-1 flex flex-col items-center justify-center gap-3 p-8 text-center">
        <FileWarning className="h-8 w-8 text-destructive" aria-hidden="true" />
        <p className={cn('text-sm font-medium', colors.text.muted)}>
          {t('preview.docxError')}
        </p>
      </section>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden" aria-label={title}>
      {state === 'loading' && (
        <section className="flex-1 flex flex-col items-center justify-center gap-3 p-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-hidden="true" />
          <p className={cn('text-sm', colors.text.muted)}>
            {t('preview.docxLoading')}
          </p>
        </section>
      )}
      <div
        ref={containerRef}
        className={cn(
          'flex-1 overflow-auto bg-muted/30',
          state === 'loading' && 'hidden',
        )}
      />
    </div>
  );
}
