'use client';

/**
 * usePropertyDescriptionGenerator — Request AI-generated property descriptions.
 *
 * Calls `POST /api/properties/[id]/generate-description`. Handles loading state,
 * errors (network, 429 rate limit, 401/403 auth, 500 AI failure), and returns
 * the generated description for the consumer to render / edit / persist.
 *
 * @module hooks/usePropertyDescriptionGenerator
 */

import { useCallback, useState } from 'react';

export type DescriptionErrorKind = 'network' | 'rateLimit' | 'unauthorized' | 'generic';

export interface UsePropertyDescriptionGeneratorResult {
  description: string | null;
  isGenerating: boolean;
  errorKind: DescriptionErrorKind | null;
  /** Triggers a generation call. Resolves with the generated text, or null on failure. */
  generate: (propertyId: string, locale?: 'el' | 'en') => Promise<string | null>;
  reset: () => void;
}

interface ApiResponseData {
  description: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
}

interface ApiResponse {
  success: boolean;
  data?: ApiResponseData;
  error?: string;
}

function mapStatusToErrorKind(status: number): DescriptionErrorKind {
  if (status === 429) return 'rateLimit';
  if (status === 401 || status === 403) return 'unauthorized';
  return 'generic';
}

export function usePropertyDescriptionGenerator(): UsePropertyDescriptionGeneratorResult {
  const [description, setDescription] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorKind, setErrorKind] = useState<DescriptionErrorKind | null>(null);

  const reset = useCallback(() => {
    setDescription(null);
    setErrorKind(null);
    setIsGenerating(false);
  }, []);

  const generate = useCallback(
    async (propertyId: string, locale: 'el' | 'en' = 'el'): Promise<string | null> => {
      setIsGenerating(true);
      setErrorKind(null);

      try {
        const response = await fetch(`/api/properties/${encodeURIComponent(propertyId)}/generate-description`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ locale }),
        });

        if (!response.ok) {
          setErrorKind(mapStatusToErrorKind(response.status));
          return null;
        }

        const payload: ApiResponse = await response.json();
        if (!payload.success || !payload.data?.description) {
          setErrorKind('generic');
          return null;
        }

        setDescription(payload.data.description);
        return payload.data.description;
      } catch {
        setErrorKind('network');
        return null;
      } finally {
        setIsGenerating(false);
      }
    },
    []
  );

  return { description, isGenerating, errorKind, generate, reset };
}
