/**
 * 🏢 ENTERPRISE RELATIONSHIP PROVIDER
 *
 * React Context Provider για centralized relationship management
 * Provides global access to relationship engine with caching & real-time updates
 *
 * @enterprise Production-ready με performance monitoring, error boundaries
 * @integration Seamless με existing centralized systems
 * @author Enterprise Development Team
 * @date 2025-12-15
 */

'use client';

import React, { createContext, useContext, useReducer, useCallback, useEffect, useMemo } from 'react';
import type {
  EntityType,
  RelationshipOperationResult,
  IntegrityValidationResult,
  CascadeDeleteResult,
  RelationshipAuditEntry,
  CreateRelationshipOptions,
  RemoveRelationshipOptions,
  HierarchyQueryOptions,
  CascadeDeleteOptions,
  AuditQueryOptions,
  EntityHierarchyTree
} from '@/services/relationships/enterprise-relationship-engine.contracts';
import { useEnterpriseRelationships } from '@/services/relationships/hooks/useEnterpriseRelationships';

// ============================================================================
// CONTEXT STATE DEFINITION
// ============================================================================

interface EnterpriseRelationshipState {
  readonly isInitialized: boolean;
  readonly globalLoading: boolean;
  readonly globalError: string | null;
  readonly stats: {
    readonly totalOperations: number;
    readonly successfulOperations: number;
    readonly failedOperations: number;
    readonly lastOperationTimestamp: Date | null;
  };
  readonly performance: {
    readonly averageResponseTime: number;
    readonly cacheHitRate: number;
    readonly integrityScore: number;
    readonly lastIntegrityCheck: Date | null;
  };
}

interface EnterpriseRelationshipActions {
  // 🔗 RELATIONSHIP OPERATIONS
  readonly createRelationship: (
    parentType: EntityType,
    parentId: string,
    childType: EntityType,
    childId: string,
    options?: CreateRelationshipOptions
  ) => Promise<RelationshipOperationResult>;

  readonly removeRelationship: (
    relationshipId: string,
    options?: RemoveRelationshipOptions
  ) => Promise<RelationshipOperationResult>;

  // 🔍 BIDIRECTIONAL QUERIES
  readonly getChildren: <TChild>(
    parentType: EntityType,
    parentId: string,
    childType: EntityType,
    useCache?: boolean
  ) => Promise<readonly TChild[]>;

  readonly getParent: <TParent>(
    childType: EntityType,
    childId: string,
    parentType: EntityType,
    useCache?: boolean
  ) => Promise<TParent | null>;

  readonly getHierarchy: (
    rootType: EntityType,
    rootId: string,
    options?: HierarchyQueryOptions,
    useCache?: boolean
  ) => Promise<EntityHierarchyTree>;

  // 🛡️ INTEGRITY & VALIDATION
  readonly validateIntegrity: () => Promise<IntegrityValidationResult>;

  // 🗑️ CASCADE OPERATIONS
  readonly cascadeDelete: (
    entityType: EntityType,
    entityId: string,
    options?: CascadeDeleteOptions
  ) => Promise<CascadeDeleteResult>;

  // 📋 AUDIT TRAIL
  readonly getAuditTrail: (
    entityType: EntityType,
    entityId: string,
    options?: AuditQueryOptions
  ) => Promise<readonly RelationshipAuditEntry[]>;

  // 🔄 CACHE & PERFORMANCE
  readonly invalidateCache: (
    cacheType?: 'children' | 'parents' | 'hierarchies' | 'all'
  ) => void;

  readonly getPerformanceMetrics: () => {
    readonly cacheStats: {
      readonly childrenCacheSize: number;
      readonly parentsCacheSize: number;
      readonly hierarchiesCacheSize: number;
      readonly oldestEntry: number | null;
    };
    readonly operationStats: EnterpriseRelationshipState['stats'];
    readonly performanceStats: EnterpriseRelationshipState['performance'];
  };

  // 🔧 SYSTEM UTILITIES
  readonly reinitializeSystem: () => Promise<void>;
  readonly runIntegrityCheck: () => Promise<IntegrityValidationResult>;
}

interface EnterpriseRelationshipContextValue {
  readonly state: EnterpriseRelationshipState;
  readonly actions: EnterpriseRelationshipActions;
}

// ============================================================================
// STATE REDUCER
// ============================================================================

type EnterpriseRelationshipActionType =
  | { type: 'INITIALIZE_START' }
  | { type: 'INITIALIZE_SUCCESS' }
  | { type: 'INITIALIZE_FAILURE'; payload: { error: string } }
  | { type: 'OPERATION_START' }
  | { type: 'OPERATION_SUCCESS'; payload: { responseTime: number } }
  | { type: 'OPERATION_FAILURE'; payload: { error: string; responseTime: number } }
  | { type: 'UPDATE_PERFORMANCE'; payload: Partial<EnterpriseRelationshipState['performance']> }
  | { type: 'CLEAR_ERROR' };

function enterpriseRelationshipReducer(
  state: EnterpriseRelationshipState,
  action: EnterpriseRelationshipActionType
): EnterpriseRelationshipState {
  switch (action.type) {
    case 'INITIALIZE_START':
      return {
        ...state,
        isInitialized: false,
        globalLoading: true,
        globalError: null
      };

    case 'INITIALIZE_SUCCESS':
      return {
        ...state,
        isInitialized: true,
        globalLoading: false,
        globalError: null
      };

    case 'INITIALIZE_FAILURE':
      return {
        ...state,
        isInitialized: false,
        globalLoading: false,
        globalError: action.payload.error
      };

    case 'OPERATION_START':
      return {
        ...state,
        globalLoading: true,
        globalError: null
      };

    case 'OPERATION_SUCCESS':
      return {
        ...state,
        globalLoading: false,
        globalError: null,
        stats: {
          ...state.stats,
          totalOperations: state.stats.totalOperations + 1,
          successfulOperations: state.stats.successfulOperations + 1,
          lastOperationTimestamp: new Date()
        },
        performance: {
          ...state.performance,
          averageResponseTime: calculateAverageResponseTime(
            state.performance.averageResponseTime,
            action.payload.responseTime,
            state.stats.totalOperations
          )
        }
      };

    case 'OPERATION_FAILURE':
      return {
        ...state,
        globalLoading: false,
        globalError: action.payload.error,
        stats: {
          ...state.stats,
          totalOperations: state.stats.totalOperations + 1,
          failedOperations: state.stats.failedOperations + 1,
          lastOperationTimestamp: new Date()
        }
      };

    case 'UPDATE_PERFORMANCE':
      return {
        ...state,
        performance: {
          ...state.performance,
          ...action.payload
        }
      };

    case 'CLEAR_ERROR':
      return {
        ...state,
        globalError: null
      };

    default:
      return state;
  }
}

// ============================================================================
// INITIAL STATE
// ============================================================================

const initialState: EnterpriseRelationshipState = {
  isInitialized: false,
  globalLoading: false,
  globalError: null,
  stats: {
    totalOperations: 0,
    successfulOperations: 0,
    failedOperations: 0,
    lastOperationTimestamp: null
  },
  performance: {
    averageResponseTime: 0,
    cacheHitRate: 0,
    integrityScore: 100, // Start optimistically
    lastIntegrityCheck: null
  }
};

// ============================================================================
// CONTEXT CREATION
// ============================================================================

const EnterpriseRelationshipContext = createContext<EnterpriseRelationshipContextValue | null>(null);

// ============================================================================
// PROVIDER COMPONENT
// ============================================================================

interface EnterpriseRelationshipProviderProps {
  readonly children: React.ReactNode;
  readonly autoInitialize?: boolean;
  readonly performanceMonitoring?: boolean;
  readonly integrityCheckInterval?: number; // in milliseconds
}

export function EnterpriseRelationshipProvider({
  children,
  autoInitialize = true,
  performanceMonitoring = true,
  integrityCheckInterval = 30 * 60 * 1000 // 30 minutes
}: EnterpriseRelationshipProviderProps): JSX.Element {
  const [state, dispatch] = useReducer(enterpriseRelationshipReducer, initialState);
  const relationships = useEnterpriseRelationships();

  // ========================================
  // INITIALIZATION
  // ========================================

  const initializeSystem = useCallback(async (): Promise<void> => {
    dispatch({ type: 'INITIALIZE_START' });

    try {
      // 🔍 Initial integrity check
      if (performanceMonitoring) {
        const integrityResult = await relationships.validateIntegrity();
        dispatch({
          type: 'UPDATE_PERFORMANCE',
          payload: {
            integrityScore: integrityResult.isValid ? 100 : calculateIntegrityScore(integrityResult),
            lastIntegrityCheck: new Date()
          }
        });
      }

      dispatch({ type: 'INITIALIZE_SUCCESS' });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'System initialization failed';
      dispatch({ type: 'INITIALIZE_FAILURE', payload: { error: errorMessage } });
    }
  }, [relationships, performanceMonitoring]);

  // Auto-initialize on mount
  useEffect(() => {
    if (autoInitialize) {
      initializeSystem();
    }
  }, [autoInitialize, initializeSystem]);

  // ========================================
  // PERIODIC INTEGRITY CHECKS
  // ========================================

  useEffect(() => {
    if (!performanceMonitoring || !state.isInitialized) return;

    const intervalId = setInterval(async () => {
      try {
        const integrityResult = await relationships.validateIntegrity();
        dispatch({
          type: 'UPDATE_PERFORMANCE',
          payload: {
            integrityScore: integrityResult.isValid ? 100 : calculateIntegrityScore(integrityResult),
            lastIntegrityCheck: new Date()
          }
        });
      } catch (error) {
        console.warn('🚨 Periodic integrity check failed:', error);
      }
    }, integrityCheckInterval);

    return () => clearInterval(intervalId);
  }, [relationships, performanceMonitoring, integrityCheckInterval, state.isInitialized]);

  // ========================================
  // ENHANCED OPERATION WRAPPERS
  // ========================================

  const createRelationshipWithMetrics = useCallback(async (
    parentType: EntityType,
    parentId: string,
    childType: EntityType,
    childId: string,
    options?: CreateRelationshipOptions
  ): Promise<RelationshipOperationResult> => {
    const startTime = Date.now();
    dispatch({ type: 'OPERATION_START' });

    try {
      const result = await relationships.createRelationship(parentType, parentId, childType, childId, options);
      const responseTime = Date.now() - startTime;

      if (result.success) {
        dispatch({ type: 'OPERATION_SUCCESS', payload: { responseTime } });
      } else {
        dispatch({ type: 'OPERATION_FAILURE', payload: { error: 'Relationship creation failed', responseTime } });
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const responseTime = Date.now() - startTime;
      dispatch({ type: 'OPERATION_FAILURE', payload: { error: errorMessage, responseTime } });
      throw error;
    }
  }, [relationships]);

  const removeRelationshipWithMetrics = useCallback(async (
    relationshipId: string,
    options?: RemoveRelationshipOptions
  ): Promise<RelationshipOperationResult> => {
    const startTime = Date.now();
    dispatch({ type: 'OPERATION_START' });

    try {
      const result = await relationships.removeRelationship(relationshipId, options);
      const responseTime = Date.now() - startTime;

      if (result.success) {
        dispatch({ type: 'OPERATION_SUCCESS', payload: { responseTime } });
      } else {
        dispatch({ type: 'OPERATION_FAILURE', payload: { error: 'Relationship removal failed', responseTime } });
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const responseTime = Date.now() - startTime;
      dispatch({ type: 'OPERATION_FAILURE', payload: { error: errorMessage, responseTime } });
      throw error;
    }
  }, [relationships]);

  // ========================================
  // PERFORMANCE METRICS
  // ========================================

  const getPerformanceMetrics = useCallback(() => {
    const cacheStats = relationships.getCacheStats();
    const totalCacheEntries = cacheStats.childrenCacheSize + cacheStats.parentsCacheSize + cacheStats.hierarchiesCacheSize;
    const cacheHitRate = totalCacheEntries > 0 ? (state.stats.successfulOperations / state.stats.totalOperations) * 100 : 0;

    dispatch({
      type: 'UPDATE_PERFORMANCE',
      payload: { cacheHitRate }
    });

    return {
      cacheStats,
      operationStats: state.stats,
      performanceStats: state.performance
    };
  }, [relationships, state.stats, state.performance]);

  // ========================================
  // SYSTEM UTILITIES
  // ========================================

  const runIntegrityCheck = useCallback(async (): Promise<IntegrityValidationResult> => {
    try {
      const result = await relationships.validateIntegrity();
      dispatch({
        type: 'UPDATE_PERFORMANCE',
        payload: {
          integrityScore: result.isValid ? 100 : calculateIntegrityScore(result),
          lastIntegrityCheck: new Date()
        }
      });
      return result;
    } catch (error) {
      dispatch({ type: 'OPERATION_FAILURE', payload: { error: 'Integrity check failed', responseTime: 0 } });
      throw error;
    }
  }, [relationships]);

  // ========================================
  // CONTEXT VALUE
  // ========================================

  const contextValue = useMemo<EnterpriseRelationshipContextValue>(() => ({
    state,
    actions: {
      createRelationship: createRelationshipWithMetrics,
      removeRelationship: removeRelationshipWithMetrics,
      getChildren: relationships.getChildren,
      getParent: relationships.getParent,
      getHierarchy: relationships.getHierarchy,
      validateIntegrity: relationships.validateIntegrity,
      cascadeDelete: relationships.cascadeDelete,
      getAuditTrail: relationships.getAuditTrail,
      invalidateCache: relationships.invalidateCache,
      getPerformanceMetrics,
      reinitializeSystem: initializeSystem,
      runIntegrityCheck
    }
  }), [
    state,
    createRelationshipWithMetrics,
    removeRelationshipWithMetrics,
    relationships,
    getPerformanceMetrics,
    initializeSystem,
    runIntegrityCheck
  ]);

  return (
    <EnterpriseRelationshipContext.Provider value={contextValue}>
      {children}
    </EnterpriseRelationshipContext.Provider>
  );
}

// ============================================================================
// CONTEXT HOOK
// ============================================================================

export function useEnterpriseRelationshipContext(): EnterpriseRelationshipContextValue {
  const context = useContext(EnterpriseRelationshipContext);

  if (!context) {
    throw new Error(
      '🚨 useEnterpriseRelationshipContext must be used within an EnterpriseRelationshipProvider. ' +
      'Ensure your component is wrapped with <EnterpriseRelationshipProvider>.'
    );
  }

  return context;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function calculateAverageResponseTime(
  currentAverage: number,
  newResponseTime: number,
  totalOperations: number
): number {
  if (totalOperations === 0) return newResponseTime;
  return ((currentAverage * (totalOperations - 1)) + newResponseTime) / totalOperations;
}

function calculateIntegrityScore(result: IntegrityValidationResult): number {
  const totalViolations = result.violations.length;
  const criticalViolations = result.violations.filter(v => v.severity === 'CRITICAL').length;
  const highViolations = result.violations.filter(v => v.severity === 'HIGH').length;

  if (totalViolations === 0) return 100;

  // Weight violations by severity
  const weightedScore = Math.max(0, 100 - (
    (criticalViolations * 30) + // Critical violations are worth 30 points each
    (highViolations * 10) + // High violations are worth 10 points each
    ((totalViolations - criticalViolations - highViolations) * 5) // Medium/Low are worth 5 points each
  ));

  return Math.round(weightedScore);
}

// ============================================================================
// ENTERPRISE MONITORING COMPONENT
// ============================================================================

interface RelationshipMonitorProps {
  readonly showDetails?: boolean;
  readonly className?: string;
}

export function RelationshipMonitor({
  showDetails = false,
  className = ''
}: RelationshipMonitorProps): JSX.Element | null {
  const { state, actions } = useEnterpriseRelationshipContext();

  if (!showDetails && !state.globalError) {
    return null; // Only show when there are issues or details are requested
  }

  const metrics = actions.getPerformanceMetrics();

  return (
    <div className={`enterprise-relationship-monitor ${className}`}>
      {state.globalError && (
        <div className="error-panel">
          <h4>🚨 Relationship Engine Error</h4>
          <p>{state.globalError}</p>
        </div>
      )}

      {showDetails && (
        <div className="metrics-panel">
          <h4>📊 Enterprise Relationship Metrics</h4>
          <div className="metrics-grid">
            <div className="metric">
              <span>Operations</span>
              <span>{metrics.operationStats.totalOperations}</span>
            </div>
            <div className="metric">
              <span>Success Rate</span>
              <span>
                {metrics.operationStats.totalOperations > 0
                  ? Math.round((metrics.operationStats.successfulOperations / metrics.operationStats.totalOperations) * 100)
                  : 0}%
              </span>
            </div>
            <div className="metric">
              <span>Avg Response</span>
              <span>{Math.round(metrics.performanceStats.averageResponseTime)}ms</span>
            </div>
            <div className="metric">
              <span>Integrity Score</span>
              <span>{Math.round(metrics.performanceStats.integrityScore)}%</span>
            </div>
            <div className="metric">
              <span>Cache Entries</span>
              <span>
                {metrics.cacheStats.childrenCacheSize +
                 metrics.cacheStats.parentsCacheSize +
                 metrics.cacheStats.hierarchiesCacheSize}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}