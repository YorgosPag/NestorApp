
'use client';

import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";
import { useIconSizes } from '@/hooks/useIconSizes';

interface FileUploaderProps {
  onFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

export function FileUploader({ onFileUpload }: FileUploaderProps) {
  const iconSizes = useIconSizes();
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
        <Upload className={`${iconSizes.sm} mr-2`} />
        Φόρτωση
      </Button>
    </div>
  );
}
