/**
 * @module PdfRenderer
 * @description Enterprise-grade PDF rendering service using pdfjs-dist
 *
 * 🏢 ENTERPRISE: Uses pdfjs-dist@4.5.136 (stable version)
 * Version 5.x has known ESM compatibility issues with Next.js
 *
 * @features
 * - PDF document loading from File
 * - Page rendering to canvas/image
 * - Proper cleanup and memory management
 * - Self-hosted worker (offline support)
 *
 * @see https://mozilla.github.io/pdf.js/
 * @see centralized_systems.md for enterprise patterns
 */

import {
  PDF_RENDER_CONFIG,
  type PdfRenderOptions,
  type PdfRenderResult,
  type PdfPageDimensions,
  type PdfDocumentInfo,
} from '../types/pdf.types';

// ============================================================================
// PDF.JS TYPES (compatible with react-pdf)
// ============================================================================

/**
 * PDF.js document proxy type
 */
interface PDFDocumentProxyLike {
  numPages: number;
  getPage(pageNumber: number): Promise<PDFPageProxyLike>;
  destroy(): Promise<void>;
}

/**
 * PDF.js page proxy type
 */
interface PDFPageProxyLike {
  getViewport(options: { scale: number; rotation?: number }): PageViewportLike;
  render(params: {
    canvasContext: CanvasRenderingContext2D;
    viewport: PageViewportLike;
  }): { promise: Promise<void> };
}

/**
 * PDF.js viewport type
 */
interface PageViewportLike {
  width: number;
  height: number;
  rotation: number;
}

/**
 * PDF.js loading task type
 */
interface PDFDocumentLoadingTaskLike {
  promise: Promise<PDFDocumentProxyLike>;
}

/**
 * pdfjs module type from react-pdf
 * Using actual pdfjs-dist types for proper typing
 */
type PdfjsModule = typeof import('pdfjs-dist');

// ============================================================================
// CONSTANTS (from centralized PDF_RENDER_CONFIG)
// ============================================================================

const { DEFAULT_RENDER_SCALE, MAX_RENDER_SCALE, MIN_RENDER_SCALE } = PDF_RENDER_CONFIG;

// ============================================================================
// PDF RENDERER SERVICE
// ============================================================================

/**
 * PDF Renderer Service
 *
 * Singleton service for loading and rendering PDF documents.
 * Uses pdf.js library for PDF processing.
 *
 * @example
 * ```ts
 * // Load a PDF file
 * const result = await PdfRenderer.loadDocument(file);
 * if (result.success) {
 *   // Render page 1
 *   const pageResult = await PdfRenderer.renderPage(1, { scale: 2 });
 *   if (pageResult.success) {
 *     // Use pageResult.imageUrl
 *   }
 * }
 *
 * // Cleanup when done
 * PdfRenderer.unloadDocument();
 * ```
 */
class PdfRendererService {
  // ============================================================
  // PRIVATE STATE
  // ============================================================

  private pdfDocument: PDFDocumentProxyLike | null = null;
  private isInitialized = false;
  private workerSrc: string | null = null;

  // 🏢 ENTERPRISE: Store document metadata properly
  private documentFileName: string | null = null;
  private documentFileSize: number = 0;
  private documentLoadedAt: number = 0;

  // ============================================================
  // INITIALIZATION
  // ============================================================

  /** Cached pdfjs module reference */
  private pdfjsModule: PdfjsModule | null = null;

  /**
   * Initialize pdf.js library
   * 🏢 ENTERPRISE: Uses pdfjs-dist@4.5.136 directly (stable version)
   *
   * Note: Version 5.x has known ESM issues with Next.js
   * 4.5.136 is the last stable version that works reliably
   */
  private async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // 🏢 ENTERPRISE: Dynamic import pdfjs-dist (4.5.136 - stable)
      const pdfjs = await import('pdfjs-dist');
      this.pdfjsModule = pdfjs;

      // 🏢 ENTERPRISE: Use self-hosted worker
      // Worker is copied to /public/ by webpack CopyPlugin in next.config.js
      const workerUrl = '/pdf.worker.min.mjs';
      pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
      this.workerSrc = workerUrl;
      this.isInitialized = true;

      console.log('✅ [PdfRenderer] Initialized with pdfjs-dist@4.5.136');
    } catch (error) {
      console.error('❌ [PdfRenderer] Failed to initialize:', error);
      throw new Error('Failed to initialize PDF renderer');
    }
  }

  // ============================================================
  // PUBLIC API
  // ============================================================

  /**
   * Load a PDF document from a File object
   */
  async loadDocument(file: File): Promise<{
    success: boolean;
    document?: PDFDocumentProxyLike;
    error?: string;
  }> {
    try {
      // Ensure initialization
      await this.initialize();

      // Unload previous document if any
      if (this.pdfDocument) {
        await this.unloadDocument();
      }

      // Read file as ArrayBuffer
      const arrayBuffer = await file.arrayBuffer();

      // 🏢 ENTERPRISE: Use cached pdfjs module from react-pdf
      if (!this.pdfjsModule) {
        throw new Error('PDF.js not initialized');
      }

      // Load PDF document
      const loadingTask = this.pdfjsModule.getDocument({
        data: arrayBuffer,
      }) as unknown as PDFDocumentLoadingTaskLike;

      this.pdfDocument = await loadingTask.promise;

      // 🏢 ENTERPRISE: Store document metadata (NO HARDCODED VALUES)
      this.documentFileName = file.name;
      this.documentFileSize = file.size;
      this.documentLoadedAt = Date.now();

      console.log('✅ [PdfRenderer] Document loaded:', {
        numPages: this.pdfDocument.numPages,
        fileName: this.documentFileName,
        fileSize: this.documentFileSize,
      });

      return {
        success: true,
        document: this.pdfDocument,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error loading PDF';
      console.error('❌ [PdfRenderer] Load error:', errorMessage);

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Unload current PDF document and cleanup resources
   */
  async unloadDocument(): Promise<void> {
    if (this.pdfDocument) {
      try {
        await this.pdfDocument.destroy();
        console.log('✅ [PdfRenderer] Document unloaded');
      } catch (error) {
        console.warn('⚠️ [PdfRenderer] Error during unload:', error);
      }
      this.pdfDocument = null;

      // 🏢 ENTERPRISE: Clear document metadata on unload
      this.documentFileName = null;
      this.documentFileSize = 0;
      this.documentLoadedAt = 0;
    }
  }

  /**
   * Render a specific page to an image
   */
  async renderPage(
    pageNumber: number,
    options: Partial<PdfRenderOptions> = {}
  ): Promise<PdfRenderResult> {
    try {
      if (!this.pdfDocument) {
        return {
          success: false,
          error: 'No PDF document loaded',
        };
      }

      // Validate page number
      if (pageNumber < 1 || pageNumber > this.pdfDocument.numPages) {
        return {
          success: false,
          error: `Invalid page number: ${pageNumber}. Document has ${this.pdfDocument.numPages} pages.`,
        };
      }

      // Clamp scale to valid range
      const scale = Math.max(
        MIN_RENDER_SCALE,
        Math.min(MAX_RENDER_SCALE, options.scale || DEFAULT_RENDER_SCALE)
      );

      // Get page
      const page = await this.pdfDocument.getPage(pageNumber);

      // Get viewport at specified scale
      const viewport = page.getViewport({ scale });

      // Create canvas for rendering
      const canvas = options.canvas || document.createElement('canvas');
      const context = canvas.getContext('2d');

      if (!context) {
        return {
          success: false,
          error: 'Failed to get canvas 2D context',
        };
      }

      // Set canvas dimensions
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      // Render page to canvas
      await page.render({
        canvasContext: context,
        viewport,
      }).promise;

      // Convert to data URL
      const imageUrl = canvas.toDataURL('image/png');

      // Get page dimensions
      const dimensions: PdfPageDimensions = {
        width: viewport.width,
        height: viewport.height,
        rotation: viewport.rotation,
      };

      console.log('✅ [PdfRenderer] Page rendered:', {
        pageNumber,
        dimensions,
        scale,
      });

      return {
        success: true,
        imageUrl,
        dimensions,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error rendering page';
      console.error('❌ [PdfRenderer] Render error:', errorMessage);

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Get current document info
   * 🏢 ENTERPRISE: Returns actual metadata, NO HARDCODED VALUES
   */
  getDocumentInfo(): PdfDocumentInfo | null {
    if (!this.pdfDocument) return null;

    return {
      numPages: this.pdfDocument.numPages,
      fileName: this.documentFileName ?? 'Unknown Document',
      fileSize: this.documentFileSize,
      loadedAt: this.documentLoadedAt,
    };
  }

  /**
   * Check if a document is loaded
   */
  hasDocument(): boolean {
    return this.pdfDocument !== null;
  }

  /**
   * Get number of pages in current document
   */
  getNumPages(): number {
    return this.pdfDocument?.numPages || 0;
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

/**
 * Singleton instance of PdfRenderer
 */
export const PdfRenderer = new PdfRendererService();

// Default export for convenience
export default PdfRenderer;
