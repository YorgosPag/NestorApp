'use client';

import { useRef, useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { SafePDFLoader } from '@/components/common/SafePDFLoader';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import {
  floorPlanStyles,
  createPdfLayerStyle,
  createPdfLoaderDimensions,
  getMemoizedButtonStyle,
  floorPlanAccessibility
} from './FloorPlanCanvas.styles';

import type {
  FloorPlanCanvasProps,
  Point,
  MeasurementLine,
  PolyLine,
  CanvasMode,
  FloorData,
  UIState,
  ValidationError
} from './types';

export function FloorPlanCanvas({
  floorData,
  onFloorDataChange,
  mode = 'view',
  selectedPropertyId,
  onPropertySelect,
  onPropertyCreate,
  onPropertyUpdate,
  isReadOnly = false,
  className,
  pdfBackgroundUrl,
  enableGrid = true,
  enableMeasurements = true,
  enableConnections = false,
  showStatusLegend = true,
  showPropertyCount = true,
  connectionPairs = [],
  onConnectionPairsChange,
  onModeChange,
  validationErrors = []
}: FloorPlanCanvasProps) {
  const { getStatusBorder } = useBorderTokens();

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
    
    console.log('✅ PDF loaded for FULLSCREEN test:', { numPages, url: pdfBackgroundUrl });
  };

  const handlePDFLoadError = (error: Error) => {
    setPdfLoadError(error.message);
    setIsPdfReady(false);
    setNumPages(0);
    
    console.error('❌ PDF load error:', error);
  };

  console.log('🎯 FULLSCREEN PDF TEST:', {
    pdfBackgroundUrl: pdfBackgroundUrl ? 'PROVIDED' : 'NONE',
    isPdfReady,
    testMode,
    pdfLoadError
  });

  return (
    <main
      className={cn('relative w-full h-full overflow-hidden', className)}
      style={floorPlanStyles.container}
      {...floorPlanAccessibility.getContainerProps()}
    >
      
      {/* DEBUG INFO - TOP LEFT */}
      <aside
        className="absolute top-4 left-4 bg-yellow-400 text-black p-3 rounded font-mono text-sm z-50"
        style={floorPlanStyles.debugInfo}
        {...floorPlanAccessibility.getDebugPanelProps()}
      >
        <div>🔍 PDF DEBUG INFO</div>
        <div>PDF URL: {pdfBackgroundUrl ? '✅ EXISTS' : '❌ NONE'}</div>
        <div>PDF Ready: {isPdfReady ? '✅ YES' : '❌ NO'}</div>
        <div>Pages: {numPages}</div>
        <div>Test Mode: {testMode}</div>
        <div>Error: {pdfLoadError || 'None'}</div>
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
          🙈 Hidden
        </button>
        <button
          onClick={() => setTestMode('normal')}
          style={getMemoizedButtonStyle(testMode, 'normal')}
          aria-pressed={testMode === 'normal'}
          aria-label="Normal PDF display mode"
        >
          📄 Normal
        </button>
        <button
          onClick={() => setTestMode('fullscreen')}
          style={getMemoizedButtonStyle(testMode, 'fullscreen')}
          aria-pressed={testMode === 'fullscreen'}
          aria-label="Fullscreen PDF display mode"
        >
          📺 FULLSCREEN
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
          <div className={`w-full h-full bg-white border-4 ${getStatusBorder('info')}`}>
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
          className="absolute inset-0 flex items-center justify-center bg-orange-500 text-white text-4xl font-bold z-50"
          style={floorPlanStyles.warningOverlay}
          {...floorPlanAccessibility.getOverlayProps('warning')}
        >
          ⚠️ NO PDF URL PROVIDED ⚠️
        </section>
      )}

      {/* PDF NOT READY WARNING */}
      {pdfBackgroundUrl && !isPdfReady && !pdfLoadError && (
        <section
          className="absolute inset-0 flex items-center justify-center bg-blue-500 text-white text-2xl font-bold z-50"
          style={floorPlanStyles.loadingOverlay}
          {...floorPlanAccessibility.getOverlayProps('loading')}
        >
          ⏳ PDF LOADING... ⏳
        </section>
      )}

      {/* PDF ERROR WARNING */}
      {pdfLoadError && (
        <section
          className="absolute inset-0 flex items-center justify-center bg-red-500 text-white text-xl font-bold z-50 p-4"
          style={floorPlanStyles.errorOverlay}
          {...floorPlanAccessibility.getOverlayProps('error')}
        >
          <div className="text-center">
            ❌ PDF ERROR ❌<br/>
            {pdfLoadError}
          </div>
        </section>
      )}

      {/* SUCCESS MESSAGE */}
      {isPdfReady && pdfBackgroundUrl && (
        <section
          className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-green-500 text-white px-6 py-3 rounded-lg font-bold text-lg z-50"
          style={floorPlanStyles.successMessage}
          {...floorPlanAccessibility.getOverlayProps('success')}
        >
          ✅ PDF LOADED & DISPLAYED! Pages: {numPages}
        </section>
      )}

      {/* INSTRUCTIONS */}
      <aside
        id="floorplan-instructions"
        className="absolute bottom-4 right-4 bg-black text-white p-3 rounded max-w-sm text-xs z-50"
        style={floorPlanStyles.instructions}
        role="complementary"
        aria-label="Test instructions"
      >
        <div className="font-bold mb-2">�� TEST INSTRUCTIONS:</div>
        <div>1. Click FULLSCREEN button</div>
        <div>2. PDF should cover ENTIRE screen</div>
        <div>3. Look for colored borders</div>
        <div>4. Check debug info top-left</div>
      </aside>
    </main>
  );
}
