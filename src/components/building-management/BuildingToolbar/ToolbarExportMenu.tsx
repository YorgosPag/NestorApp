'use client';

import React from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ToolbarButton } from '@/components/ui/ToolbarButton';
import { Upload, Download, FileText, BarChart3, Calendar } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
// 🏢 ENTERPRISE: i18n - Full internationalization support
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('ToolbarExportMenu');

interface ToolbarExportMenuProps {
  onExport: () => void;
}

export function ToolbarExportMenu({ onExport }: ToolbarExportMenuProps) {
  // 🏢 ENTERPRISE: i18n hook for translations
  const { t } = useTranslation('building');
  const iconSizes = useIconSizes();
  return (
    <div className="flex items-center gap-1">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <div>
            <ToolbarButton tooltip={t('toolbar.export.title')}>
              <Download className={iconSizes.sm} />
            </ToolbarButton>
          </div>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>{t('toolbar.export.exportTo')}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onExport}>
            <FileText className={`${iconSizes.sm} mr-2`} />
            {t('toolbar.export.excel')}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onExport}>
            <FileText className={`${iconSizes.sm} mr-2`} />
            {t('toolbar.export.pdfReport')}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onExport}>
            <BarChart3 className={`${iconSizes.sm} mr-2`} />
            {t('toolbar.export.statsDashboard')}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onExport}>
            <Calendar className={`${iconSizes.sm} mr-2`} />
            {t('toolbar.export.timeline')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ToolbarButton
        tooltip={t('toolbar.export.import')}
        onClick={() => logger.info('Importing')}
      >
        <Upload className={iconSizes.sm} />
      </ToolbarButton>
    </div>
  );
}