
'use client';

import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";

interface FileUploaderProps {
  onFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

export function FileUploader({ onFileUpload }: FileUploaderProps) {
  return (
    <div className="flex items-center gap-1">
      <input
        type="file"
        accept=".pdf,.dwg,.dxf"
        onChange={onFileUpload}
        className="hidden"
        id="floor-plan-upload"
      />
      <Button
        variant="outline"
        size="sm"
        onClick={() => document.getElementById('floor-plan-upload')?.click()}
      >
        <Upload className="h-4 w-4 mr-2" />
        Φόρτωση
      </Button>
    </div>
  );
}
