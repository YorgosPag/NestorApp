
"use client";

import { Button } from "@/components/ui/button";
import { Eye, Download } from "lucide-react";

interface ActionsBarProps {
  onPreview: () => void;
  onDownload: () => void;
  onCancel: () => void;
}

export function ActionsBar({ onPreview, onDownload, onCancel }: ActionsBarProps) {
  return (
    <div className="flex items-center gap-3 pt-4 border-t">
      <Button
        onClick={onPreview}
        variant="outline"
        className="flex items-center gap-2"
      >
        <Eye className="h-4 w-4" />
        Προεπισκόπηση
      </Button>

      <Button
        onClick={onDownload}
        className="flex items-center gap-2 flex-1"
      >
        <Download className="h-4 w-4" />
        Κατέβασμα PDF
      </Button>

      <Button variant="ghost" onClick={onCancel}>
        Ακύρωση
      </Button>
    </div>
  );
}
