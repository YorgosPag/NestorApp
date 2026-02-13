'use client';

import { useEffect, useState } from 'react';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('useCacheBusting');

// ============================================================================
// CACHE BUSTING HOOK
// ============================================================================

/**
 * Enterprise Cache Busting Hook
 *
 * Extracted από MultiplePhotosUpload.tsx για reusability.
 * Handles force re-render events and nuclear cache clearing για photo components.
 *
 * Features:
 * - Force re-render key-based invalidation
 * - Nuclear cache clear για Firebase Storage images
 * - Browser image cache management
 * - Grid-specific image clearing
 *
 * Usage:
 * ```tsx
 * const { photosKey, cacheBusterParams } = useCacheBusting();
 * const photoUrlWithCacheBuster = `${baseUrl}?v=${photosKey}`;
 * ```
 */
export function useCacheBusting() {
  // ========================================================================
  // STATE
  // ========================================================================

  // 🔥 FORCE RE-RENDER: Key-based invalidation για cache busting
  const [photosKey, setPhotosKey] = useState(0);

  // ========================================================================
  // EFFECTS
  // ========================================================================

  // Listen για force re-render events
  useEffect(() => {
    const handleForceRerender = (event: CustomEvent) => {
      logger.info('Force re-rendering photos due to cache invalidation');

      // 🔥 NUCLEAR CACHE CLEAR: Εξαναγκασμένη εκκαθάριση browser image cache
      // Αυτό καλύπτει περιπτώσεις όπου το cache buster δεν επαρκεί
      if (typeof window !== 'undefined') {
        // ΔΙΑΓΝΩΣΤΙΚΑ: Δες όλες τις εικόνες στη σελίδα
        const allImages = document.querySelectorAll('img');
        logger.info('Found total images in page', { count: allImages.length });

        allImages.forEach((img, index) => {
          const imgElement = img as HTMLImageElement;
          logger.info(`Image ${index}`, {
            src: imgElement.src,
            isFirebase: imgElement.src.includes('firebasestorage'),
            isBlob: imgElement.src.startsWith('blob:'),
            isData: imgElement.src.startsWith('data:')
          });
        });

        // Κλείσιμο όλων των Firebase images από το browser memory
        const firebaseImages = document.querySelectorAll('img[src*="firebasestorage"]');
        const blobImages = document.querySelectorAll('img[src^="blob:"]');
        const dataImages = document.querySelectorAll('img[src^="data:"]');

        logger.info('Image cache stats', {
          firebaseImages: firebaseImages.length,
          blobImages: blobImages.length,
          dataImages: dataImages.length
        });

        // Clear ΜΟΝΟ τις εικόνες που είναι ΜΕΣΑ στο MultiplePhotosUpload grid
        const gridContainer = document.querySelector('[class*="grid-cols-3"]');
        if (gridContainer) {
          const gridImages = gridContainer.querySelectorAll('img');
          gridImages.forEach((img) => {
            const imgElement = img as HTMLImageElement;
            const originalSrc = imgElement.src;
            logger.info('Clearing grid image');

            // NUCLEAR CLEAR: Διαγραφή όλων των attributes
            imgElement.removeAttribute('src');
            imgElement.removeAttribute('alt');
            imgElement.src = '';
            imgElement.alt = '';

            // Force DOM update
            imgElement.style.display = 'none';
            setTimeout(() => {
              imgElement.style.display = '';
              // ΜΗΝ reload - αφήνε άδειο!
            }, 50);
          });
          logger.info('NUCLEAR CACHE: TOTAL CLEAR of grid images (no reload)', { count: gridImages.length });
        } else {
          logger.info('NUCLEAR CACHE: Grid container not found - no clearing done');
        }

        logger.info('NUCLEAR CACHE: Force reloaded images total', { count: firebaseImages.length + blobImages.length + dataImages.length });
      }

      setPhotosKey(prev => prev + 1); // Force re-render με νέο key
    };

    window.addEventListener('forceAvatarRerender', handleForceRerender as EventListener);
    return () => {
      window.removeEventListener('forceAvatarRerender', handleForceRerender as EventListener);
    };
  }, []);

  // ========================================================================
  // COMPUTED VALUES
  // ========================================================================

  /**
   * Adds cache buster parameter to Firebase Storage URLs
   */
  const addCacheBuster = (url: string | undefined): string | undefined => {
    if (!url) return url;

    if (url.startsWith('https://firebasestorage')) {
      const separator = url.includes('?') ? '&' : '?';
      return `${url}${separator}v=${photosKey}`;
    }

    return url;
  };

  /**
   * Creates cache buster params for component keys
   */
  const createCacheKey = (baseKey: string, additionalData?: string): string => {
    return `${baseKey}-${photosKey}-${additionalData || 'default'}`;
  };

  // ========================================================================
  // RETURN API
  // ========================================================================

  return {
    /** Current cache busting key για force re-renders */
    photosKey,

    /** Add cache buster to Firebase Storage URLs */
    addCacheBuster,

    /** Create cache-busted component keys */
    createCacheKey,

    /** Force increment cache key manually */
    forceRerender: () => setPhotosKey(prev => prev + 1)
  };
}

export default useCacheBusting;