/**
 * =============================================================================
 * 🏢 ENTERPRISE: Active Workspace Context
 * =============================================================================
 *
 * React Context για active workspace management.
 * Implements ΤΕΛΕΙΩΤΙΚΗ ΕΝΤΟΛΗ requirement:
 * "Κάθε δημιουργία/ανέβασμα χρησιμοποιεί το active workspaceId"
 *
 * @module contexts/WorkspaceContext
 * @enterprise ADR-032 - Workspace-based Multi-Tenancy
 *
 * @example
 * ```typescript
 * import { useWorkspace } from '@/contexts/WorkspaceContext';
 *
 * function MyComponent() {
 *   const { activeWorkspace, switchWorkspace } = useWorkspace();
 *
 *   return (
 *     <div>
 *       <p>Current: {activeWorkspace?.displayName}</p>
 *       <button onClick={() => switchWorkspace('ws_company_001')}>
 *         Switch
 *       </button>
 *     </div>
 *   );
 * }
 * ```
 */

'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { WorkspaceService } from '@/services/workspace.service';
import type { Workspace, ActiveWorkspaceContext } from '@/types/workspace';
import { useAuth } from '@/auth/contexts/AuthContext';

import { createModuleLogger } from '@/lib/telemetry';
import { safeGetItem, safeSetItem, STORAGE_KEYS } from '@/lib/storage';
const logger = createModuleLogger('WorkspaceContext');

// ============================================================================
// CONTEXT CREATION
// ============================================================================

const WorkspaceContext = createContext<ActiveWorkspaceContext | null>(null);

// ============================================================================
// PROVIDER COMPONENT
// ============================================================================

export interface WorkspaceProviderProps {
  children: React.ReactNode;
}

/**
 * Workspace Provider Component
 *
 * Provides active workspace context to entire app.
 * Persists selected workspace in localStorage.
 */
export function WorkspaceProvider({ children }: WorkspaceProviderProps) {
  // ==========================================================================
  // STATE
  // ==========================================================================

  const { user } = useAuth();
  const [activeWorkspace, setActiveWorkspace] = useState<Workspace | null>(null);
  const [availableWorkspaces, setAvailableWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(false); // ⚡ ENTERPRISE: Start false for lazy loading
  const [error, setError] = useState<Error | null>(null);

  // ⚡ ENTERPRISE PERFORMANCE (2026-01-27): Lazy initialization
  // Pattern: SharedPropertiesProvider - Only load when needed
  // This prevents Firestore queries on login/landing pages
  const [activated, setActivated] = useState(false);

  // ==========================================================================
  // LOAD WORKSPACES
  // ==========================================================================

  /**
   * Load available workspaces for current user
   */
  const loadWorkspaces = useCallback(async () => {
    if (!user) {
      setAvailableWorkspaces([]);
      setActiveWorkspace(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Fetch workspaces accessible by user
      const workspaces = await WorkspaceService.listWorkspacesForUser(user.uid);

      setAvailableWorkspaces(workspaces);

      // Try to restore previously selected workspace from localStorage
      const savedWorkspaceId = safeGetItem(STORAGE_KEYS.ACTIVE_WORKSPACE, '');

      if (savedWorkspaceId) {
        const savedWorkspace = workspaces.find((w) => w.id === savedWorkspaceId);
        if (savedWorkspace) {
          setActiveWorkspace(savedWorkspace);
          logger.info(`[WorkspaceContext] Restored workspace: ${savedWorkspaceId}`);
          return;
        }
      }

      // Fallback: Auto-select first workspace if available
      if (workspaces.length > 0) {
        setActiveWorkspace(workspaces[0]);
        safeSetItem(STORAGE_KEYS.ACTIVE_WORKSPACE, workspaces[0].id);
        logger.info(`[WorkspaceContext] Auto-selected first workspace: ${workspaces[0].id}`);
      } else {
        logger.warn('[WorkspaceContext] No workspaces available for user');
      }
    } catch (err) {
      logger.error('[WorkspaceContext] Failed to load workspaces', { error: err });
      setError(err instanceof Error ? err : new Error('Failed to load workspaces'));
    } finally {
      setLoading(false);
    }
  }, [user]);

  // ⚡ ENTERPRISE PERFORMANCE: Activate function - called by useWorkspace hook
  const activate = useCallback(() => {
    if (!activated) {
      logger.info('[WorkspaceContext] Lazy activation triggered');
      setActivated(true);
    }
  }, [activated]);

  // ⚡ ENTERPRISE: Load workspaces ONLY when activated (not on mount)
  // This prevents Firestore queries on login/landing pages
  useEffect(() => {
    if (!activated) {
      return; // Skip if not activated (lazy initialization)
    }
    loadWorkspaces();
  }, [activated, loadWorkspaces]);

  // ==========================================================================
  // SWITCH WORKSPACE
  // ==========================================================================

  /**
   * Switch to a different workspace
   *
   * @param workspaceId - Workspace ID to switch to
   */
  const switchWorkspace = useCallback(
    async (workspaceId: string) => {
      // Find workspace in available list
      const workspace = availableWorkspaces.find((w) => w.id === workspaceId);

      if (!workspace) {
        logger.error(`[WorkspaceContext] Workspace not found: ${workspaceId}`);
        throw new Error(`Workspace not found: ${workspaceId}`);
      }

      // Update active workspace
      setActiveWorkspace(workspace);

      // Persist to localStorage
      safeSetItem(STORAGE_KEYS.ACTIVE_WORKSPACE, workspaceId);

      logger.info(`[WorkspaceContext] Switched to workspace: ${workspaceId}`);

      // Dispatch custom event for other components to react
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('workspace-changed', {
            detail: { workspace },
          })
        );
      }
    },
    [availableWorkspaces]
  );

  // ==========================================================================
  // REFRESH WORKSPACES
  // ==========================================================================

  /**
   * Refresh workspaces list
   */
  const refreshWorkspaces = useCallback(async () => {
    await loadWorkspaces();
  }, [loadWorkspaces]);

  // ==========================================================================
  // CONTEXT VALUE
  // ==========================================================================

  const contextValue: ActiveWorkspaceContext = useMemo(
    () => ({
      activeWorkspace,
      availableWorkspaces,
      loading,
      error,
      switchWorkspace,
      refreshWorkspaces,
      activate, // ⚡ ENTERPRISE: Lazy activation
    }),
    [activeWorkspace, availableWorkspaces, loading, error, switchWorkspace, refreshWorkspaces, activate]
  );

  // ==========================================================================
  // RENDER
  // ==========================================================================

  return <WorkspaceContext.Provider value={contextValue}>{children}</WorkspaceContext.Provider>;
}

// ============================================================================
// HOOK
// ============================================================================

/**
 * Hook to access workspace context
 *
 * ⚡ ENTERPRISE PERFORMANCE: This hook triggers lazy activation.
 * Firestore queries only run when a component actually uses workspaces.
 *
 * @throws Error if used outside WorkspaceProvider
 * @returns Active workspace context
 */
export function useWorkspace(): ActiveWorkspaceContext {
  const context = useContext(WorkspaceContext);

  if (!context) {
    throw new Error('useWorkspace must be used within WorkspaceProvider');
  }

  // ⚡ ENTERPRISE: Trigger lazy activation ONLY ONCE on first use
  // Using ref to prevent re-activation on every render (avoids dependency recalculation)
  const activatedRef = useRef(false);
  useEffect(() => {
    if (!activatedRef.current) {
      context.activate();
      activatedRef.current = true;
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- Intentionally empty: activate only on mount

  return context;
}

/**
 * Hook to get current workspace ID (convenience)
 *
 * @returns Current workspace ID or null
 */
export function useWorkspaceId(): string | null {
  const { activeWorkspace } = useWorkspace();
  return activeWorkspace?.id || null;
}

/**
 * Hook to require workspace (throws if none selected)
 * Implements ΤΕΛΕΙΩΤΙΚΗ ΕΝΤΟΛΗ: "Αν δεν υπάρχει active workspace, stop/blocked UX"
 *
 * @returns Active workspace
 * @throws Error if no workspace selected
 */
export function useRequireWorkspace(): Workspace {
  const { activeWorkspace } = useWorkspace();

  if (!activeWorkspace) {
    throw new Error('No active workspace selected. Please select a workspace first.');
  }

  return activeWorkspace;
}
