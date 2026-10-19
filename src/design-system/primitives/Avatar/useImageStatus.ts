'use client';

/**
 * Load status of ONE real `<img>` — no probe image, so `loading="lazy"` and `srcset` keep working.
 *
 * `imgRef` covers the case the events cannot: an image already in the HTTP cache may finish before React
 * attaches `onLoad`, so on mount (and on every new `src`) the element's own `complete` is read.
 * A `src` change resets to `loading` — the previous image's status never leaks onto the next one.
 *
 * @see EntityAvatar
 */

import { useCallback, useLayoutEffect, useRef, useState } from 'react';

export type ImageStatus = 'loading' | 'loaded' | 'error';

export interface ImageStatusHandle {
  readonly status: ImageStatus;
  readonly imgRef: React.RefObject<HTMLImageElement | null>;
  readonly onLoad: () => void;
  readonly onError: () => void;
}

export function useImageStatus(src: string | undefined): ImageStatusHandle {
  const [state, setState] = useState<{ src: string | undefined; status: ImageStatus }>({ src, status: 'loading' });
  const imgRef = useRef<HTMLImageElement | null>(null);

  // Derived reset: a new `src` starts at `loading` within the same render (no flash of the old status).
  const status: ImageStatus = state.src === src ? state.status : 'loading';

  const settle = useCallback((next: ImageStatus) => setState({ src, status: next }), [src]);
  const onLoad = useCallback(() => settle('loaded'), [settle]);
  const onError = useCallback(() => settle('error'), [settle]);

  useLayoutEffect(() => {
    const img = imgRef.current;
    if (img === null || !img.complete) return;
    settle(img.naturalWidth > 0 ? 'loaded' : 'error');
  }, [settle]);

  return { status, imgRef, onLoad, onError };
}
