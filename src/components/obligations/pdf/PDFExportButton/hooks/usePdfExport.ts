
"use client";

import { useCallback, useState, useRef } from "react";
import { exportObligationToPDF, downloadPDF } from "@/services/pdf-export.service";
import { generateFileName } from "@/lib/obligations-utils";
import type { ObligationDocument } from "@/types/obligations";
import type { ExportOptions, ExportBuildOptions } from "../types";

export function usePdfExport(document: ObligationDocument) {
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const buildPdfOptions = useCallback(
    (opts: ExportOptions): ExportBuildOptions => ({
      includeTableOfContents: opts.includeTableOfContents,
      includePageNumbers: opts.includePageNumbers,
      includeLogo: opts.includeLogo,
      logoUrl: opts.logoUrl,
      watermark: opts.watermark,
      margins: opts.quality === "high"
        ? { top: 30, right: 25, bottom: 30, left: 25 }
        : undefined,
    }),
    []
  );

  const handleExport = useCallback(
    async (options: ExportOptions, openPreview = false) => {
      let timer: ReturnType<typeof setInterval> | null = null;
      try {
        setIsExporting(true);
        setExportProgress(10);
        timer = setInterval(() => {
          setExportProgress((p) => Math.min(p + 12, 90));
        }, 200);
        progressTimerRef.current = timer;

        const pdfData = await exportObligationToPDF(document, buildPdfOptions(options));

        if (timer) clearInterval(timer);
        setExportProgress(100);

        const filename = generateFileName(document.title || 'obligation', "pdf");
        if (openPreview) {
          const blob = new Blob([pdfData as BlobPart], { type: "application/pdf" });
          const url = URL.createObjectURL(blob);
          if (typeof window !== "undefined") window.open(url, "_blank");
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        } else {
          downloadPDF(pdfData, filename);
        }
      } catch (err) {
        console.error("Error exporting PDF:", err);
        if (typeof window !== "undefined") {
          window.alert("Σφάλμα κατά την εξαγωγή PDF. Παρακαλώ δοκιμάστε ξανά.");
        }
      } finally {
        if (timer) clearInterval(timer);
        setTimeout(() => {
          setExportProgress(0);
          setIsExporting(false);
        }, 800);
      }
    },
    [document, buildPdfOptions]
  );

  return { isExporting, exportProgress, handleExport };
}
