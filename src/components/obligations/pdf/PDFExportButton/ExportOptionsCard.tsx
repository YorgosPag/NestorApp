
"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Settings } from "lucide-react";
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTranslation } from '@/i18n';
import type { ExportOptions } from "./types";

interface ExportOptionsCardProps {
  exportOptions: ExportOptions;
  onChange: (newOptions: ExportOptions) => void;
  contentSummary: {
    sections: number;
    articles: number;
    paragraphs: number;
    words: number;
    readingTime: number;
  };
}

export function ExportOptionsCard({ exportOptions, onChange, contentSummary }: ExportOptionsCardProps) {
  const iconSizes = useIconSizes();
  const { t } = useTranslation('obligations');

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Settings className={iconSizes.md} />
          {t('exportOptions.title')}
        </CardTitle>
        <CardDescription>
          {t('exportOptions.description')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Content Options */}
        <div className="space-y-4">
          <h4 className="font-medium text-sm">{t('exportOptions.content.title')}</h4>
          <div className="space-y-3">
            <label className="flex items-center gap-3">
              <input aria-label={t('exportOptions.content.toc.aria')} type="checkbox" checked={exportOptions.includeTableOfContents} onChange={(e) => onChange({ ...exportOptions, includeTableOfContents: e.target.checked })} className="rounded" />
              <div>
                <span className="text-sm font-medium">{t('exportOptions.content.toc.label')}</span>
                <p className="text-xs text-muted-foreground">{t('exportOptions.content.toc.description')}</p>
              </div>
            </label>
            <label className="flex items-center gap-3">
              <input aria-label={t('exportOptions.content.pageNumbers.aria')} type="checkbox" checked={exportOptions.includePageNumbers} onChange={(e) => onChange({ ...exportOptions, includePageNumbers: e.target.checked })} className="rounded" />
              <div>
                <span className="text-sm font-medium">{t('exportOptions.content.pageNumbers.label')}</span>
                <p className="text-xs text-muted-foreground">{t('exportOptions.content.pageNumbers.description')}</p>
              </div>
            </label>
            <label className="flex items-center gap-3">
              <input aria-label={t('exportOptions.content.logo.aria')} type="checkbox" checked={exportOptions.includeLogo} onChange={(e) => onChange({ ...exportOptions, includeLogo: e.target.checked })} className="rounded" />
              <div>
                <span className="text-sm font-medium">{t('exportOptions.content.logo.label')}</span>
                <p className="text-xs text-muted-foreground">{t('exportOptions.content.logo.description')}</p>
              </div>
            </label>
          </div>
        </div>
        <Separator />
        {/* Quality Options */}
        <div className="space-y-4">
            <h4 className="font-medium text-sm">{t('exportOptions.quality.title')}</h4>
            <div className="space-y-2">
                <label className="flex items-center gap-3">
                    <input aria-label={t('exportOptions.quality.standard.aria')} type="radio" name="quality" checked={exportOptions.quality === "standard"} onChange={() => onChange({ ...exportOptions, quality: "standard" })} className="rounded-full" />
                    <div>
                        <span className="text-sm font-medium">{t('exportOptions.quality.standard.label')}</span>
                        <p className="text-xs text-muted-foreground">{t('exportOptions.quality.standard.description')}</p>
                    </div>
                </label>
                <label className="flex items-center gap-3">
                    <input aria-label={t('exportOptions.quality.high.aria')} type="radio" name="quality" checked={exportOptions.quality === "high"} onChange={() => onChange({ ...exportOptions, quality: "high" })} className="rounded-full" />
                    <div>
                        <span className="text-sm font-medium">{t('exportOptions.quality.high.label')}</span>
                        <p className="text-xs text-muted-foreground">{t('exportOptions.quality.high.description')}</p>
                    </div>
                </label>
            </div>
        </div>
        <Separator />
        {/* Document Metrics */}
        <div className="space-y-4">
          <h4 className="font-medium text-sm">{t('exportOptions.preview.title')}</h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="space-y-2">
              <div className="flex justify-between"><span className="text-muted-foreground">{t('exportOptions.preview.sections')}</span><Badge variant="outline">{contentSummary.sections}</Badge></div>
              <div className="flex justify-between"><span className="text-muted-foreground">{t('exportOptions.preview.articles')}</span><Badge variant="outline">{contentSummary.articles}</Badge></div>
              <div className="flex justify-between"><span className="text-muted-foreground">{t('exportOptions.preview.paragraphs')}</span><Badge variant="outline">{contentSummary.paragraphs}</Badge></div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between"><span className="text-muted-foreground">{t('exportOptions.preview.words')}</span><Badge variant="outline">{contentSummary.words.toLocaleString()}</Badge></div>
              <div className="flex justify-between"><span className="text-muted-foreground">{t('exportOptions.preview.readingTime')}</span><Badge variant="outline">{contentSummary.readingTime} {t('exportOptions.preview.minutes')}</Badge></div>
              <div className="flex justify-between"><span className="text-muted-foreground">{t('exportOptions.preview.estimatedPages')}</span><Badge variant="outline">~{Math.ceil(contentSummary.words / 300)}</Badge></div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

