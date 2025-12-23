'use client';

import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { 
  Upload, 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  Eye,
  EyeOff,
  Grid,
  Layers,
  MousePointer,
  Plus,
  Ruler,
  Move
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIconSizes } from '@/hooks/useIconSizes';

type ViewMode = 'view' | 'create' | 'measure' | 'edit';

interface ViewerToolbarProps {
  viewMode?: ViewMode;
  onViewModeChange?: (mode: ViewMode) => void;
  onPdfUpload?: (file: File) => void;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onResetView?: () => void;
  scale?: number;
  isReadOnly?: boolean;
  currentFloor?: any;
  onFloorChange?: (floor: any) => void;
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
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    console.log('📄 PDF selected:', file.name);

    if (file.type !== 'application/pdf') {
      alert('Please select a PDF file');
      return;
    }

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
      alert('PDF upload failed');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="flex items-center gap-3 p-3 bg-white border-b border-gray-200">
      
      {/* PDF UPLOAD */}
      <div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          onChange={handleFileSelect}
          className="hidden"
        />
        <Button
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          variant="outline"
          size="sm"
        >
          <Upload className={`${iconSizes.sm} mr-2`} />
          {isUploading ? 'Loading...' : 'Upload PDF'}
        </Button>
      </div>

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
      <div className="ml-auto text-sm text-gray-600">
        Zoom: {Math.round(scale * 100)}% | Mode: {viewMode}
      </div>
    </div>
  );
}
