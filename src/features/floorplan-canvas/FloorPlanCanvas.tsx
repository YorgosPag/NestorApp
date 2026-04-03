'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { SafePDFLoader } from '@/components/common/SafePDFLoader';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import {
  floorPlanStyles,
  createPdfLayerStyle,
  createPdfLoaderDimensions,
  getMemoizedButtonStyle,
  floorPlanAccessibility
} from './FloorPlanCanvas.styles';

import type {
  FloorPlanCanvasProps
} from './types';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { createModuleLogger } from '@/lib/telemetry';
import '@/lib/design-system';
const logger = createModuleLogger('FloorPlanCanvas');

export function FloorPlanCanvas({
  floorData: _floorData,
  onFloorDataChange: _onFloorDataChange,
  mode: _mode = 'view',
  selectedPropertyId: _selectedPropertyId,
  onPropertySelect: _onPropertySelect,
  onPropertyCreate: _onPropertyCreate,
  onPropertyUpdate: _onPropertyUpdate,
  isReadOnly: _isReadOnly = false,
  className,
  pdfBackgroundUrl,
  enableGrid: _enableGrid = true,
  enableMeasurements: _enableMeasurements = true,
  enableConnections: _enableConnections = false,
  showStatusLegend: _showStatusLegend = true,
  showPropertyCount: _showPropertyCount = true,
  connectionPairs: _connectionPairs = [],
  onConnectionPairsChange: _onConnectionPairsChange,
  onModeChange: _onModeChange,
  validationErrors: _validationErrors = []
}: FloorPlanCanvasProps) {
  const { getStatusBorder } = useBorderTokens();
  const colors = useSemanticColors();
  const { t } = useTranslation('properties');

  // PDF state
  const [numPages, setNumPages] = useState<number>(0);
  const [pdfLoadError, setPdfLoadError] = useState<string | null>(null);
  const [isPdfReady, setIsPdfReady] = useState<boolean>(false);
  const [testMode, setTestMode] = useState<'hidden' | 'normal' | 'fullscreen'>('normal');

  // PDF handling
  const handlePDFLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setIsPdfReady(true);
    setPdfLoadError(null);
    
    logger.info('PDF loaded for FULLSCREEN test:', { data: { numPages, url: pdfBackgroundUrl } });
  };

  const handlePDFLoadError = (error: Error) => {
    setPdfLoadError(error.message);
    setIsPdfReady(false);
    setNumPages(0);
    
    logger.error('PDF load error:', { error: error });
  };

  logger.info('FULLSCREEN PDF TEST:', { data: {
    pdfBackgroundUrl: pdfBackgroundUrl ? 'PROVIDED' : 'NONE',
    isPdfReady,
    testMode,
    pdfLoadError
  } });

  return (
    <main
      className={cn('relative w-full h-full overflow-hidden', className)}
      style={floorPlanStyles.container}
      {...floorPlanAccessibility.getContainerProps()}
    >
      
      {/* DEBUG INFO - TOP LEFT */}
      <aside
        className={`absolute top-4 left-4 ${colors.bg.warning} text-black p-3 rounded font-mono text-sm z-50`}
        style={floorPlanStyles.debugInfo}
        {...floorPlanAccessibility.getDebugPanelProps()}
      >
        <div>{t('floorPlan.canvas.debugTitle')}</div>
        <div>{t('floorPlan.canvas.debugPdfUrl')}: {pdfBackgroundUrl ? t('floorPlan.canvas.debugExists') : t('floorPlan.canvas.debugNone')}</div>
        <div>{t('floorPlan.canvas.debugPdfReady')}: {isPdfReady ? t('floorPlan.canvas.debugYes') : t('floorPlan.canvas.debugNo')}</div>
        <div>{t('floorPlan.canvas.debugPages')}: {numPages}</div>
        <div>{t('floorPlan.canvas.debugTestMode')}: {testMode}</div>
        <div>{t('floorPlan.canvas.debugError')}: {pdfLoadError || t('floorPlan.canvas.debugNone')}</div>
      </aside>

      {/* TEST MODE BUTTONS - TOP RIGHT */}
      <nav
        className="absolute top-4 right-4 flex gap-2 z-50"
        style={floorPlanStyles.testControls}
        {...floorPlanAccessibility.getTestControlsProps()}
      >
        <button
          onClick={() => setTestMode('hidden')}
          style={getMemoizedButtonStyle(testMode, 'hidden')}
          aria-pressed={testMode === 'hidden'}
          aria-label="Hide PDF display mode"
        >
          {t('floorPlan.canvas.modeHidden')}
        </button>
        <button
          onClick={() => setTestMode('normal')}
          style={getMemoizedButtonStyle(testMode, 'normal')}
          aria-pressed={testMode === 'normal'}
          aria-label="Normal PDF display mode"
        >
          {t('floorPlan.canvas.modeNormal')}
        </button>
        <button
          onClick={() => setTestMode('fullscreen')}
          style={getMemoizedButtonStyle(testMode, 'fullscreen')}
          aria-pressed={testMode === 'fullscreen'}
          aria-label="Fullscreen PDF display mode"
        >
          {t('floorPlan.canvas.modeFullscreen')}
        </button>
      </nav>

      {/* BACKGROUND CANVAS */}
      <canvas
        width={800}
        height={600}
        className="absolute inset-0"
        style={floorPlanStyles.backgroundCanvas}
        {...floorPlanAccessibility.getCanvasProps(testMode)}
      />

      {/* PDF LAYER - CONDITIONAL DISPLAY */}
      {pdfBackgroundUrl && testMode !== 'hidden' && (
        <section
          className="absolute"
          style={createPdfLayerStyle(testMode)}
          aria-label={`PDF display in ${testMode} mode`}
        >
          <div className={`w-full h-full ${colors.bg.primary} border-4 ${getStatusBorder('info')}`}>
            {/* Enterprise Note: border-4 is legitimate thick frame για PDF background layer visual separation */}
            <SafePDFLoader
              file={pdfBackgroundUrl}
              {...createPdfLoaderDimensions(testMode)}
              pageNumber={1}
              onLoadSuccess={handlePDFLoadSuccess}
              onLoadError={handlePDFLoadError}
              className="w-full h-full"
              fallbackMessage="FULLSCREEN PDF TEST"
            />
          </div>
        </section>
      )}

      {/* BIG WARNING IF NO PDF */}
      {!pdfBackgroundUrl && (
        <section
          className={`absolute inset-0 flex items-center justify-center ${colors.bg.warning} text-white text-4xl font-bold z-50`}
          style={floorPlanStyles.warningOverlay}
          {...floorPlanAccessibility.getOverlayProps('warning')}
        >
          {t('floorPlan.canvas.noPdfProvided')}
        </section>
      )}

      {/* PDF NOT READY WARNING */}
      {pdfBackgroundUrl && !isPdfReady && !pdfLoadError && (
        <section
          className={`absolute inset-0 flex items-center justify-center ${colors.bg.info} text-white text-2xl font-bold z-50`}
          style={floorPlanStyles.loadingOverlay}
          {...floorPlanAccessibility.getOverlayProps('loading')}
        >
          {t('floorPlan.canvas.pdfLoading')}
        </section>
      )}

      {/* PDF ERROR WARNING */}
      {pdfLoadError && (
        <section
          className={`absolute inset-0 flex items-center justify-center ${colors.bg.error} text-white text-xl font-bold z-50 p-4`}
          style={floorPlanStyles.errorOverlay}
          {...floorPlanAccessibility.getOverlayProps('error')}
        >
          <div className="text-center">
            {t('floorPlan.canvas.pdfError')}<br/>
            {pdfLoadError}
          </div>
        </section>
      )}

      {/* SUCCESS MESSAGE */}
      {isPdfReady && pdfBackgroundUrl && (
        <section
          className={`absolute bottom-4 left-1/2 transform -translate-x-1/2 ${colors.bg.success} text-white px-6 py-3 rounded-lg font-bold text-lg z-50`}
          style={floorPlanStyles.successMessage}
          {...floorPlanAccessibility.getOverlayProps('success')}
        >
          {t('floorPlan.canvas.pdfLoaded', { count: numPages })}
        </section>
      )}

      {/* INSTRUCTIONS */}
      <aside
        id="floorplan-instructions"
        className={`absolute bottom-4 right-4 ${colors.bg.elevated} text-white p-3 rounded max-w-sm text-xs z-50`}
        style={floorPlanStyles.instructions}
        role="complementary"
        aria-label="Test instructions"
      >
        <div className="font-bold mb-2">{t('floorPlan.canvas.testInstructions')}</div>
        <div>1. {t('floorPlan.canvas.testStep1')}</div>
        <div>2. {t('floorPlan.canvas.testStep2')}</div>
        <div>3. {t('floorPlan.canvas.testStep3')}</div>
        <div>4. {t('floorPlan.canvas.testStep4')}</div>
      </aside>
    </main>
  );
}
