
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { PDFExportButtonProps } from "./types";
import { usePdfExport } from "./hooks/usePdfExport";

export function QuickPDFExportButton({
  document,
  variant = "outline",
  size = "sm",
  className,
}: Omit<PDFExportButtonProps, 'showPreview'>) {
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
            <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
            <Download className="h-4 w-4" />
            )}
            {isExporting ? "Εξαγωγή..." : "Εξαγωγή PDF"}
        </Button>
    );
}
