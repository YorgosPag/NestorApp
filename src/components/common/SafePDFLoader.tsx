'use client';

import React, { useState, useRef, useEffect } from 'react';

interface SafePDFLoaderProps {
  file: string | File | null;
  width?: number;
  height?: number;
  pageNumber?: number;
  onLoadSuccess?: (data: { numPages: number }) => void;
  onLoadError?: (error: Error) => void;
  className?: string;
  fallbackMessage?: string;
}

// Convert blob to data URL to bypass Chrome CSP restrictions
const convertBlobToDataURL = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

export const SafePDFLoader: React.FC<SafePDFLoaderProps> = ({
  file,
  width = 800,
  height = 600,
  pageNumber = 1,
  onLoadSuccess,
  onLoadError,
  className = '',
  fallbackMessage = 'PDF Viewer'
}) => {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [renderMethod, setRenderMethod] = useState<'data' | 'blob' | 'canvas' | 'link'>('data');
  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'idle'>('idle');
  const [debugInfo, setDebugInfo] = useState<string>('');
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Generate PDF URL with Chrome-compatible approach
  useEffect(() => {
    if (!file) {
      setPdfUrl(null);
      setStatus('idle');
      return;
    }

    setStatus('loading');
    setDebugInfo('Processing PDF for Chrome compatibility...');

    const processPDF = async () => {
      try {
        let url: string;

        if (typeof file === 'string') {
          url = file;
          setDebugInfo('Using direct URL');
        } else {
          // SOLUTION: Convert blob to data URL for Chrome compatibility
          if (renderMethod === 'data') {
            url = await convertBlobToDataURL(file);
            setDebugInfo('✅ Converted to data URL for Chrome');
          } else {
            url = URL.createObjectURL(file);
            setDebugInfo('Using blob URL (may be blocked in Chrome)');
          }
        }

        setPdfUrl(url);
        setStatus('success');
        onLoadSuccess?.({ numPages: 1 });

      } catch (error) {
        console.error('PDF processing error:', error);
        setStatus('error');
        setDebugInfo(`❌ Error: ${(error as Error).message}`);
        onLoadError?.(error as Error);
      }
    };

    processPDF();

    // Cleanup
    return () => {
      if (typeof file !== 'string' && pdfUrl && renderMethod === 'blob') {
        URL.revokeObjectURL(pdfUrl);
      }
    };
  }, [file, renderMethod]);

  // Method selector
  const MethodSelector = () => (
    <div className="flex gap-2 mb-4">
      <button
        onClick={() => setRenderMethod('data')}
        className={`px-3 py-1 rounded text-sm ${
          renderMethod === 'data' ? 'bg-green-600 text-white' : 'bg-gray-200'
        }`}
      >
        📊 Data URL (Chrome-safe)
      </button>
      <button
        onClick={() => setRenderMethod('blob')}
        className={`px-3 py-1 rounded text-sm ${
          renderMethod === 'blob' ? 'bg-blue-600 text-white' : 'bg-gray-200'
        }`}
      >
        🔗 Blob URL
      </button>
      <button
        onClick={() => setRenderMethod('link')}
        className={`px-3 py-1 rounded text-sm ${
          renderMethod === 'link' ? 'bg-purple-600 text-white' : 'bg-gray-200'
        }`}
      >
        🖇️ Link Only
      </button>
    </div>
  );

  // No file
  if (!file) {
    return (
      <div 
        className={`flex items-center justify-center bg-gray-100 border-2 border-dashed border-gray-300 ${className}`}
        style={{ width, height }}
      >
        <div className="text-center text-gray-500">
          <div className="text-2xl mb-2">📄</div>
          <div className="text-sm">No PDF file</div>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      {/* Debug mode controls */}
      <MethodSelector />
      
      {/* Debug info */}
      <div className="bg-blue-100 border border-blue-300 rounded p-2 mb-4 text-xs">
        <div><strong>Status:</strong> {status}</div>
        <div><strong>Method:</strong> {renderMethod}</div>
        <div><strong>Debug:</strong> {debugInfo}</div>
        <div><strong>Browser:</strong> {navigator.userAgent.includes('Chrome') ? '🔴 Chrome (needs CSP fix)' : '✅ Non-Chrome'}</div>
      </div>

      {/* PDF Display */}
      <div style={{ width, height }} className="border rounded overflow-hidden bg-gray-100">
        {status === 'loading' && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-2"></div>
              <p className="text-sm text-blue-600">Processing PDF...</p>
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="flex items-center justify-center h-full bg-red-50">
            <div className="text-center text-red-600">
              <div className="text-2xl mb-2">❌</div>
              <p className="text-sm font-medium">PDF Error</p>
              <p className="text-xs">{debugInfo}</p>
            </div>
          </div>
        )}

        {status === 'success' && pdfUrl && (
          <>
            {/* Data URL Method (Chrome-compatible) */}
            {renderMethod === 'data' && (
              <iframe
                src={pdfUrl}
                width="100%"
                height="100%"
                className="border-0"
                title="PDF Viewer (Data URL)"
                sandbox="allow-same-origin allow-scripts"
              />
            )}

            {/* Blob URL Method */}
            {renderMethod === 'blob' && (
              <iframe
                src={pdfUrl}
                width="100%"
                height="100%"
                className="border-0"
                title="PDF Viewer (Blob URL)"
              />
            )}

            {/* Link Method */}
            {renderMethod === 'link' && (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="text-4xl mb-4">📄</div>
                  <p className="text-lg font-medium mb-4">PDF Ready</p>
                  <a
                    href={pdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    📄 Open PDF in New Tab
                  </a>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Success indicator */}
      {status === 'success' && (
        <div className="absolute top-2 right-2 bg-green-500 text-white px-2 py-1 rounded text-xs">
          ✅ PDF Loaded ({renderMethod})
        </div>
      )}
    </div>
  );
};

export default SafePDFLoader;
