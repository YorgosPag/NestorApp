'use client';

import { useRef, useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { SafePDFLoader } from '@/components/common/SafePDFLoader';

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
    <div
      className={cn('relative w-full h-full overflow-hidden', className)}
      style={{
        minWidth: '100vw',
        minHeight: '100vh',
        position: 'relative',
        background: '#ff0000' // RED background για debugging
      }}
    >
      
      {/* DEBUG INFO - TOP LEFT */}
      <div 
        className="absolute top-4 left-4 bg-yellow-400 text-black p-3 rounded font-mono text-sm z-50"
        style={{ zIndex: 9999 }}
      >
        <div>🔍 PDF DEBUG INFO</div>
        <div>PDF URL: {pdfBackgroundUrl ? '✅ EXISTS' : '❌ NONE'}</div>
        <div>PDF Ready: {isPdfReady ? '✅ YES' : '❌ NO'}</div>
        <div>Pages: {numPages}</div>
        <div>Test Mode: {testMode}</div>
        <div>Error: {pdfLoadError || 'None'}</div>
      </div>

      {/* TEST MODE BUTTONS - TOP RIGHT */}
      <div 
        className="absolute top-4 right-4 flex gap-2 z-50"
        style={{ zIndex: 9999 }}
      >
        <button
          onClick={() => setTestMode('hidden')}
          className={`px-3 py-1 rounded text-sm ${
            testMode === 'hidden' ? 'bg-red-600 text-white' : 'bg-gray-200'
          }`}
        >
          🙈 Hidden
        </button>
        <button
          onClick={() => setTestMode('normal')}
          className={`px-3 py-1 rounded text-sm ${
            testMode === 'normal' ? 'bg-blue-600 text-white' : 'bg-gray-200'
          }`}
        >
          📄 Normal
        </button>
        <button
          onClick={() => setTestMode('fullscreen')}
          className={`px-3 py-1 rounded text-sm ${
            testMode === 'fullscreen' ? 'bg-green-600 text-white' : 'bg-gray-200'
          }`}
        >
          📺 FULLSCREEN
        </button>
      </div>

      {/* BACKGROUND CANVAS */}
      <canvas
        width={800}
        height={600}
        className="absolute inset-0"
        style={{
          width: '100%',
          height: '100%',
          zIndex: 1,
          background: '#00ff00' // GREEN background
        }}
      />

      {/* PDF LAYER - CONDITIONAL DISPLAY */}
      {pdfBackgroundUrl && testMode !== 'hidden' && (
        <div
          className="absolute"
          style={{
            // FULLSCREEN mode
            ...(testMode === 'fullscreen' && {
              top: 0,
              left: 0,
              width: '100vw',
              height: '100vh',
              zIndex: 8888,
              background: 'rgba(255, 255, 0, 0.5)', // Yellow background
              border: '10px solid #ff0000' // Thick red border
            }),
            // NORMAL mode
            ...(testMode === 'normal' && {
              top: '10%',
              left: '10%',
              width: '80%',
              height: '80%',
              zIndex: 100,
              background: 'rgba(0, 255, 255, 0.5)', // Cyan background
              border: '5px solid #0000ff' // Blue border
            })
          }}
        >
          <div className="w-full h-full bg-white border-4 border-purple-500">
            <SafePDFLoader
              file={pdfBackgroundUrl}
              width={testMode === 'fullscreen' ? window.innerWidth : 800}
              height={testMode === 'fullscreen' ? window.innerHeight : 600}
              pageNumber={1}
              onLoadSuccess={handlePDFLoadSuccess}
              onLoadError={handlePDFLoadError}
              className="w-full h-full"
              fallbackMessage="FULLSCREEN PDF TEST"
            />
          </div>
        </div>
      )}

      {/* BIG WARNING IF NO PDF */}
      {!pdfBackgroundUrl && (
        <div 
          className="absolute inset-0 flex items-center justify-center bg-orange-500 text-white text-4xl font-bold z-50"
          style={{ zIndex: 9999 }}
        >
          ⚠️ NO PDF URL PROVIDED ⚠️
        </div>
      )}

      {/* PDF NOT READY WARNING */}
      {pdfBackgroundUrl && !isPdfReady && !pdfLoadError && (
        <div 
          className="absolute inset-0 flex items-center justify-center bg-blue-500 text-white text-2xl font-bold z-50"
          style={{ zIndex: 9999 }}
        >
          ⏳ PDF LOADING... ⏳
        </div>
      )}

      {/* PDF ERROR WARNING */}
      {pdfLoadError && (
        <div 
          className="absolute inset-0 flex items-center justify-center bg-red-500 text-white text-xl font-bold z-50 p-4"
          style={{ zIndex: 9999 }}
        >
          <div className="text-center">
            ❌ PDF ERROR ❌<br/>
            {pdfLoadError}
          </div>
        </div>
      )}

      {/* SUCCESS MESSAGE */}
      {isPdfReady && pdfBackgroundUrl && (
        <div 
          className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-green-500 text-white px-6 py-3 rounded-lg font-bold text-lg z-50"
          style={{ zIndex: 9999 }}
        >
          ✅ PDF LOADED & DISPLAYED! Pages: {numPages}
        </div>
      )}

      {/* INSTRUCTIONS */}
      <div 
        className="absolute bottom-4 right-4 bg-black text-white p-3 rounded max-w-sm text-xs z-50"
        style={{ zIndex: 9999 }}
      >
        <div className="font-bold mb-2">�� TEST INSTRUCTIONS:</div>
        <div>1. Click FULLSCREEN button</div>
        <div>2. PDF should cover ENTIRE screen</div>
        <div>3. Look for colored borders</div>
        <div>4. Check debug info top-left</div>
      </div>
    </div>
  );
}
