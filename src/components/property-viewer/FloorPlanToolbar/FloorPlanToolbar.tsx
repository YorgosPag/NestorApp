'use client';

import React, { useState } from 'react';
import {
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
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';
// 🏢 ADR-054: Centralized upload component
import { FileUploadButton } from '@/components/shared/files/FileUploadButton';

type ViewMode = 'view' | 'create' | 'measure' | 'edit';

export interface FloorPlanToolbarProps {
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
  const { quick } = useBorderTokens();
  const colors = useSemanticColors();
  // 🏢 ENTERPRISE: i18n support
  const { t } = useTranslation('properties');
  const [isUploading, setIsUploading] = useState(false);

  // 🏢 ADR-054: Centralized file upload handler
  const handleFileUpload = (file: File) => {
    setIsUploading(true);
    onPDFUpload(file);

    // Reset after upload
    setTimeout(() => {
      setIsUploading(false);
    }, 2000);
  };

  const ToolbarButton = ({ 
    icon: Icon, 
    label, 
    active = false, 
    onClick, 
    disabled = false,
    variant = "outline"
  }: {
    icon: React.ComponentType<{ className?: string }>;
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
            "${iconSizes.xl} p-0",
            active && `${colors.bg.info} ${colors.text.inverted} ${HOVER_BACKGROUND_EFFECTS.BLUE_BUTTON}`
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
        `flex items-center gap-2 p-3 ${colors.bg.primary} ${quick.separatorH} shadow-sm`,
        className
      )}>
        
        {/* FILE OPERATIONS - ADR-054: Using centralized FileUploadButton */}
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <div>
                <FileUploadButton
                  onFileSelect={handleFileUpload}
                  accept=".pdf"
                  fileType="pdf"
                  buttonText={isUploading ? t('floorPlanToolbar.uploading') : t('floorPlanToolbar.uploadPDF')}
                  loading={isUploading}
                  variant="outline"
                  size="sm"
                  className="h-8"
                />
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>{t('floorPlanToolbar.uploadTooltip')}</p>
            </TooltipContent>
          </Tooltip>
        </div>

        <Separator orientation="vertical" className="h-6" />

        {/* VIEW MODES */}
        <div className="flex items-center gap-1">
          <ToolbarButton
            icon={MousePointer}
            label={t('floorPlanToolbar.viewModes.view')}
            active={viewMode === 'view'}
            onClick={() => onViewModeChange('view')}
          />
          <ToolbarButton
            icon={Plus}
            label={t('floorPlanToolbar.viewModes.create')}
            active={viewMode === 'create'}
            onClick={() => onViewModeChange('create')}
          />
          <ToolbarButton
            icon={Ruler}
            label={t('floorPlanToolbar.viewModes.measure')}
            active={viewMode === 'measure'}
            onClick={() => onViewModeChange('measure')}
          />
          <ToolbarButton
            icon={Move}
            label={t('floorPlanToolbar.viewModes.edit')}
            active={viewMode === 'edit'}
            onClick={() => onViewModeChange('edit')}
          />
        </div>

        <Separator orientation="vertical" className="h-6" />

        {/* LAYER CONTROLS */}
        <div className="flex items-center gap-1">
          <ToolbarButton
            icon={showPDF ? Eye : EyeOff}
            label={showPDF ? t('floorPlanToolbar.layers.hidePDF') : t('floorPlanToolbar.layers.showPDF')}
            active={showPDF}
            onClick={onPDFToggle}
          />
          <ToolbarButton
            icon={Grid}
            label={showGrid ? t('floorPlanToolbar.layers.hideGrid') : t('floorPlanToolbar.layers.showGrid')}
            active={showGrid}
            onClick={onGridToggle}
          />
          <ToolbarButton
            icon={Layers}
            label={showLayers ? t('floorPlanToolbar.layers.hideLayers') : t('floorPlanToolbar.layers.showLayers')}
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
                label={t('floorPlanToolbar.zoom.zoomIn')}
                onClick={onZoomIn}
                disabled={!onZoomIn}
              />
              <ToolbarButton
                icon={ZoomOut}
                label={t('floorPlanToolbar.zoom.zoomOut')}
                onClick={onZoomOut}
                disabled={!onZoomOut}
              />
              <ToolbarButton
                icon={RotateCcw}
                label={t('floorPlanToolbar.zoom.resetView')}
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
            label={t('floorPlanToolbar.fullscreen')}
            onClick={onFullscreen}
            disabled={!onFullscreen}
          />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="${iconSizes.xl} p-0">
                <Settings className={iconSizes.sm} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>
                <Download className={`${iconSizes.sm} mr-2`} />
                {t('floorPlanToolbar.export.exportPNG')}
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Download className={`${iconSizes.sm} mr-2`} />
                {t('floorPlanToolbar.export.exportPDF')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* STATUS INFO */}
        <div className={`ml-auto flex items-center gap-2 text-sm ${colors.text.muted}`}>
          <span className="capitalize">{t('floorPlanToolbar.status.mode')} {viewMode}</span>
          {showPDF && <span className={`${colors.text.success}`}>• {t('floorPlanToolbar.status.pdfActive')}</span>}
        </div>
      </div>
    </TooltipProvider>
  );
}
