
"use client";

import { useTranslation } from 'react-i18next';
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIconSizes } from '@/hooks/useIconSizes';
import type { ObligationDocument } from "@/types/obligations";
import { exportObligationToPDF } from "@/services/pdf-export.service";

interface PrintButtonProps {
    document: ObligationDocument;
    className?: string;
}

export function PrintButton({ document, className }: PrintButtonProps) {
  const { t } = useTranslation('obligations');
  const iconSizes = useIconSizes();
  const handlePrint = async () => {
    try {
      const pdfData = await exportObligationToPDF(document, {
        includeTableOfContents: true,
        includePageNumbers: true,
        includeLogo: false,
      });

      const blob = new Blob([pdfData as BlobPart], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);

      if (typeof window !== "undefined") {
        const printWindow = window.open(url, "_blank");
        if (printWindow) {
          printWindow.addEventListener("load", () => {
            printWindow.print();
          });
        }
      }

      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      console.error("Error printing PDF:", error);
      if (typeof window !== "undefined") {
        window.alert(t('print.error'));
      }
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handlePrint}
      className={cn("flex items-center gap-2", className)}
    >
      <Printer className={iconSizes.sm} />
      {t('print.button')}
    </Button>
  );
}
