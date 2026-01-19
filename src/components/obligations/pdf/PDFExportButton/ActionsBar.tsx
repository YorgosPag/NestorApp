// 🌐 i18n: All labels converted to i18n keys - 2026-01-19
"use client";

import { Button } from "@/components/ui/button";
import { Eye, Download } from "lucide-react";
import { useIconSizes } from '@/hooks/useIconSizes';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from 'react-i18next';

interface ActionsBarProps {
  onPreview: () => void;
  onDownload: () => void;
  onCancel: () => void;
}

export function ActionsBar({ onPreview, onDownload, onCancel }: ActionsBarProps) {
  const { t } = useTranslation('common');
  const iconSizes = useIconSizes();
  return (
    <div className="flex items-center gap-3 pt-4 border-t">
      <Button
        onClick={onPreview}
        variant="outline"
        className="flex items-center gap-2"
      >
        <Eye className={iconSizes.sm} />
        {t('pdf.preview')}
      </Button>

      <Button
        onClick={onDownload}
        className="flex items-center gap-2 flex-1"
      >
        <Download className={iconSizes.sm} />
        {t('pdf.download')}
      </Button>

      <Button variant="ghost" onClick={onCancel}>
        {t('buttons.cancel')}
      </Button>
    </div>
  );
}
