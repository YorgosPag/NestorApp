'use client';

/**
 * @module PdfControlsPanel
 * @description Enterprise-grade PDF background controls panel
 *
 * Uses FloatingPanel compound component (ADR-003) for consistent UI.
 * Provides controls for PDF loading, page selection, and transform.
 *
 * @features
 * - File upload for PDF
 * - Page navigation
 * - Independent scale/rotation controls
 * - Opacity control
 * - Enable/disable toggle
 *
 * @see ADR-003 for FloatingPanel compound component
 * @see docs/centralized-systems/reference/adr-index.md
 */

import React, { useCallback } from 'react';
import { FileUp, ChevronLeft, ChevronRight, RotateCcw, Eye, EyeOff, Trash2, ZoomIn, ZoomOut, RotateCw, Maximize2 } from 'lucide-react';
import { FloatingPanel } from '@/components/ui/floating';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { usePdfBackgroundStore } from '../stores/pdfBackgroundStore';
// 🏢 ENTERPRISE: Centralized panel dimensions (ADR-029)
import { PANEL_ANCHORING } from '../../config/panel-tokens';
// 🏢 ADR-054: Centralized upload component
import { FileUploadButton } from '@/components/shared/files/FileUploadButton';
// 🏢 ADR-081: Centralized percentage formatting
import { formatPercent } from '../../rendering/entities/shared/distance-label-utils';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Scale step for zoom buttons
 */
const SCALE_STEP = 0.1;

/**
 * Rotation step in degrees
 */
const ROTATION_STEP = 15;

/**
 * Default panel position
 */
const DEFAULT_POSITION = { x: 20, y: 100 };

/**
 * Panel dimensions
 * 🏢 ENTERPRISE: Use centralized panel dimensions (ADR-029)
 */
const PANEL_DIMENSIONS = PANEL_ANCHORING.DIMENSIONS.PDF_CONTROLS;

// ============================================================================
// COMPONENT PROPS
// ============================================================================

interface PdfControlsPanelProps {
  /** Whether panel is visible */
  isOpen: boolean;
  /** Callback when panel is closed */
  onClose: () => void;
  /** Optional className */
  className?: string;
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * PDF Controls Panel Component
 *
 * Floating panel for controlling PDF background settings.
 * Uses FloatingPanel compound component for consistent behavior.
 *
 * @example
 * ```tsx
 * <PdfControlsPanel
 *   isOpen={showPdfPanel}
 *   onClose={() => setShowPdfPanel(false)}
 * />
 * ```
 */
export const PdfControlsPanel: React.FC<PdfControlsPanelProps> = ({
  isOpen,
  onClose,
  className = '',
}) => {
  // ============================================================
  // STORE
  // ============================================================

  const colors = useSemanticColors();

  const {
    enabled,
    opacity,
    documentInfo,
    currentPage,
    transform,
    isLoading,
    error,
    loadPdf,
    unloadPdf,
    setCurrentPage,
    nextPage,
    previousPage,
    resetTransform,
    setEnabled,
    toggleEnabled,
    setOpacity,
    setScale,
    setRotation,
  } = usePdfBackgroundStore();

  // ============================================================
  // HANDLERS
  // ============================================================

  /**
   * 🏢 ADR-054: Handle file selection via centralized FileUploadButton
   */
  const handleFileSelect = useCallback((file: File) => {
    if (file.type === 'application/pdf') {
      loadPdf(file);
    }
  }, [loadPdf]);

  /**
   * Handle scale increase
   */
  const handleZoomIn = useCallback(() => {
    setScale(transform.scale + SCALE_STEP);
  }, [transform.scale, setScale]);

  /**
   * Handle scale decrease
   */
  const handleZoomOut = useCallback(() => {
    setScale(Math.max(0.1, transform.scale - SCALE_STEP));
  }, [transform.scale, setScale]);

  /**
   * Handle rotation clockwise
   */
  const handleRotateCw = useCallback(() => {
    setRotation(transform.rotation + ROTATION_STEP);
  }, [transform.rotation, setRotation]);

  /**
   * Handle rotation counter-clockwise
   */
  const handleRotateCcw = useCallback(() => {
    setRotation(transform.rotation - ROTATION_STEP);
  }, [transform.rotation, setRotation]);

  /**
   * Handle opacity change from slider
   */
  const handleOpacityChange = useCallback((value: number[]) => {
    setOpacity(value[0]);
  }, [setOpacity]);

  /**
   * Handle scale change from slider
   */
  const handleScaleChange = useCallback((value: number[]) => {
    setScale(value[0]);
  }, [setScale]);

  // pdfTransform is identity by default — PDF lives in world (0,0)→(img.width, img.height)
  // Camera fit is handled by useFitToPdf (zoomToFit on canvasTransform).
  // "Fit to view" button resets pdfTransform to identity; auto-fit on load is intentionally absent.
  const handleFitToView = useCallback(() => {
    resetTransform();
  }, [resetTransform]);

  // ============================================================
  // RENDER
  // ============================================================

  if (!isOpen) return null;

  const numPages = documentInfo?.numPages || 0;
  const hasDocument = !!documentInfo;

  return (
      <FloatingPanel
        defaultPosition={DEFAULT_POSITION}
        dimensions={PANEL_DIMENSIONS}
        onClose={onClose}
        className={className}
      >
        <FloatingPanel.Header
          title="PDF Background"
          icon={<FileUp className="h-4 w-4" />}
          actions={
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleEnabled}
              className="h-6 w-6 p-0"
              aria-label={enabled ? 'Hide PDF' : 'Show PDF'}
            >
              {enabled ? (
                <Eye className="h-4 w-4" />
              ) : (
                <EyeOff className="h-4 w-4" />
              )}
            </Button>
          }
        />

        <FloatingPanel.Content>
          <section className="space-y-4">
            {/* Error display */}
            {error && (
              <output
                className="text-sm text-red-500 bg-red-500/10 p-2 rounded"
                role="alert"
              >
                {error}
              </output>
            )}

            {/* File upload section - ADR-054: Using centralized FileUploadButton */}
            {!hasDocument ? (
              <article className="flex flex-col items-center gap-2 py-4">
                <FileUploadButton
                  onFileSelect={handleFileSelect}
                  accept=".pdf,application/pdf"
                  fileType="pdf"
                  buttonText={isLoading ? 'Loading...' : 'Upload PDF'}
                  loading={isLoading}
                  variant="outline"
                  className="w-full"
                  icon={<FileUp className="h-4 w-4 mr-2" />}
                />
                <p className={`text-xs ${colors.text.muted} text-center`}>
                  Select a PDF file to use as background
                </p>
              </article>
            ) : (
              <>
                {/* Document info */}
                <article className="flex items-center justify-between text-sm">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="truncate max-w-[160px]">
                        {documentInfo.fileName}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>{documentInfo.fileName}</TooltipContent>
                  </Tooltip>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={unloadPdf}
                    className="h-6 w-6 p-0 text-red-500 hover:text-red-600 hover:bg-red-500/10"
                    aria-label="Remove PDF"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </article>

                {/* Page navigation */}
                {numPages > 1 && (
                  <article className="space-y-2">
                    <Label className={`text-xs ${colors.text.muted}`}>
                      Page {currentPage} of {numPages}
                    </Label>
                    <nav className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={previousPage}
                        disabled={currentPage <= 1 || isLoading}
                        className="flex-1"
                        aria-label="Previous page"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={nextPage}
                        disabled={currentPage >= numPages || isLoading}
                        className="flex-1"
                        aria-label="Next page"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </nav>
                  </article>
                )}

                {/* Transform controls */}
                <article className="space-y-3 border-t pt-3">
                  {/* Scale control */}
                  <fieldset className="space-y-2">
                    <legend className={`flex items-center justify-between text-xs ${colors.text.muted}`}>
                      <span>Scale</span>
                      <span>{formatPercent(transform.scale)}</span>
                    </legend>
                    <menu className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleZoomOut}
                        className="h-7 w-7 p-0"
                        aria-label="Zoom out"
                      >
                        <ZoomOut className="h-3 w-3" />
                      </Button>
                      <Slider
                        value={[transform.scale]}
                        onValueChange={handleScaleChange}
                        min={0.1}
                        max={3}
                        step={0.05}
                        className="flex-1"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleZoomIn}
                        className="h-7 w-7 p-0"
                        aria-label="Zoom in"
                      >
                        <ZoomIn className="h-3 w-3" />
                      </Button>
                    </menu>
                  </fieldset>

                  {/* Rotation control */}
                  <fieldset className="space-y-2">
                    <legend className={`flex items-center justify-between text-xs ${colors.text.muted}`}>
                      <span>Rotation</span>
                      <span>{transform.rotation}°</span>
                    </legend>
                    <menu className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleRotateCcw}
                        className="h-7 flex-1"
                        aria-label="Rotate counter-clockwise"
                      >
                        <RotateCcw className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleRotateCw}
                        className="h-7 flex-1"
                        aria-label="Rotate clockwise"
                      >
                        <RotateCw className="h-3 w-3" />
                      </Button>
                    </menu>
                  </fieldset>

                  {/* Opacity control */}
                  <fieldset className="space-y-2">
                    <legend className={`flex items-center justify-between text-xs ${colors.text.muted}`}>
                      <span>Opacity</span>
                      <span>{formatPercent(opacity)}</span>
                    </legend>
                    <Slider
                      value={[opacity]}
                      onValueChange={handleOpacityChange}
                      min={0.1}
                      max={1}
                      step={0.05}
                    />
                  </fieldset>

                  {/* Fit to View button */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleFitToView}
                    className="w-full"
                  >
                    <Maximize2 className="h-3 w-3 mr-2" />
                    Fit to View
                  </Button>

                  {/* Reset button */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={resetTransform}
                    className={`w-full ${colors.text.muted}`}
                  >
                    <RotateCcw className="h-3 w-3 mr-2" />
                    Reset Transform
                  </Button>
                </article>
              </>
            )}
          </section>
        </FloatingPanel.Content>
      </FloatingPanel>
  );
};

// ============================================================================
// EXPORTS
// ============================================================================

export default PdfControlsPanel;
