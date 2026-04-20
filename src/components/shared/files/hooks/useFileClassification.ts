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
import { classifyFileWithPolicy } from '@/services/filesystem/file-mutation-gateway';

const POLL_DELAYS_MS = [3000, 5000, 8000];

async function pollUntilClassified(fileId: string): Promise<ClassificationResult | null> {
  for (const delay of POLL_DELAYS_MS) {
    await new Promise<void>((resolve) => setTimeout(resolve, delay));
    try {
      const poll = await classifyFileWithPolicy(fileId);
      if (!poll.success) return null;
      if (poll.status === 'already_classified' && poll.documentType && poll.confidence !== undefined) {
        return { documentType: poll.documentType, confidence: poll.confidence, signals: poll.signals ?? [] };
      }
    } catch {
      return null;
    }
  }
  return null;
}

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
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/xml',
  'application/xml',
  'text/html',
  'image/vnd.dxf',
  'application/dxf',
  'image/svg+xml',
]);

/**
 * Check if a file can be classified by AI.
 * Pass ext (from FileRecord.ext) as additional fallback for octet-stream files.
 */
export function isAIClassifiable(contentType?: string, filename?: string, ext?: string, displayName?: string): boolean {
  if (!contentType) return false;
  if (CLASSIFIABLE_TYPES.has(contentType)) return true;
  if (contentType.startsWith('video/') || contentType.startsWith('audio/')) return true;
  if (contentType === 'application/octet-stream') {
    const isDxf =
      filename?.toLowerCase().endsWith('.dxf') ||
      ext?.toLowerCase() === 'dxf' ||
      displayName?.toLowerCase().endsWith('.dxf');
    if (isDxf) return true;
  }
  return false;
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
      const data = await classifyFileWithPolicy(fileId);

      if (!data.success) {
        setError(data.error ?? 'Classification failed');
        return null;
      }

      // Background job in progress — poll until classified
      if (data.status === 'classifying') {
        return await pollUntilClassified(fileId);
      }

      if (!data.documentType || data.confidence === undefined) {
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
