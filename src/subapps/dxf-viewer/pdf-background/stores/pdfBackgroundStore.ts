/**
 * @module PdfBackgroundStore
 * @description Centralized Zustand store for PDF Background management.
 *
 * @features
 * - PDF document loading/unloading
 * - Page selection and navigation
 * - Independent transform (separate from DXF)
 * - Visibility and opacity controls
 * - DevTools integration
 *
 * @pattern Enterprise Zustand (immer + devtools + subscribeWithSelector)
 * @see DxfSettingsStore.ts for pattern reference
 * @see centralized_systems.md for enterprise standards
 */

import { create } from 'zustand';
import { subscribeWithSelector, devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import type {
  PdfBackgroundState,
  PdfBackgroundActions,
  PdfBackgroundTransform,
  PdfDocumentInfo,
  PdfPageDimensions,
} from '../types/pdf.types';
import {
  DEFAULT_PDF_STATE,
  DEFAULT_PDF_TRANSFORM,
  clampPageNumber,
  clampOpacity,
  clampScale,
  normalizeRotation,
} from '../types/pdf.types';
import { PdfRenderer } from '../services/PdfRenderer';

// ============================================================================
// STORE TYPE
// ============================================================================

type PdfBackgroundStore = PdfBackgroundState & PdfBackgroundActions;

// ============================================================================
// STORE IMPLEMENTATION
// ============================================================================

/**
 * PDF Background Store
 *
 * @example
 * ```tsx
 * // Get current state
 * const { enabled, currentPage, transform } = usePdfBackgroundStore();
 *
 * // Load a PDF
 * const { loadPdf } = usePdfBackgroundStore();
 * await loadPdf(file);
 *
 * // Change page
 * const { setCurrentPage } = usePdfBackgroundStore();
 * setCurrentPage(2);
 * ```
 */
export const usePdfBackgroundStore = create<PdfBackgroundStore>()(
  devtools(
    subscribeWithSelector(
      immer((set, get) => ({
        // ============================================================
        // STATE (from DEFAULT_PDF_STATE)
        // ============================================================
        ...DEFAULT_PDF_STATE,

        // ============================================================
        // DOCUMENT ACTIONS
        // ============================================================

        loadPdf: async (file: File) => {
          const state = get();

          // Set loading state
          set((draft) => {
            draft.isLoading = true;
            draft.error = null;
          });

          try {
            // Load PDF document
            const loadResult = await PdfRenderer.loadDocument(file);

            if (!loadResult.success || !loadResult.document) {
              throw new Error(loadResult.error || 'Failed to load PDF');
            }

            // Get document info
            const documentInfo: PdfDocumentInfo = {
              numPages: loadResult.document.numPages,
              fileName: file.name,
              fileSize: file.size,
              loadedAt: Date.now(),
            };

            // Render first page
            const renderResult = await PdfRenderer.renderPage(1, { scale: 2 });

            set((draft) => {
              draft.documentInfo = documentInfo;
              draft.currentPage = 1;
              draft.pageDimensions = renderResult.dimensions || null;
              draft.renderedImageUrl = renderResult.imageUrl || null;
              draft.isLoading = false;
              draft.error = null;
            });
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error loading PDF';
            set((draft) => {
              draft.isLoading = false;
              draft.error = errorMessage;
            });
          }
        },

        unloadPdf: () => {
          PdfRenderer.unloadDocument();
          set((draft) => {
            draft.documentInfo = null;
            draft.currentPage = 1;
            draft.pageDimensions = null;
            draft.renderedImageUrl = null;
            draft.transform = DEFAULT_PDF_TRANSFORM;
            draft.error = null;
          });
        },

        // ============================================================
        // PAGE ACTIONS
        // ============================================================

        setCurrentPage: async (page: number) => {
          const state = get();
          const numPages = state.documentInfo?.numPages || 1;
          const clampedPage = clampPageNumber(page, numPages);

          if (clampedPage === state.currentPage) return;

          set((draft) => {
            draft.isLoading = true;
          });

          try {
            const renderResult = await PdfRenderer.renderPage(clampedPage, { scale: 2 });

            set((draft) => {
              draft.currentPage = clampedPage;
              draft.pageDimensions = renderResult.dimensions || null;
              draft.renderedImageUrl = renderResult.imageUrl || null;
              draft.isLoading = false;
            });
          } catch (error) {
            set((draft) => {
              draft.isLoading = false;
              draft.error = error instanceof Error ? error.message : 'Failed to render page';
            });
          }
        },

        nextPage: () => {
          const state = get();
          const numPages = state.documentInfo?.numPages || 1;
          if (state.currentPage < numPages) {
            get().setCurrentPage(state.currentPage + 1);
          }
        },

        previousPage: () => {
          const state = get();
          if (state.currentPage > 1) {
            get().setCurrentPage(state.currentPage - 1);
          }
        },

        // ============================================================
        // TRANSFORM ACTIONS
        // ============================================================

        setTransform: (transform: Partial<PdfBackgroundTransform>) => {
          set((draft) => {
            if (transform.scale !== undefined) {
              draft.transform.scale = clampScale(transform.scale);
            }
            if (transform.offsetX !== undefined) {
              draft.transform.offsetX = transform.offsetX;
            }
            if (transform.offsetY !== undefined) {
              draft.transform.offsetY = transform.offsetY;
            }
            if (transform.rotation !== undefined) {
              draft.transform.rotation = normalizeRotation(transform.rotation);
            }
          });
        },

        resetTransform: () => {
          set((draft) => {
            draft.transform = DEFAULT_PDF_TRANSFORM;
          });
        },

        setScale: (scale: number) => {
          set((draft) => {
            draft.transform.scale = clampScale(scale);
          });
        },

        setRotation: (rotation: number) => {
          set((draft) => {
            draft.transform.rotation = normalizeRotation(rotation);
          });
        },

        setOffset: (offset: { x: number; y: number }) => {
          set((draft) => {
            draft.transform.offsetX = offset.x;
            draft.transform.offsetY = offset.y;
          });
        },

        // ============================================================
        // VISIBILITY ACTIONS
        // ============================================================

        setEnabled: (enabled: boolean) => {
          set((draft) => {
            draft.enabled = enabled;
          });
        },

        toggleEnabled: () => {
          set((draft) => {
            draft.enabled = !draft.enabled;
          });
        },

        setOpacity: (opacity: number) => {
          set((draft) => {
            draft.opacity = clampOpacity(opacity);
          });
        },

        // ============================================================
        // VIEWPORT ACTIONS
        // ============================================================

        setViewport: (viewport: { width: number; height: number }) => {
          set((draft) => {
            draft.viewport = viewport;
          });
        },

        // ============================================================
        // INTERNAL ACTIONS
        // ============================================================

        _setLoading: (isLoading: boolean) => {
          set((draft) => {
            draft.isLoading = isLoading;
          });
        },

        _setError: (error: string | null) => {
          set((draft) => {
            draft.error = error;
          });
        },

        _setDocumentInfo: (info: PdfDocumentInfo | null) => {
          set((draft) => {
            draft.documentInfo = info;
          });
        },

        _setPageDimensions: (dimensions: PdfPageDimensions | null) => {
          set((draft) => {
            draft.pageDimensions = dimensions;
          });
        },

        _setRenderedImageUrl: (url: string | null) => {
          set((draft) => {
            draft.renderedImageUrl = url;
          });
        },
      }))
    ),
    {
      name: 'pdf-background-store',
      enabled: process.env.NODE_ENV === 'development',
    }
  )
);

// ============================================================================
// SELECTORS (for performance optimization)
// ============================================================================

/**
 * Select PDF enabled state
 */
export const selectPdfEnabled = (state: PdfBackgroundStore) => state.enabled;

/**
 * Select PDF opacity
 */
export const selectPdfOpacity = (state: PdfBackgroundStore) => state.opacity;

/**
 * Select PDF document info
 */
export const selectPdfDocumentInfo = (state: PdfBackgroundStore) => state.documentInfo;

/**
 * Select current page number
 */
export const selectPdfCurrentPage = (state: PdfBackgroundStore) => state.currentPage;

/**
 * Select PDF transform
 */
export const selectPdfTransform = (state: PdfBackgroundStore) => state.transform;

/**
 * Select rendered image URL
 */
export const selectPdfImageUrl = (state: PdfBackgroundStore) => state.renderedImageUrl;

/**
 * Select loading state
 */
export const selectPdfIsLoading = (state: PdfBackgroundStore) => state.isLoading;

/**
 * Select error state
 */
export const selectPdfError = (state: PdfBackgroundStore) => state.error;

// ============================================================================
// HOOK HELPERS
// ============================================================================

/**
 * Hook for PDF visibility state only (optimized)
 */
export const usePdfVisibility = () => {
  return usePdfBackgroundStore((state) => ({
    enabled: state.enabled,
    opacity: state.opacity,
    toggleEnabled: state.toggleEnabled,
    setOpacity: state.setOpacity,
  }));
};

/**
 * Hook for PDF page navigation only (optimized)
 */
export const usePdfNavigation = () => {
  return usePdfBackgroundStore((state) => ({
    currentPage: state.currentPage,
    numPages: state.documentInfo?.numPages || 0,
    setCurrentPage: state.setCurrentPage,
    nextPage: state.nextPage,
    previousPage: state.previousPage,
  }));
};

/**
 * Hook for PDF transform only (optimized)
 */
export const usePdfTransform = () => {
  return usePdfBackgroundStore((state) => ({
    transform: state.transform,
    setTransform: state.setTransform,
    resetTransform: state.resetTransform,
    setScale: state.setScale,
    setRotation: state.setRotation,
    setOffset: state.setOffset,
  }));
};
