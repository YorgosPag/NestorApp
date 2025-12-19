
import type { ObligationDocument } from "@/types/obligations";

export interface PDFExportButtonProps {
  document: ObligationDocument;
  variant?: "default" | "outline" | "ghost";
  size?: "sm" | "default" | "lg";
  showPreview?: boolean;
  className?: string;
}

export interface ExportOptions {
  includeTableOfContents: boolean;
  includePageNumbers: boolean;
  includeLogo: boolean;
  logoUrl?: string;
  watermark?: string;
  quality: "standard" | "high";
}

export interface ExportBuildOptions {
  includeTableOfContents: boolean;
  includePageNumbers: boolean;
  includeLogo: boolean;
  logoUrl?: string;
  watermark?: string;
  margins?: { top: number; right: number; bottom: number; left: number };
}
