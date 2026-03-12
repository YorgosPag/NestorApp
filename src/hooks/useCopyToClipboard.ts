import { useState, useCallback, useRef, useEffect } from 'react';
import { copyToClipboard } from '@/lib/share-utils';

const DEFAULT_RESET_DELAY = 2000;

interface CopyToClipboardReturn {
  copy: (text: string) => Promise<boolean>;
  copied: boolean;
}

/**
 * Centralized hook for copy-to-clipboard with auto-reset feedback.
 * Delegates to share-utils.copyToClipboard (supports fallback for older browsers).
 *
 * @param resetDelay — ms before `copied` resets to false (default 2000)
 */
export function useCopyToClipboard(
  resetDelay: number = DEFAULT_RESET_DELAY
): CopyToClipboardReturn {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup on unmount to avoid setState on unmounted component
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const copy = useCallback(
    async (text: string): Promise<boolean> => {
      const success = await copyToClipboard(text);

      if (success) {
        setCopied(true);

        // Clear any existing timer before starting a new one
        if (timerRef.current) {
          clearTimeout(timerRef.current);
        }

        timerRef.current = setTimeout(() => {
          setCopied(false);
          timerRef.current = null;
        }, resetDelay);
      }

      return success;
    },
    [resetDelay]
  );

  return { copy, copied };
}
