// 🌐 i18n: All labels converted to i18n keys - 2026-01-18
'use client';

import React from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ToolbarButton } from '@/components/ui/ToolbarButton';
import { Upload, Download, FileText } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTranslation } from 'react-i18next';

interface ToolbarExportMenuProps {
  onExport: () => void;
}

export function ToolbarExportMenu({ onExport }: ToolbarExportMenuProps) {
  const { t } = useTranslation('common');
  const iconSizes = useIconSizes();
  return (
    <div className="flex items-center gap-1">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <div>
            <ToolbarButton tooltip={t('toolbar.exportData')}>
              <Download className={iconSizes.sm} />
            </ToolbarButton>
          </div>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>{t('toolbar.exportTo')}:</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onExport}>
            <FileText className={`${iconSizes.sm} mr-2`} />
            Excel (.xlsx)
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onExport}>
            <FileText className={`${iconSizes.sm} mr-2`} />
            {t('toolbar.pdfReport')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ToolbarButton
        tooltip={t('toolbar.importData')}
        onClick={() => console.log('Importing...')}
      >
        <Upload className={iconSizes.sm} />
      </ToolbarButton>
    </div>
  );
}
