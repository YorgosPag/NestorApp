'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useTypography } from '@/hooks/useTypography';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { FileText, Camera, FileImage, Eye, Download, Trash2 } from 'lucide-react';
// 🏢 ENTERPRISE: Import from canonical location
import { Spinner as AnimatedSpinner } from '@/components/ui/spinner';
import { INTERACTIVE_PATTERNS, FORM_BUTTON_EFFECTS } from '@/components/ui/effects';
// 🏢 ENTERPRISE: i18n - Full internationalization support
import { useTranslation } from '@/i18n/hooks/useTranslation';
// 🏢 ADR-054: Centralized upload components
import { FileUploadZone } from '@/components/shared/files/FileUploadZone';
import { FileUploadButton } from '@/components/shared/files/FileUploadButton';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('FilesCard');

export function FilesCard() {
  // 🏢 ENTERPRISE: i18n hook for translations
  const { t } = useTranslation('building');
  const iconSizes = useIconSizes();
  const { createBorder, quick, getStatusBorder } = useBorderTokens();
  const colors = useSemanticColors();
  const typography = useTypography();

  /**
   * 🏢 ADR-054: Centralized file upload handler
   * Receives validated/compressed files from FileUploadZone
   */
  const handleFileUpload = async (files: File[]) => {
    if (files.length === 0) return;
    logger.info('Files selected', { fileNames: files.map(f => f.name) });
    // TODO: Implement actual file upload to FileRecordService
  };

  /**
   * 🏢 ADR-054: Single file upload handler for FileUploadButton
   */
  const handleSingleFileUpload = (file: File) => {
    handleFileUpload([file]);
  };

  return (
    <Card>
      <CardHeader className="p-2">
        <nav className="flex items-center justify-between" role="toolbar" aria-label="File management tools">
          <CardTitle className={cn('flex items-center gap-2', typography.card.titleCompact)}>
            <FileText className={iconSizes.md} />
            {t('tabs.general.files.title')}
          </CardTitle>
          <div className="flex gap-2">
            {/* 🏢 ADR-054: Using centralized FileUploadButton */}
            <FileUploadButton
              onFileSelect={handleSingleFileUpload}
              accept="*/*"
              fileType="any"
              buttonText={t('tabs.general.files.addFiles')}
              variant="outline"
              size="sm"
            />
            <Button variant="outline" size="sm">
              <Camera className={`${iconSizes.sm} mr-2`} />
              {t('tabs.general.files.newPhoto')}
            </Button>
          </div>
        </nav>
      </CardHeader>
      <CardContent className="p-2 pt-0">
        {/* 🏢 ADR-054: Using centralized FileUploadZone with drag & drop */}
        <FileUploadZone
          onUpload={handleFileUpload}
          accept="*/*"
          multiple
          enableCompression
        />

        <section className="mt-2 space-y-2" role="region" aria-labelledby="existing-files-heading">
          <h4 id="existing-files-heading" className="text-sm font-medium text-foreground">{t('tabs.general.files.existingFiles')}</h4>

          <article className={`flex items-center justify-between p-2 bg-card ${quick.card} border ${INTERACTIVE_PATTERNS.SUBTLE_HOVER}`} aria-label="File: Contract.pdf">
            <div className="flex items-center space-x-2">
              <div className={`flex-shrink-0 ${iconSizes.xl2} ${colors.bg.errorSubtle} dark:${colors.text.errorStrong} ${quick.card} flex items-center justify-center`}>
                <FileText className={`${iconSizes.md} text-red-600`} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground truncate">Contract.pdf</p>
                <p className="text-xs text-muted-foreground">2.4 MB • {t('tabs.general.files.uploadedOn', { date: '15/02/2025' })}</p>
              </div>
            </div>
            <div className="flex items-center space-x-1">
              <Button variant="ghost" size="sm"><Eye className={`${iconSizes.sm} mr-1`} /> {t('tabs.general.files.view')}</Button>
              <Button variant="ghost" size="sm"><Download className={`${iconSizes.sm} mr-1`} /> {t('tabs.general.files.download')}</Button>
              <Button variant="ghost" size="icon" className={`text-red-500 ${FORM_BUTTON_EFFECTS.DESTRUCTIVE}`}><Trash2 className={iconSizes.sm} /></Button>
            </div>
          </article>

          <article className={`flex items-center justify-between p-2 bg-card ${quick.card} border ${INTERACTIVE_PATTERNS.SUBTLE_HOVER}`} aria-label="File: Progress Feb 2025.jpg">
            <div className="flex items-center space-x-2">
              <div className={`flex-shrink-0 ${iconSizes.xl2} ${colors.bg.successSubtle} dark:${colors.text.successStrong} ${quick.card} flex items-center justify-center`}>
                 <FileImage className={`${iconSizes.md} text-green-600`} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground truncate">Progress_Feb_2025.jpg</p>
                <p className="text-xs text-muted-foreground">4.2 MB • {t('tabs.general.files.uploadedToday')}</p>
              </div>
            </div>
            <div className="flex items-center space-x-1">
               <Button variant="ghost" size="sm"><Eye className={`${iconSizes.sm} mr-1`} /> {t('tabs.general.files.view')}</Button>
               <Button variant="ghost" size="sm"><Download className={`${iconSizes.sm} mr-1`} /> {t('tabs.general.files.download')}</Button>
               <Button variant="ghost" size="icon" className={`text-red-500 ${FORM_BUTTON_EFFECTS.DESTRUCTIVE}`}><Trash2 className={iconSizes.sm} /></Button>
            </div>
          </article>
        </section>

        <aside className={`mt-2 p-2 ${colors.bg.info} ${quick.info} dark:${getStatusBorder('info')} hidden`} id="upload-progress" role="status" aria-label="Upload progress">
          <div className="flex items-center space-x-2">
            <div className="flex-shrink-0"><AnimatedSpinner size="medium" /></div>
            <div className="flex-1">
              <p className="text-sm font-medium text-blue-900 dark:text-blue-200">{t('tabs.general.files.uploadInProgress')}</p>
              <Progress value={45} className="h-2 mt-1" />
              <p className="text-xs text-blue-700 dark:text-blue-400 mt-1">{t('tabs.general.files.filesCompleted', { completed: 2, total: 5 })}</p>
            </div>
          </div>
        </aside>
      </CardContent>
    </Card>
  );
}
