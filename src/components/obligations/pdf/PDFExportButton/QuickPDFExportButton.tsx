
"use client";

import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTranslation } from '@/i18n';
import { PDFExportButtonProps } from "./types";
import { usePdfExport } from "./hooks/usePdfExport";

export function QuickPDFExportButton({
  document,
  variant = "outline",
  size = "sm",
  className,
}: Omit<PDFExportButtonProps, 'showPreview'>) {
    const iconSizes = useIconSizes();
    const { t } = useTranslation('obligations');
    const { isExporting, handleExport } = usePdfExport(document);

    return (
        <Button
            variant={variant}
            size={size}
            onClick={() => handleExport({
                includeTableOfContents: true,
                includePageNumbers: true,
                includeLogo: false,
                quality: 'standard'
            }, false)}
            disabled={isExporting}
            className={cn("flex items-center gap-2", className)}
        >
            {isExporting ? (
            <Loader2 className={`${iconSizes.sm} animate-spin`} />
            ) : (
            <Download className={iconSizes.sm} />
            )}
            {isExporting ? t('export.exporting') : t('export.button')}
        </Button>
    );
}
