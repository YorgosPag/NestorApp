"use client";

import { Button } from "@/components/ui/button";
import { Eye, Printer } from "lucide-react";
import { getToggleTocAriaLabel } from '../utils/a11y';

interface PreviewHeaderProps {
  showToc: boolean;
  onToggleToc: () => void;
  onPrint: () => void;
}

export function PreviewHeader({ showToc, onToggleToc, onPrint }: PreviewHeaderProps) {
  return (
    <div className="flex items-center justify-between p-4 border-b bg-gray-50">
      <div className="flex items-center gap-3">
        <Eye className="h-5 w-5 text-gray-600" />
        <div>
          <h3 className="font-medium">Προεπισκόπηση</h3>
          <p className="text-sm text-gray-600">Live preview του εγγράφου</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onToggleToc}
          className="text-xs"
          aria-pressed={showToc}
          aria-label={getToggleTocAriaLabel(showToc)}
        >
          {showToc ? "Απόκρυψη" : "Εμφάνιση"} Περιεχομένων
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onPrint}
          className="text-xs"
          aria-label="Εκτύπωση εγγράφου"
        >
          <Printer className="h-4 w-4 mr-1" />
          Εκτύπωση
        </Button>
      </div>
    </div>
  );
}
