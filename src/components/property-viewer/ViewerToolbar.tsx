'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  MousePointer,
  Plus,
  Ruler,
  Move
} from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/hooks/useSemanticColors';
// 🏢 ADR-054: Centralized upload component
import { FileUploadButton } from '@/components/shared/files/FileUploadButton';

type ViewMode = 'view' | 'create' | 'measure' | 'edit';

/** Floor data structure */
interface FloorData {
  id: string;
  name?: string;
  floorPlanUrl?: string;
  metadata?: {
    lastPDFUpdate?: string;
    pdfFileName?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

interface ViewerToolbarProps {
  viewMode?: ViewMode;
  onViewModeChange?: (mode: ViewMode) => void;
  onPdfUpload?: (file: File) => void;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onResetView?: () => void;
  scale?: number;
  isReadOnly?: boolean;
  currentFloor?: FloorData;
  onFloorChange?: (floor: FloorData) => void;
}

export function ViewerToolbar({
  viewMode = 'view',
  onViewModeChange,
  onPdfUpload,
  onZoomIn,
  onZoomOut,
  onResetView,
  scale = 1,
  isReadOnly = false,
  currentFloor,
  onFloorChange
}: ViewerToolbarProps) {
  const iconSizes = useIconSizes();
  const { quick } = useBorderTokens();
  const colors = useSemanticColors();

  const [isUploading, setIsUploading] = useState(false);

  // 🏢 ADR-054: Centralized file upload handler
  const handleFileSelect = async (file: File) => {
    console.log('📄 PDF selected:', file.name);

    setIsUploading(true);

    try {
      const pdfUrl = URL.createObjectURL(file);
      console.log('✅ PDF URL created');

      if (onPdfUpload) {
        onPdfUpload(file);
      }

      if (onFloorChange && currentFloor) {
        onFloorChange({
          ...currentFloor,
          floorPlanUrl: pdfUrl,
          metadata: {
            ...currentFloor.metadata,
            lastPDFUpdate: new Date().toISOString(),
            pdfFileName: file.name
          }
        });
      }

    } catch (error) {
      console.error('PDF upload error:', error);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className={`flex items-center gap-3 p-3 ${colors.bg.primary} ${quick.separatorH}`}>
      
      {/* PDF UPLOAD - ADR-054: Using centralized FileUploadButton */}
      <FileUploadButton
        onFileSelect={handleFileSelect}
        accept=".pdf"
        fileType="pdf"
        buttonText={isUploading ? 'Loading...' : 'Upload PDF'}
        loading={isUploading}
        variant="outline"
        size="sm"
      />

      <Separator orientation="vertical" className="h-6" />

      {/* VIEW MODES */}
      <div className="flex gap-1">
        <Button
          variant={viewMode === 'view' ? 'default' : 'outline'}
          size="sm"
          onClick={() => onViewModeChange?.('view')}
        >
          <MousePointer className={`${iconSizes.sm} mr-1`} />
          View
        </Button>
        <Button
          variant={viewMode === 'create' ? 'default' : 'outline'}
          size="sm"
          onClick={() => onViewModeChange?.('create')}
        >
          <Plus className={`${iconSizes.sm} mr-1`} />
          Create
        </Button>
        <Button
          variant={viewMode === 'measure' ? 'default' : 'outline'}
          size="sm"
          onClick={() => onViewModeChange?.('measure')}
        >
          <Ruler className={`${iconSizes.sm} mr-1`} />
          Measure
        </Button>
        <Button
          variant={viewMode === 'edit' ? 'default' : 'outline'}
          size="sm"
          onClick={() => onViewModeChange?.('edit')}
        >
          <Move className={`${iconSizes.sm} mr-1`} />
          Edit
        </Button>
      </div>

      <Separator orientation="vertical" className="h-6" />

      {/* ZOOM CONTROLS */}
      <div className="flex gap-1">
        <Button variant="outline" size="sm" onClick={onZoomIn} className={`${iconSizes.xl} p-0`}>
          <ZoomIn className={iconSizes.sm} />
        </Button>
        <Button variant="outline" size="sm" onClick={onZoomOut} className={`${iconSizes.xl} p-0`}>
          <ZoomOut className={iconSizes.sm} />
        </Button>
        <Button variant="outline" size="sm" onClick={onResetView} className={`${iconSizes.xl} p-0`}>
          <RotateCcw className={iconSizes.sm} />
        </Button>
      </div>

      {/* STATUS */}
      <div className={`ml-auto text-sm ${colors.text.secondary}`}>
        Zoom: {Math.round(scale * 100)}% | Mode: {viewMode}
      </div>
    </div>
  );
}
