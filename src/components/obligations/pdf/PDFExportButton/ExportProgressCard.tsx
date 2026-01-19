// 🌐 i18n: All labels converted to i18n keys - 2026-01-19
"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Loader2, CheckCircle } from "lucide-react";
import { useIconSizes } from '@/hooks/useIconSizes';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from 'react-i18next';

interface ExportProgressCardProps {
  progress: number;
}

export function ExportProgressCard({ progress }: ExportProgressCardProps) {
  const iconSizes = useIconSizes();
  const { t } = useTranslation('obligations');
  const isComplete = progress === 100;

  // 🏢 ENTERPRISE: i18n-enabled progress message getter
  const getProgressMessage = (value: number): string => {
    if (value < 30) return t('export.progress.preparingContent');
    if (value < 60) return t('export.progress.formattingDocument');
    if (value < 90) return t('export.progress.creatingToc');
    if (value < 100) return t('export.progress.finalProcessing');
    return t('export.progress.complete');
  };

  if (isComplete) {
    return (
      <Card className="bg-accent/20 border-accent/40">
        <CardContent className="pt-4">
          <div className="flex items-center gap-3">
            <CheckCircle className={`${iconSizes.md} text-accent-foreground`} />
            <div>
              <h4 className="font-medium text-foreground">{t('export.success.title')}</h4>
              <p className="text-sm text-muted-foreground">{t('export.success.message')}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Loader2 className={`${iconSizes.md} animate-spin text-primary`} />
            <div>
              <h4 className="font-medium">{t('export.creating')}</h4>
              <p className="text-sm text-muted-foreground">{getProgressMessage(progress)}</p>
            </div>
          </div>
          <Progress value={progress} className="w-full" />
          <div className="text-center text-sm text-muted-foreground">
            {t('export.percentComplete', { percent: progress })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
