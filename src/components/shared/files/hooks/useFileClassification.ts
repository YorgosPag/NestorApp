/**
 * =============================================================================
 * 🏢 ENTERPRISE: File AI Classification Hook
 * =============================================================================
 *
 * Client-side hook for triggering AI auto-classification on files.
 * Calls POST /api/files/classify and returns the result.
 *
 * @module components/shared/files/hooks/useFileClassification
 * @enterprise ADR-191 - Enterprise Document Management System (Phase 2.2)
 */

import { useState, useCallback } from 'react';
import { API_ROUTES } from '@/config/domain-constants';

// ============================================================================
// TYPES
// ============================================================================

interface ClassificationResult {
  documentType: string;
  confidence: number;
  signals: string[];
}

interface UseFileClassificationReturn {
  /** Trigger classification for a single file */
  classifyFile: (fileId: string) => Promise<ClassificationResult | null>;
  /** Trigger classification for multiple files */
  classifyBatch: (fileIds: string[]) => Promise<Map<string, ClassificationResult>>;
  /** Currently classifying file IDs */
  classifyingIds: Set<string>;
  /** Last error (if any) */
  error: string | null;
}

// ============================================================================
// CLASSIFIABLE MIME TYPES (mirror of server-side check)
// ============================================================================

const CLASSIFIABLE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'text/plain',
  'text/csv',
]);

/**
 * Check if a file can be classified by AI.
 */
export function isAIClassifiable(contentType?: string): boolean {
  if (!contentType) return false;
  return CLASSIFIABLE_TYPES.has(contentType);
}

// ============================================================================
// HOOK
// ============================================================================

export function useFileClassification(): UseFileClassificationReturn {
  const [classifyingIds, setClassifyingIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const classifyFile = useCallback(async (fileId: string): Promise<ClassificationResult | null> => {
    setClassifyingIds((prev) => new Set(prev).add(fileId));
    setError(null);

    try {
      const response = await fetch(API_ROUTES.FILES.CLASSIFY, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileId }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setError(data.error ?? `Classification failed (${response.status})`);
        return null;
      }

      return {
        documentType: data.documentType,
        confidence: data.confidence,
        signals: data.signals ?? [],
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Network error';
      setError(message);
      return null;
    } finally {
      setClassifyingIds((prev) => {
        const next = new Set(prev);
        next.delete(fileId);
        return next;
      });
    }
  }, []);

  const classifyBatch = useCallback(async (fileIds: string[]): Promise<Map<string, ClassificationResult>> => {
    const results = new Map<string, ClassificationResult>();

    // Process sequentially to respect rate limits
    for (const fileId of fileIds) {
      const result = await classifyFile(fileId);
      if (result) {
        results.set(fileId, result);
      }
    }

    return results;
  }, [classifyFile]);

  return { classifyFile, classifyBatch, classifyingIds, error };
}
