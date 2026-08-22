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
 * @enterprise ADR-787 — Η πολυ-οργανισμική πλατφόρμα (Κ-2: το συμβόλαιο του μέλους)
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
import { RealtimeService } from '@/services/realtime';
import type { WorkspaceCreatedPayload, WorkspaceUpdatedPayload } from '@/services/realtime';
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

      // ⛔ ΠΟΤΕ `workspaces[0]` (ADR-787 Ε-3 §7 β).
      // Ήταν **αλφαβητική σειρά**: ο κατάλογος ταξινομείται κατά `displayName`,
      // άρα «ο πρώτος» σήμαινε *«όποιος τυχαίνει να αρχίζει από Α»*. Ο άνθρωπος
      // προσγειώνεται στον **δικό του** χώρο — το γραφείο αν έχει, αλλιώς ο
      // ιδιωτικός, που **υπάρχει πάντα** (Ε-3 §2).
      const landing =
        workspaces.find((w) => w.type === 'company') ??
        workspaces.find((w) => w.type === 'personal') ??
        null;

      if (landing) {
        setActiveWorkspace(landing);
        safeSetItem(STORAGE_KEYS.ACTIVE_WORKSPACE, landing.id);
        logger.info(`[WorkspaceContext] Landing workspace: ${landing.id} (${landing.type})`);
      } else {
        logger.debug('[WorkspaceContext] No workspaces available for user');
      }
    } catch (err) {
      // ─────────────────────────────────────────────────────────────────────
      // 🔴 ΑΓΝΩΣΤΟ ≠ ΚΕΝΟ (N.12 · ADR-787 Ε-5 §4 #3 · §2.7)
      // ─────────────────────────────────────────────────────────────────────
      // Εδώ ζούσε το ζωντανό ελάττωμα: η αποτυχία υποβαθμιζόταν σε `warn`, το
      // `error` **δεν** τιθόταν *«γιατί τα workspaces είναι προαιρετικά»*, και ο
      // κατάλογος γινόταν **κενός** ⇒ ο άνθρωπος διάβαζε **«δεν έχεις χώρους»**
      // ενώ η αλήθεια ήταν **«δεν μπόρεσα να ρωτήσω»**.
      //
      // ⛔ ΜΗΝ ξανακρύψεις αυτό το σφάλμα. Το να μη ρίχνει την εφαρμογή είναι
      //    σωστό· το να **παριστάνει άδειο αποτέλεσμα** δεν είναι. Η οθόνη
      //    οφείλει να μπορεί να ξεχωρίσει τα δύο — γι' αυτό μπαίνει το `error`.
      const message = err instanceof Error ? err.message : String(err);
      logger.error('[WorkspaceContext] Ο κατάλογος χώρων δεν απαντήθηκε — άγνωστο, όχι κενό', {
        error: message,
      });

      setError(err instanceof Error ? err : new Error(message));
      setAvailableWorkspaces([]);
      setActiveWorkspace(null);
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
  // 🏢 ENTERPRISE: Event bus subscribers for workspace sync (ADR-228 Tier 2)
  // ==========================================================================

  useEffect(() => {
    if (!activated) return;

    const handleCreated = (_payload: WorkspaceCreatedPayload) => {
      logger.info('[WorkspaceContext] Workspace created — refreshing list');
      loadWorkspaces();
    };

    const handleUpdated = (payload: WorkspaceUpdatedPayload) => {
      logger.info('[WorkspaceContext] Workspace updated', { workspaceId: payload.workspaceId });
      loadWorkspaces();
    };

    const unsub1 = RealtimeService.subscribe('WORKSPACE_CREATED', handleCreated);
    const unsub2 = RealtimeService.subscribe('WORKSPACE_UPDATED', handleUpdated);

    return () => { unsub1(); unsub2(); };
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
