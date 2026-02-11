"use client";

import { useTranslation } from '@/i18n/hooks/useTranslation';

interface DocumentFooterProps {
  sectionsCount: number;
  articlesCount: number;
  paragraphsCount: number;
  zoomDisplay: number;
}

export function DocumentFooter({ sectionsCount, articlesCount, paragraphsCount, zoomDisplay }: DocumentFooterProps) {
  const { t } = useTranslation('obligations');

  return (
    <div className="flex items-center justify-between p-4 border-t bg-muted/30 text-sm text-muted-foreground">
      <div>
        {sectionsCount} {t('footer.sections')} - {articlesCount} {t('footer.articles')} - {paragraphsCount} {t('footer.paragraphs')}
      </div>
      <div className="flex items-center gap-2">
        <span>{t('footer.zoom')}: {zoomDisplay}%</span>
      </div>
    </div>
  );
}

