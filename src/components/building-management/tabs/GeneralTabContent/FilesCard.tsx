'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { FileText, Upload, Camera, FileUp, FileImage, Eye, Download, Trash2 } from 'lucide-react';
// 🏢 ENTERPRISE: Import from canonical location
import { Spinner as AnimatedSpinner } from '@/components/ui/spinner';
import { INTERACTIVE_PATTERNS, FORM_BUTTON_EFFECTS } from '@/components/ui/effects';
import { layoutUtilities } from '@/styles/design-tokens';
// 🏢 ENTERPRISE: i18n - Full internationalization support
import { useTranslation } from '@/i18n/hooks/useTranslation';

export function FilesCard() {
  // 🏢 ENTERPRISE: i18n hook for translations
  const { t } = useTranslation('building');
  const iconSizes = useIconSizes();
  const { createBorder, quick, getStatusBorder } = useBorderTokens();
  const colors = useSemanticColors();

  const handleFileUpload = (files: FileList | null) => {
    if (!files) return;
    console.log('Files selected:', Array.from(files).map(f => f.name));
  };

  return (
    <Card>
      <CardHeader>
        <nav className="flex items-center justify-between" role="toolbar" aria-label="File management tools">
          <CardTitle className="flex items-center gap-2">
            <FileText className={iconSizes.md} />
            {t('tabs.general.files.title')}
          </CardTitle>
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm" className="cursor-pointer">
              <Label>
                <Upload className={`${iconSizes.sm} mr-2`} />
                {t('tabs.general.files.addFiles')}
                <input type="file" multiple className="hidden" onChange={(e) => handleFileUpload(e.target.files)} />
              </Label>
            </Button>
            <Button variant="outline" size="sm">
              <Camera className={`${iconSizes.sm} mr-2`} />
              {t('tabs.general.files.newPhoto')}
            </Button>
          </div>
        </nav>
      </CardHeader>
      <CardContent>
        <section
          className={`${createBorder('medium', 'hsl(var(--border))', 'dashed')} ${quick.card} p-6 text-center cursor-pointer bg-muted/20 ${INTERACTIVE_PATTERNS.DROPZONE_HOVER}`}
          role="region"
          aria-label="File drop zone"
          onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add(getStatusBorder('info').split(' ')[1], 'bg-accent/20'); }}
          onDragLeave={(e) => { e.currentTarget.classList.remove(getStatusBorder('info').split(' ')[1], 'bg-accent/20'); }}
          onDrop={(e) => {
            e.preventDefault();
            e.currentTarget.classList.remove(getStatusBorder('info').split(' ')[1], 'bg-accent/20');
            handleFileUpload(e.dataTransfer.files);
          }}
        >
          <div className="space-y-2">
            <div className={`mx-auto ${iconSizes.xl3} text-muted-foreground flex items-center justify-center`}>
              <FileUp className={iconSizes.xl} />
            </div>
            <div className="text-sm text-muted-foreground">
              <span className={`font-medium cursor-pointer ${INTERACTIVE_PATTERNS.LINK_PRIMARY}`}>
                {t('tabs.general.files.clickToSelect')}
              </span>{' '}{t('tabs.general.files.orDragAndDrop')}
            </div>
            <p className="text-xs text-muted-foreground/80">
              {t('tabs.general.files.fileTypes')}
            </p>
          </div>
        </section>

        <section className="mt-6 space-y-3" role="region" aria-labelledby="existing-files-heading">
          <h4 id="existing-files-heading" className="text-sm font-medium text-foreground">{t('tabs.general.files.existingFiles')}</h4>

          <article className={`flex items-center justify-between p-3 bg-card ${quick.card} border ${INTERACTIVE_PATTERNS.SUBTLE_HOVER}`} aria-label="File: Contract.pdf">
            <div className="flex items-center space-x-3">
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

          <article className={`flex items-center justify-between p-3 bg-card ${quick.card} border ${INTERACTIVE_PATTERNS.SUBTLE_HOVER}`} aria-label="File: Progress Feb 2025.jpg">
            <div className="flex items-center space-x-3">
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

        <aside className={`mt-4 p-3 ${colors.bg.info} ${quick.info} dark:${getStatusBorder('info')} hidden`} id="upload-progress" role="status" aria-label="Upload progress">
          <div className="flex items-center space-x-3">
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
