"use client";

import { useCallback, useState, useRef } from "react";
import { exportObligationToPDF, downloadPDF } from "@/services/pdf-export.service";
import { generateFileName } from "@/lib/obligations-utils";
import type { ObligationDocument } from "@/types/obligations";
import type { ExportOptions, ExportBuildOptions } from "../types";
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('usePdfExport');

const safe = (value?: string | number): string => {
  if (value === undefined || value === null) {
    return '';
  }
  return String(value).trim();
};

const buildEnterpriseFileName = (document: ObligationDocument): string => {
  const docNumber = safe(document.docNumber);
  const revision = document.revision !== undefined ? `r${document.revision}` : '';
  const projectName = safe(document.projectName).replace(/\s+/g, '-');
  const baseTitle = safe(document.title);

  const tokens = [docNumber, revision, projectName, baseTitle].filter((token) => token.length > 0);
  if (tokens.length === 0) {
    return generateFileName('obligation', 'pdf');
  }

  const normalized = tokens.join('_').toLowerCase();
  return generateFileName(normalized, 'pdf');
};

const canSharePdf = (): boolean => {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') {
    return false;
  }
  return typeof navigator.share === 'function' && typeof navigator.canShare === 'function';
};

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

  const exportPdfBlob = useCallback(async (options: ExportOptions): Promise<{ blob: Blob; filename: string }> => {
    const pdfData = await exportObligationToPDF(document, buildPdfOptions(options));
    const filename = buildEnterpriseFileName(document);
    const blob = new Blob([pdfData as BlobPart], { type: "application/pdf" });
    return { blob, filename };
  }, [buildPdfOptions, document]);

  const handleShare = useCallback(
    async (options: ExportOptions): Promise<boolean> => {
      if (!canSharePdf()) {
        return false;
      }

      try {
        const { blob, filename } = await exportPdfBlob(options);
        const file = new File([blob], filename, { type: 'application/pdf' });
        if (navigator.canShare && !navigator.canShare({ files: [file] })) {
          return false;
        }

        await navigator.share({
          files: [file],
          title: document.title,
          text: document.projectName,
        });

        return true;
      } catch (err) {
        logger.error('Error sharing PDF', { error: err });
        return false;
      }
    },
    [document.projectName, document.title, exportPdfBlob]
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

        const { blob, filename } = await exportPdfBlob(options);

        if (timer) {
          clearInterval(timer);
        }
        setExportProgress(100);

        if (openPreview) {
          const url = URL.createObjectURL(blob);
          if (typeof window !== "undefined") {
            window.open(url, "_blank");
          }
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        } else {
          const arrayBuffer = await blob.arrayBuffer();
          downloadPDF(new Uint8Array(arrayBuffer), filename);
        }
      } catch (err) {
        logger.error('Error exporting PDF', { error: err });
        if (typeof window !== "undefined") {
          window.alert("Σφάλμα κατά την εξαγωγή PDF. Παρακαλώ δοκιμάστε ξανά.");
        }
      } finally {
        if (timer) {
          clearInterval(timer);
        }
        setTimeout(() => {
          setExportProgress(0);
          setIsExporting(false);
        }, 800);
      }
    },
    [exportPdfBlob]
  );

  return { isExporting, exportProgress, handleExport, handleShare };
}
