
"use client";

import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ObligationDocument } from "@/types/obligations";
import { exportObligationToPDF } from "@/services/pdf-export.service";

interface PrintButtonProps {
    document: ObligationDocument;
    className?: string;
}

export function PrintButton({ document, className }: PrintButtonProps) {
  const handlePrint = async () => {
    try {
      const pdfData = await exportObligationToPDF(document, {
        includeTableOfContents: true,
        includePageNumbers: true,
        includeLogo: false,
      });

      const blob = new Blob([pdfData], { type: "application/pdf" });
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
        window.alert("Σφάλμα κατά την εκτύπωση. Παρακαλώ δοκιμάστε ξανά.");
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
      <Printer className="h-4 w-4" />
      Εκτύπωση
    </Button>
  );
}
