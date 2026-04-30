'use client';

/**
 * @fileoverview Facade hook for Phase 9 duplicate detection + versioning operations.
 * Wires quote-duplicate-detection and quote-versioning-service into a stable API
 * for consumers (RfqDetailClient, scan completion handlers).
 * @adr ADR-328 §5.AA
 */

import { useCallback, useRef, useState } from 'react';
import {
  detectDuplicate,
  type DuplicateDetectionResult,
} from '../utils/quote-duplicate-detection';
import {
  supersede,
  revertSupersede,
  type SupersedeResult,
} from '../services/quote-versioning-service';
import type { Quote } from '../types/quote';

export interface UseQuoteRevisionResult {
  /** Run duplicate detection against active quotes. Pure function, safe to call anytime. */
  detect: (newQuote: Quote, activeQuotes: Quote[]) => DuplicateDetectionResult;
  /** Atomically marks oldQuoteId as superseded and promotes newQuoteId. */
  supersede: (oldQuoteId: string, newQuoteId: string, userId: string) => Promise<SupersedeResult>;
  /** Compensating call — reverts supersede within the undo window. */
  revertSupersede: (oldQuoteId: string, newQuoteId: string, userId: string) => Promise<void>;
  /** Pending detection result awaiting user decision (medium/low confidence path). */
  pendingDetection: PendingDetection | null;
  /** Trigger the detection flow for a freshly created quote. */
  triggerDetection: (newQuote: Quote, activeQuotes: Quote[]) => void;
  /** Dismiss the pending detection (user chose 'separate' or 'cancel_import'). */
  dismissDetection: () => void;
}

export interface PendingDetection {
  detection: DuplicateDetectionResult;
  existingQuote: Quote;
  newQuote: Quote;
}

/**
 * Facade for quote duplicate detection + versioning operations.
 * For high-confidence matches, callers should call supersede() directly and
 * show an undo toast (§5.AA.2). For medium/low, render QuoteRevisionDetectedDialog
 * driven by pendingDetection.
 */
export function useQuoteRevision(): UseQuoteRevisionResult {
  const [pendingDetection, setPendingDetection] = useState<PendingDetection | null>(null);
  const activeRef = useRef(true);

  const detect = useCallback(
    (newQuote: Quote, activeQuotes: Quote[]) => detectDuplicate(newQuote, activeQuotes),
    [],
  );

  const triggerDetection = useCallback((newQuote: Quote, activeQuotes: Quote[]) => {
    const result = detectDuplicate(newQuote, activeQuotes);
    if (result.confidence === 'none' || !result.matchedQuote) return;
    if (activeRef.current) {
      setPendingDetection({ detection: result, existingQuote: result.matchedQuote, newQuote });
    }
  }, []);

  const dismissDetection = useCallback(() => {
    setPendingDetection(null);
  }, []);

  return { detect, supersede, revertSupersede, pendingDetection, triggerDetection, dismissDetection };
}
