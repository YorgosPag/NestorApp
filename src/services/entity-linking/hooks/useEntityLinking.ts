/**
 * 🏢 ENTERPRISE: useEntityLinking Hook
 *
 * React hook for entity linking operations.
 * Provides state management and easy-to-use API for components.
 *
 * @author Claude AI Assistant
 * @created 2026-01-07
 * @pattern Custom Hook Pattern (React Best Practices)
 *
 * @example
 * ```tsx
 * import { useEntityLinking } from '@/services/entity-linking';
 *
 * function MyComponent() {
 *   const { link, isLoading, error } = useEntityLinking();
 *
 *   const handleLinkBuilding = async () => {
 *     const result = await link({
 *       entityId: 'building123',
 *       entityType: 'building',
 *       parentId: 'project456',
 *       parentType: 'project'
 *     });
 *
 *     if (result.success) {
 *       // Handle success
 *     }
 *   };
 *
 *   return <button onClick={handleLinkBuilding} disabled={isLoading}>Link</button>;
 * }
 * ```
 */

'use client';

import { useState, useCallback } from 'react';
import { EntityLinkingService } from '../EntityLinkingService';
import type {
  LinkEntityParams,
  UnlinkEntityParams,
  GetAvailableEntitiesParams,
  LinkResult,
  GetAvailableEntitiesResult,
  UseEntityLinkingReturn,
} from '../types';

// ============================================================================
// 🏢 ENTERPRISE: useEntityLinking Hook
// ============================================================================

/**
 * Custom hook for entity linking operations
 *
 * Features:
 * - Loading state management
 * - Error handling
 * - Automatic state updates
 * - Type-safe API
 */
export function useEntityLinking(): UseEntityLinkingReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Link an entity to a parent
   */
  const link = useCallback(async (params: LinkEntityParams): Promise<LinkResult> => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await EntityLinkingService.linkEntity(params);

      if (!result.success && 'error' in result) {
        setError(result.error);
      }

      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      return {
        success: false,
        error: errorMessage,
        errorCode: 'UNKNOWN_ERROR',
        timestamp: Date.now(),
      };
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Unlink an entity from its parent
   */
  const unlink = useCallback(async (params: UnlinkEntityParams): Promise<LinkResult> => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await EntityLinkingService.unlinkEntity(params);

      if (!result.success && 'error' in result) {
        setError(result.error);
      }

      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      return {
        success: false,
        error: errorMessage,
        errorCode: 'UNKNOWN_ERROR',
        timestamp: Date.now(),
      };
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Get available entities for linking
   */
  const getAvailable = useCallback(
    async (params: GetAvailableEntitiesParams): Promise<GetAvailableEntitiesResult> => {
      setIsLoading(true);
      setError(null);

      try {
        const result = await EntityLinkingService.getAvailableEntities(params);

        if (!result.success && result.error) {
          setError(result.error);
        }

        return result;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        setError(errorMessage);
        return {
          success: false,
          entities: [],
          count: 0,
          error: errorMessage,
        };
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    link,
    unlink,
    getAvailable,
    isLoading,
    error,
    clearError,
  };
}

// Default export for convenience
export default useEntityLinking;
