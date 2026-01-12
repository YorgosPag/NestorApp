'use client';

import React, { useState, useRef, useEffect } from 'react';
import { BarChart3, Link, Paperclip, FileText, X, CheckCircle, Circle, Chrome, Check } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { INTERACTIVE_PATTERNS } from '@/components/ui/effects';
import { layoutUtilities, canvasUtilities } from '@/styles/design-tokens';
// 🏢 ENTERPRISE: Import from canonical location
import { Spinner as AnimatedSpinner } from '@/components/ui/spinner';

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
  const iconSizes = useIconSizes();
  const { quick } = useBorderTokens();
  const colors = useSemanticColors();
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
            setDebugInfo('Converted to data URL for Chrome');
          } else {
            url = URL.createObjectURL(file);
            setDebugInfo('Using blob URL (may be blocked in Chrome)');
          }
        }

        setPdfUrl(url);
        setStatus('success');
        onLoadSuccess?.({ numPages: 1 });

      } catch (error) {
        // Error logging removed
        setStatus('error');
        setDebugInfo(`Error: ${(error as Error).message}`);
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
          renderMethod === 'data' ? `${colors.bg.success} ${colors.text.inverted}` : `${colors.bg.muted}`
        }`}
      >
        <BarChart3 className={`${iconSizes.sm} mr-1`} />
        Data URL (Chrome-safe)
      </button>
      <button
        onClick={() => setRenderMethod('blob')}
        className={`px-3 py-1 rounded text-sm ${
          renderMethod === 'blob' ? `${colors.bg.info} ${colors.text.inverted}` : `${colors.bg.muted}`
        }`}
      >
        <Link className={`${iconSizes.sm} mr-1`} />
        Blob URL
      </button>
      <button
        onClick={() => setRenderMethod('link')}
        className={`px-3 py-1 rounded text-sm ${
          renderMethod === 'link' ? `${colors.bg.accent} ${colors.text.inverted}` : `${colors.bg.muted}`
        }`}
      >
        <Paperclip className={`${iconSizes.sm} mr-1`} />
        Link Only
      </button>
    </div>
  );

  // No file
  if (!file) {
    return (
      <div
        className={`flex items-center justify-center ${colors.bg.muted} border border-dashed ${className}`}
        style={canvasUtilities.geoInteractive.pdfFallbackContainer(width, height)}
      >
        <div className={`text-center ${colors.text.muted}`}>
          <FileText className={`${iconSizes.lg} mx-auto mb-2`} />
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
      <div className={`${colors.bg.infoSubtle} ${quick.info} p-2 mb-4 text-xs`}>
        <div><strong>Status:</strong> {status}</div>
        <div><strong>Method:</strong> {renderMethod}</div>
        <div><strong>Debug:</strong> {debugInfo}</div>
        <div className="flex items-center gap-1">
          <strong>Browser:</strong>
          {typeof navigator !== 'undefined' && navigator.userAgent?.includes('Chrome') ? (
            <span className={`flex items-center gap-1 ${colors.text.danger}`}>
              <Circle className={`${iconSizes.xs} fill-current`} />
              Chrome (needs CSP fix)
            </span>
          ) : (
            <span className={`flex items-center gap-1 ${colors.text.success}`}>
              <CheckCircle className={iconSizes.xs} />
              Non-Chrome
            </span>
          )}
        </div>
      </div>

      {/* PDF Display */}
      <div style={canvasUtilities.geoInteractive.pdfDisplayWrapper(width, height)}>
        {/* Removed duplicate className - styles now in design token */}
        {status === 'loading' && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <AnimatedSpinner size="large" className="mx-auto mb-2" />
              <p className={`text-sm ${colors.text.info}`}>Processing PDF...</p>
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className={`flex items-center justify-center h-full ${colors.bg.dangerSubtle}`}>
            <div className={`text-center ${colors.text.danger}`}>
              <X className={`${iconSizes.lg} mx-auto mb-2`} />
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
                  <FileText className={`${iconSizes['2xl']} mx-auto mb-4 ${colors.text.info}`} />
                  <p className="text-lg font-medium mb-4">PDF Ready</p>
                  <a
                    href={pdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`inline-flex items-center px-6 py-3 ${colors.bg.info} ${colors.text.inverted} rounded-lg transition-colors ${INTERACTIVE_PATTERNS.PRIMARY_HOVER}`}
                  >
                    <FileText className={`${iconSizes.sm} mr-2`} />
                    Open PDF in New Tab
                  </a>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Success indicator */}
      {status === 'success' && (
        <div className={`absolute top-2 right-2 ${colors.bg.success} ${colors.text.inverted} px-2 py-1 rounded text-xs flex items-center gap-1`}>
          <Check className={iconSizes.xs} />
          PDF Loaded ({renderMethod})
        </div>
      )}
    </div>
  );
};

export default SafePDFLoader;
