/**
 * 🔗 ENTERPRISE ID HOOKS
 *
 * React hooks για seamless integration του enterprise ID system
 *
 * FEATURES:
 * - Automatic ID resolution (legacy → enterprise)
 * - Migration status tracking
 * - Type-safe ID generation
 * - Caching και performance optimization
 *
 * @author Enterprise Frontend Team
 */

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  enterpriseIdService,
  validateEnterpriseId,
  parseEnterpriseId,
  isLegacyId
} from '@/services/enterprise-id.service';
import {
  enterpriseIdMigrationService,
  MigrationPhase,
  type MigrationStats
} from '@/services/enterprise-id-migration.service';
// 🏢 ENTERPRISE: Centralized API client with automatic authentication
import { apiClient } from '@/lib/api/enterprise-api-client';
import { API_ROUTES } from '@/config/domain-constants';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';

const logger = createModuleLogger('useEnterpriseIds');

/**
 * Hook για enterprise ID generation
 */
export function useEnterpriseIdGeneration() {
  const generateCompanyId = useCallback(() => enterpriseIdService.generateCompanyId(), []);
  const generateProjectId = useCallback(() => enterpriseIdService.generateProjectId(), []);
  const generateBuildingId = useCallback(() => enterpriseIdService.generateBuildingId(), []);
  const generatePropertyId = useCallback(() => enterpriseIdService.generatePropertyId(), []);
  const generateContactId = useCallback(() => enterpriseIdService.generateContactId(), []);
  const generateFloorId = useCallback(() => enterpriseIdService.generateFloorId(), []);
  const generateDocumentId = useCallback(() => enterpriseIdService.generateDocumentId(), []);
  const generateUserId = useCallback(() => enterpriseIdService.generateUserId(), []);

  return useMemo(() => ({
    generateCompanyId,
    generateProjectId,
    generateBuildingId,
    generatePropertyId,
    generateContactId,
    generateFloorId,
    generateDocumentId,
    generateUserId
  }), [
    generateCompanyId,
    generateProjectId,
    generateBuildingId,
    generatePropertyId,
    generateContactId,
    generateFloorId,
    generateDocumentId,
    generateUserId
  ]);
}

/**
 * Hook για ID validation και parsing
 */
export function useIdValidation() {
  const validateId = useCallback((id: string) => validateEnterpriseId(id), []);
  const parseId = useCallback((id: string) => parseEnterpriseId(id), []);
  const checkLegacyId = useCallback((id: string) => isLegacyId(id), []);

  const getIdInfo = useCallback((id: string) => {
    const isValid = validateId(id);
    const isLegacy = checkLegacyId(id);
    const parsed = parseId(id);

    return {
      id,
      isValid,
      isLegacy,
      isEnterprise: isValid && !isLegacy,
      type: parsed?.prefix || null,
      uuid: parsed?.uuid || null
    };
  }, [validateId, checkLegacyId, parseId]);

  return useMemo(() => ({
    validateId,
    parseId,
    checkLegacyId,
    getIdInfo
  }), [validateId, parseId, checkLegacyId, getIdInfo]);
}

/**
 * Hook για ID resolution με migration support
 */
export function useIdResolution() {
  const [resolvedIds, setResolvedIds] = useState<Map<string, string>>(new Map());

  const resolveId = useCallback((id: string, entityType: string): string => {
    // Check cache first
    const cached = resolvedIds.get(id);
    if (cached) return cached;

    try {
      const resolved = enterpriseIdMigrationService.resolveId(id, entityType);

      // Cache resolved ID
      setResolvedIds(prev => new Map(prev).set(id, resolved));

      return resolved;
    } catch (error) {
      logger.warn('ID resolution failed', { id, error });
      return id; // Fallback to original ID
    }
  }, [resolvedIds]);

  const batchResolveIds = useCallback((
    ids: string[],
    entityType: string
  ): Record<string, string> => {
    const results: Record<string, string> = {};

    ids.forEach(id => {
      results[id] = resolveId(id, entityType);
    });

    return results;
  }, [resolveId]);

  const clearCache = useCallback(() => {
    setResolvedIds(new Map());
  }, []);

  return useMemo(() => ({
    resolveId,
    batchResolveIds,
    clearCache,
    cacheSize: resolvedIds.size
  }), [resolveId, batchResolveIds, clearCache, resolvedIds.size]);
}

/**
 * Hook για migration status tracking
 */
export function useMigrationStatus() {
  const [stats, setStats] = useState<MigrationStats | null>(null);
  const [phase, setPhase] = useState<MigrationPhase>(MigrationPhase.DUAL_SUPPORT);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshStats = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // 🏢 ENTERPRISE: Use centralized API client with automatic authentication
      interface MigrationStatusResponse {
        success: boolean;
        stats: MigrationStats;
        phase: MigrationPhase;
        message?: string;
      }

      const data = await apiClient.get<MigrationStatusResponse>(API_ROUTES.ENTERPRISE_IDS.MIGRATE);

      if (data?.success) {
        setStats(data.stats);
        setPhase(data.phase);
      } else {
        throw new Error(data?.message || 'Unknown error');
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to fetch migration status'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Auto-refresh stats on mount
  useEffect(() => {
    refreshStats();
  }, [refreshStats]);

  const startMigration = useCallback(async (options: {
    phase?: MigrationPhase;
    entityTypes?: string[];
    dryRun?: boolean;
  } = {}) => {
    setIsLoading(true);
    setError(null);

    try {
      // 🏢 ENTERPRISE: Use centralized API client with automatic authentication
      interface MigrationResponse {
        success: boolean;
        stats: MigrationStats;
        phase: MigrationPhase;
        message?: string;
      }

      const data = await apiClient.post<MigrationResponse>(API_ROUTES.ENTERPRISE_IDS.MIGRATE, options);

      if (data?.success) {
        setStats(data.stats);
        setPhase(data.phase);
        return data;
      } else {
        throw new Error(data?.message || 'Migration failed');
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Migration failed'));
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const migrationProgress = useMemo(() => {
    if (!stats) return 0;
    return Math.round(stats.migrationProgress);
  }, [stats]);

  const isMigrationComplete = useMemo(() => {
    return migrationProgress >= 100;
  }, [migrationProgress]);

  return useMemo(() => ({
    stats,
    phase,
    isLoading,
    error,
    migrationProgress,
    isMigrationComplete,
    refreshStats,
    startMigration
  }), [
    stats,
    phase,
    isLoading,
    error,
    migrationProgress,
    isMigrationComplete,
    refreshStats,
    startMigration
  ]);
}

/**
 * Combined hook για full enterprise ID functionality
 */
export function useEnterpriseIds() {
  const idGeneration = useEnterpriseIdGeneration();
  const idValidation = useIdValidation();
  const idResolution = useIdResolution();
  const migrationStatus = useMigrationStatus();

  return useMemo(() => ({
    ...idGeneration,
    ...idValidation,
    ...idResolution,
    migration: migrationStatus
  }), [idGeneration, idValidation, idResolution, migrationStatus]);
}

/**
 * Hook για specific entity ID management
 */
export function useEntityId(entityType: string, initialId?: string) {
  const { resolveId } = useIdResolution();
  const { validateId, checkLegacyId } = useIdValidation();

  const [currentId, setCurrentId] = useState<string | null>(initialId || null);

  const resolvedId = useMemo(() => {
    if (!currentId) return null;
    return resolveId(currentId, entityType);
  }, [currentId, entityType, resolveId]);

  const idInfo = useMemo(() => {
    if (!resolvedId) return null;

    return {
      id: resolvedId,
      isValid: validateId(resolvedId),
      isLegacy: checkLegacyId(resolvedId),
      entityType
    };
  }, [resolvedId, entityType, validateId, checkLegacyId]);

  const updateId = useCallback((newId: string) => {
    setCurrentId(newId);
  }, []);

  return useMemo(() => ({
    id: resolvedId,
    info: idInfo,
    updateId,
    entityType
  }), [resolvedId, idInfo, updateId, entityType]);
}

/**
 * Export για backward compatibility
 */
export {
  enterpriseIdService,
  enterpriseIdMigrationService,
  validateEnterpriseId,
  parseEnterpriseId,
  isLegacyId
};