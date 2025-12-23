'use client';

import React, { useState } from 'react';
import {
  Upload,
  Layers,
  Eye,
  EyeOff,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Grid,
  Ruler,
  MousePointer,
  Plus,
  Move,
  Settings,
  Download,
  Maximize
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { HOVER_BACKGROUND_EFFECTS } from '@/components/ui/effects';
import { useIconSizes } from '@/hooks/useIconSizes';

type ViewMode = 'view' | 'create' | 'measure' | 'edit';

interface FloorPlanToolbarProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  showGrid: boolean;
  onGridToggle: () => void;
  showLayers: boolean;
  onLayersToggle: () => void;
  showPDF: boolean;
  onPDFToggle: () => void;
  onPDFUpload: (file: File) => void;
  canZoom?: boolean;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onResetView?: () => void;
  onFullscreen?: () => void;
  className?: string;
}

export function FloorPlanToolbar({
  viewMode,
  onViewModeChange,
  showGrid,
  onGridToggle,
  showLayers,
  onLayersToggle,
  showPDF,
  onPDFToggle,
  onPDFUpload,
  canZoom = true,
  onZoomIn,
  onZoomOut,
  onResetView,
  onFullscreen,
  className
}: FloorPlanToolbarProps) {
  const iconSizes = useIconSizes();
  const [isUploading, setIsUploading] = useState(false);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      setIsUploading(true);
      onPDFUpload(file);
      
      // Reset after upload
      setTimeout(() => {
        setIsUploading(false);
        event.target.value = '';
      }, 2000);
    } else {
      alert('Παρακαλώ επιλέξτε ένα PDF αρχείο');
    }
  };

  const ToolbarButton = ({ 
    icon: Icon, 
    label, 
    active = false, 
    onClick, 
    disabled = false,
    variant = "outline"
  }: {
    icon: any;
    label: string;
    active?: boolean;
    onClick?: () => void;
    disabled?: boolean;
    variant?: "outline" | "default" | "ghost";
  }) => (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant={active ? "default" : variant}
          size="sm"
          onClick={onClick}
          disabled={disabled}
          className={cn(
            "h-8 w-8 p-0",
            active && `bg-blue-600 text-white ${HOVER_BACKGROUND_EFFECTS.BLUE_BUTTON}`
          )}
        >
          <Icon className={iconSizes.sm} />
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <p>{label}</p>
      </TooltipContent>
    </Tooltip>
  );

  return (
    <TooltipProvider>
      <div className={cn(
        "flex items-center gap-2 p-3 bg-white border-b border-gray-200 shadow-sm",
        className
      )}>
        
        {/* FILE OPERATIONS */}
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <div>
                <input
                  type="file"
                  accept=".pdf"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="pdf-upload"
                />
                <Button
                  variant="outline"
                  size="sm"
                  asChild
                  disabled={isUploading}
                  className="h-8"
                >
                  <label htmlFor="pdf-upload" className="cursor-pointer">
                    <Upload className={`${iconSizes.sm} mr-2`} />
                    {isUploading ? 'Φόρτωση...' : 'Φόρτωση PDF'}
                  </label>
                </Button>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>Φόρτωση κάτοψης PDF</p>
            </TooltipContent>
          </Tooltip>
        </div>

        <Separator orientation="vertical" className="h-6" />

        {/* VIEW MODES */}
        <div className="flex items-center gap-1">
          <ToolbarButton
            icon={MousePointer}
            label="Προβολή"
            active={viewMode === 'view'}
            onClick={() => onViewModeChange('view')}
          />
          <ToolbarButton
            icon={Plus}
            label="Δημιουργία"
            active={viewMode === 'create'}
            onClick={() => onViewModeChange('create')}
          />
          <ToolbarButton
            icon={Ruler}
            label="Μέτρηση"
            active={viewMode === 'measure'}
            onClick={() => onViewModeChange('measure')}
          />
          <ToolbarButton
            icon={Move}
            label="Επεξεργασία"
            active={viewMode === 'edit'}
            onClick={() => onViewModeChange('edit')}
          />
        </div>

        <Separator orientation="vertical" className="h-6" />

        {/* LAYER CONTROLS */}
        <div className="flex items-center gap-1">
          <ToolbarButton
            icon={showPDF ? Eye : EyeOff}
            label={showPDF ? "Απόκρυψη PDF" : "Εμφάνιση PDF"}
            active={showPDF}
            onClick={onPDFToggle}
          />
          <ToolbarButton
            icon={Grid}
            label={showGrid ? "Απόκρυψη Grid" : "Εμφάνιση Grid"}
            active={showGrid}
            onClick={onGridToggle}
          />
          <ToolbarButton
            icon={Layers}
            label={showLayers ? "Απόκρυψη Layers" : "Εμφάνιση Layers"}
            active={showLayers}
            onClick={onLayersToggle}
          />
        </div>

        {canZoom && (
          <>
            <Separator orientation="vertical" className="h-6" />

            {/* ZOOM CONTROLS */}
            <div className="flex items-center gap-1">
              <ToolbarButton
                icon={ZoomIn}
                label="Μεγέθυνση"
                onClick={onZoomIn}
                disabled={!onZoomIn}
              />
              <ToolbarButton
                icon={ZoomOut}
                label="Σμίκρυνση"
                onClick={onZoomOut}
                disabled={!onZoomOut}
              />
              <ToolbarButton
                icon={RotateCcw}
                label="Επαναφορά View"
                onClick={onResetView}
                disabled={!onResetView}
              />
            </div>
          </>
        )}

        <Separator orientation="vertical" className="h-6" />

        {/* ADDITIONAL CONTROLS */}
        <div className="flex items-center gap-1">
          <ToolbarButton
            icon={Maximize}
            label="Πλήρης Οθόνη"
            onClick={onFullscreen}
            disabled={!onFullscreen}
          />
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 w-8 p-0">
                <Settings className={iconSizes.sm} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>
                <Download className={`${iconSizes.sm} mr-2`} />
                Εξαγωγή PNG
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Download className={`${iconSizes.sm} mr-2`} />
                Εξαγωγή PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* STATUS INFO */}
        <div className="ml-auto flex items-center gap-2 text-sm text-gray-600">
          <span className="capitalize">Λειτουργία: {viewMode}</span>
          {showPDF && <span className="text-green-600">• PDF Active</span>}
        </div>
      </div>
    </TooltipProvider>
  );
}
