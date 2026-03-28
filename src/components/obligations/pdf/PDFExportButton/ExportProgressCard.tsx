// 🌐 i18n: All labels converted to i18n keys - 2026-01-19
"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import { CheckCircle } from "lucide-react";
import { useIconSizes } from '@/hooks/useIconSizes';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';
import '@/lib/design-system';

interface ExportProgressCardProps {
  progress: number;
}

export function ExportProgressCard({ progress }: ExportProgressCardProps) {
  const iconSizes = useIconSizes();
  const { t } = useTranslation('obligations');
  const colors = useSemanticColors();
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
              <p className={cn("text-sm", colors.text.muted)}>{t('export.success.message')}</p>
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
            <Spinner size="medium" className="text-primary" />
            <div>
              <h4 className="font-medium">{t('export.creating')}</h4>
              <p className={cn("text-sm", colors.text.muted)}>{getProgressMessage(progress)}</p>
            </div>
          </div>
          <Progress value={progress} className="w-full" />
          <div className={cn("text-center text-sm", colors.text.muted)}>
            {t('export.percentComplete', { percent: progress })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

