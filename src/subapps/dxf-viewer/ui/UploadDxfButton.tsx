'use client';
import React, { useState } from 'react';
import DxfImportModal from '../components/DxfImportModal';
import { useIconSizes } from '@/hooks/useIconSizes';
import { Upload } from 'lucide-react';
// 🏢 ENTERPRISE: Shadcn Button (NO BORDERS - same as CompactToolbar)
import { Button } from '@/components/ui/button';
// 🏢 ENTERPRISE: Centralized spacing tokens
import { PANEL_LAYOUT } from '../config/panel-tokens';
// 🏢 ENTERPRISE: Shadcn Tooltip (replaces native title attribute)
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
// 🎨 ENTERPRISE: Centralized DXF toolbar colors - Single source of truth
import { DXF_ACTION_COLORS } from '../config/toolbar-colors';

interface Props {
  className?: string;
  title?: string;
  onFileSelect?: (file: File, encoding?: string) => void;
}

export default function UploadDxfButton({
  className,
  title = 'Upload DXF',
  onFileSelect
}: Props) {
  const iconSizes = useIconSizes();
  const [showModal, setShowModal] = useState(false);

  const handleImport = async (file: File, encoding: string) => {
    onFileSelect?.(file, encoding);
  };

  const handleButtonClick = () => {
    setShowModal(true);
  };

  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleButtonClick}
              aria-label={title}
              className={`${iconSizes.xl} p-0 ${className}`}
            >
              {/* 🎨 ENTERPRISE: Auto-assigned from DXF_ACTION_COLORS.import */}
              <Upload className={`${iconSizes.sm} ${DXF_ACTION_COLORS.import}`} />
            </Button>
          </TooltipTrigger>
          {title && <TooltipContent>{title}</TooltipContent>}
        </Tooltip>
      </TooltipProvider>

      <DxfImportModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onImport={handleImport}
      />
    </>
  );
}
