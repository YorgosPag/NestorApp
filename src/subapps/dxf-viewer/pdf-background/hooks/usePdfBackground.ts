/**
 * @module usePdfBackground
 * @description Enterprise-grade hook for PDF background management
 *
 * Provides a simplified API for common PDF background operations.
 * Wraps the Zustand store with convenient methods.
 *
 * @features
 * - Simplified state access
 * - Memoized callbacks
 * - Type-safe API
 *
 * @see pdfBackgroundStore.ts for full store implementation
 * @see centralized_systems.md for enterprise patterns
 */

import { useCallback, useMemo } from 'react';
import { usePdfBackgroundStore } from '../stores/pdfBackgroundStore';
import type { PdfBackgroundTransform } from '../types/pdf.types';

// ============================================================================
// HOOK RETURN TYPE
// ============================================================================

interface UsePdfBackgroundReturn {
  // State
  isEnabled: boolean;
  isLoading: boolean;
  hasDocument: boolean;
  currentPage: number;
  totalPages: number;
  fileName: string | null;
  opacity: number;
  transform: PdfBackgroundTransform;
  imageUrl: string | null;
  error: string | null;

  // Actions
  loadPdf: (file: File) => Promise<void>;
  unloadPdf: () => void;
  toggleVisibility: () => void;
  setOpacity: (opacity: number) => void;
  goToPage: (page: number) => void;
  nextPage: () => void;
  previousPage: () => void;
  setScale: (scale: number) => void;
  setRotation: (rotation: number) => void;
  resetTransform: () => void;
}

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

/**
 * Hook for PDF background management
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const {
 *     isEnabled,
 *     hasDocument,
 *     loadPdf,
 *     toggleVisibility,
 *   } = usePdfBackground();
 *
 *   const handleFileSelect = async (file: File) => {
 *     await loadPdf(file);
 *   };
 *
 *   return (
 *     <button onClick={toggleVisibility}>
 *       {isEnabled ? 'Hide' : 'Show'} PDF
 *     </button>
 *   );
 * }
 * ```
 */
export function usePdfBackground(): UsePdfBackgroundReturn {
  // ============================================================
  // STORE ACCESS
  // ============================================================

  const store = usePdfBackgroundStore();

  // ============================================================
  // DERIVED STATE
  // ============================================================

  const hasDocument = useMemo(
    () => store.documentInfo !== null,
    [store.documentInfo]
  );

  const totalPages = useMemo(
    () => store.documentInfo?.numPages || 0,
    [store.documentInfo?.numPages]
  );

  const fileName = useMemo(
    () => store.documentInfo?.fileName || null,
    [store.documentInfo?.fileName]
  );

  // ============================================================
  // MEMOIZED CALLBACKS
  // ============================================================

  const loadPdf = useCallback(
    async (file: File) => {
      await store.loadPdf(file);
    },
    [store]
  );

  const unloadPdf = useCallback(() => {
    store.unloadPdf();
  }, [store]);

  const toggleVisibility = useCallback(() => {
    store.toggleEnabled();
  }, [store]);

  const setOpacity = useCallback(
    (opacity: number) => {
      store.setOpacity(opacity);
    },
    [store]
  );

  const goToPage = useCallback(
    (page: number) => {
      store.setCurrentPage(page);
    },
    [store]
  );

  const nextPage = useCallback(() => {
    store.nextPage();
  }, [store]);

  const previousPage = useCallback(() => {
    store.previousPage();
  }, [store]);

  const setScale = useCallback(
    (scale: number) => {
      store.setScale(scale);
    },
    [store]
  );

  const setRotation = useCallback(
    (rotation: number) => {
      store.setRotation(rotation);
    },
    [store]
  );

  const resetTransform = useCallback(() => {
    store.resetTransform();
  }, [store]);

  // ============================================================
  // RETURN
  // ============================================================

  return {
    // State
    isEnabled: store.enabled,
    isLoading: store.isLoading,
    hasDocument,
    currentPage: store.currentPage,
    totalPages,
    fileName,
    opacity: store.opacity,
    transform: store.transform,
    imageUrl: store.renderedImageUrl,
    error: store.error,

    // Actions
    loadPdf,
    unloadPdf,
    toggleVisibility,
    setOpacity,
    goToPage,
    nextPage,
    previousPage,
    setScale,
    setRotation,
    resetTransform,
  };
}

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default usePdfBackground;
