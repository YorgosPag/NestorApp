"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FileText, FileDown } from "lucide-react";
import { getContentSummary } from "@/lib/obligations-utils";
import { cn } from "@/lib/design-system";
import { useIconSizes } from "@/hooks/useIconSizes";
import { useTranslation } from '@/i18n/hooks/useTranslation';

import { usePdfExport } from "./pdf/PDFExportButton/hooks/usePdfExport";
import type { PDFExportButtonProps, ExportOptions } from "./pdf/PDFExportButton/types";
import { DocumentInfoCard } from "./pdf/PDFExportButton/DocumentInfoCard";
import { ExportOptionsCard } from "./pdf/PDFExportButton/ExportOptionsCard";
import { ExportProgressCard } from "./pdf/PDFExportButton/ExportProgressCard";
import { ActionsBar } from "./pdf/PDFExportButton/ActionsBar";
import { PrintButton } from "./pdf/PDFExportButton/PrintButton";
import { QuickPDFExportButton } from "./pdf/PDFExportButton/QuickPDFExportButton";

export default function PDFExportButton({
  document,
  variant = "default",
  size = "default",
  showPreview = true,
  className,
}: PDFExportButtonProps) {
  const iconSizes = useIconSizes();
  const { t } = useTranslation('obligations');
  const [showOptions, setShowOptions] = useState(false);
  const [exportOptions, setExportOptions] = useState<ExportOptions>({
    includeTableOfContents: true,
    includePageNumbers: true,
    includeLogo: false,
    quality: "standard",
  });

  const { isExporting, exportProgress, handleExport } = usePdfExport(document);
  const contentSummary = useMemo(() => {
    const metrics = getContentSummary(document);
    const sections = document.sections?.length ?? 0;
    const articles = document.sections?.reduce((sum, s) => sum + (s.articles?.length ?? 0), 0) ?? 0;
    const paragraphs = document.sections?.reduce((sum, s) =>
      sum + (s.articles?.reduce((aSum, a) => aSum + (a.paragraphs?.length ?? 0), 0) ?? 0), 0) ?? 0;
    return {
      sections,
      articles,
      paragraphs,
      words: metrics.totalWords,
      readingTime: parseInt(metrics.readingTime) || Math.ceil(metrics.totalWords / 200)
    };
  }, [document]);

  if (!showPreview) {
    return (
      <QuickPDFExportButton
        document={document}
        className={className}
        variant={variant}
        size={size}
      />
    );
  }

  return (
    <Dialog open={showOptions} onOpenChange={setShowOptions}>
      <DialogTrigger asChild>
        <Button variant={variant} size={size} className={cn("flex items-center gap-2", className)}>
          <FileDown className={iconSizes.sm} />
          {t('export.button')}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className={iconSizes.md} />
            {t('export.button')}
          </DialogTitle>
          <DialogDescription>
            {t('pdf.dialogDescription')}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6">
          <DocumentInfoCard document={document} />
          {isExporting ? (
            <ExportProgressCard progress={exportProgress} />
          ) : (
            <ExportOptionsCard
              exportOptions={exportOptions}
              onChange={setExportOptions}
              contentSummary={contentSummary}
            />
          )}
          {!isExporting && (
            <ActionsBar
              onPreview={() => handleExport(exportOptions, true)}
              onDownload={() => handleExport(exportOptions, false)}
              onCancel={() => setShowOptions(false)}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export { QuickPDFExportButton, PrintButton };


