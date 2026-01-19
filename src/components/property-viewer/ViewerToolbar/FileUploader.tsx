
'use client';

import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";
import { useIconSizes } from '@/hooks/useIconSizes';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';

interface FileUploaderProps {
  onFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

export function FileUploader({ onFileUpload }: FileUploaderProps) {
  const iconSizes = useIconSizes();
  // 🏢 ENTERPRISE: i18n hook
  const { t } = useTranslation('properties');

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
        {t('fileUploader.upload')}
      </Button>
    </div>
  );
}
