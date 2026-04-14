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
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { createModuleLogger } from '@/lib/telemetry';
import '@/lib/design-system';
const logger = createModuleLogger('ToolbarExportMenu');

interface ToolbarExportMenuProps {
  onExport: () => void;
}

export function ToolbarExportMenu({ onExport }: ToolbarExportMenuProps) {
  const { t } = useTranslation(['common', 'common-account', 'common-actions', 'common-empty-states', 'common-navigation', 'common-photos', 'common-sales', 'common-shared', 'common-status', 'common-validation']);
  const iconSizes = useIconSizes();
  return (
    <div className="flex items-center gap-1">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <div>
            <ToolbarButton tooltip={t('toolbar.tooltips.exportData')}>
              <Download className={iconSizes.sm} />
            </ToolbarButton>
          </div>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>{t('toolbar.labels.exportTo')}:</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onExport}>
            <FileText className={`${iconSizes.sm} mr-2`} />
            {t('toolbar.labels.excelFormat')}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onExport}>
            <FileText className={`${iconSizes.sm} mr-2`} />
            {t('toolbar.labels.pdfReport')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ToolbarButton
        tooltip={t('toolbar.tooltips.importData')}
        onClick={() => logger.info('Importing...')}
      >
        <Upload className={iconSizes.sm} />
      </ToolbarButton>
    </div>
  );
}
