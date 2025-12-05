'use client';

import { useEffect, useState } from 'react';

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
      console.log('🔄 CACHE BUSTING: Force re-rendering photos due to cache invalidation');

      // 🔥 NUCLEAR CACHE CLEAR: Εξαναγκασμένη εκκαθάριση browser image cache
      // Αυτό καλύπτει περιπτώσεις όπου το cache buster δεν επαρκεί
      if (typeof window !== 'undefined') {
        // ΔΙΑΓΝΩΣΤΙΚΑ: Δες όλες τις εικόνες στη σελίδα
        const allImages = document.querySelectorAll('img');
        console.log('🔍 DEBUG: Found', allImages.length, 'total images in page');

        allImages.forEach((img: any, index) => {
          console.log(`🔍 Image ${index}:`, {
            src: img.src,
            isFirebase: img.src.includes('firebasestorage'),
            isBlob: img.src.startsWith('blob:'),
            isData: img.src.startsWith('data:')
          });
        });

        // Κλείσιμο όλων των Firebase images από το browser memory
        const firebaseImages = document.querySelectorAll('img[src*="firebasestorage"]');
        const blobImages = document.querySelectorAll('img[src^="blob:"]');
        const dataImages = document.querySelectorAll('img[src^="data:"]');

        console.log('🔍 DEBUG: Firebase images:', firebaseImages.length);
        console.log('🔍 DEBUG: Blob images:', blobImages.length);
        console.log('🔍 DEBUG: Data images:', dataImages.length);

        // Clear ΜΟΝΟ τις εικόνες που είναι ΜΕΣΑ στο MultiplePhotosUpload grid
        const gridContainer = document.querySelector('[class*="grid-cols-3"]');
        if (gridContainer) {
          const gridImages = gridContainer.querySelectorAll('img');
          gridImages.forEach((img: any) => {
            const originalSrc = img.src;
            console.log('🔥 Clearing grid image:', originalSrc.substring(0, 50));

            // NUCLEAR CLEAR: Διαγραφή όλων των attributes
            img.removeAttribute('src');
            img.removeAttribute('alt');
            img.src = '';
            img.alt = '';

            // Force DOM update
            img.style.display = 'none';
            setTimeout(() => {
              img.style.display = '';
              // ΜΗΝ reload - αφήνε άδειο!
            }, 50);
          });
          console.log('🔥 NUCLEAR CACHE: TOTAL CLEAR of', gridImages.length, 'grid images (no reload)');
        } else {
          console.log('🔥 NUCLEAR CACHE: Grid container not found - no clearing done');
        }

        console.log('🔥 NUCLEAR CACHE: Force reloaded', firebaseImages.length + blobImages.length + dataImages.length, 'images total');
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
      return `${url}?v=${photosKey}`;
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