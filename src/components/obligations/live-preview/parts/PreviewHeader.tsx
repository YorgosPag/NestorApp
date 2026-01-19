"use client";

import { Button } from "@/components/ui/button";
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTranslation } from '@/i18n';
import { Eye, Printer } from "lucide-react";

interface PreviewHeaderProps {
  showToc: boolean;
  onToggleToc: () => void;
  onPrint: () => void;
}

export function PreviewHeader({ showToc, onToggleToc, onPrint }: PreviewHeaderProps) {
  const iconSizes = useIconSizes();
  const { t } = useTranslation('obligations');

  return (
    <div className="flex items-center justify-between p-4 border-b bg-muted/30">
      <div className="flex items-center gap-3">
        <Eye className={`${iconSizes.md} text-muted-foreground`} />
        <div>
          <h3 className="font-medium text-foreground">{t('preview.title')}</h3>
          <p className="text-sm text-muted-foreground">{t('preview.description')}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onToggleToc}
          className="text-xs"
          aria-pressed={showToc}
          aria-label={showToc ? t('aria.hideToc') : t('aria.showToc')}
        >
          {showToc ? t('preview.toc.hide') : t('preview.toc.show')}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onPrint}
          className="text-xs"
          aria-label={t('aria.printDocument')}
        >
          <Printer className={`${iconSizes.sm} mr-1`} />
          {t('print.button')}
        </Button>
      </div>
    </div>
  );
}
