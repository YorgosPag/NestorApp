import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/auth/hooks/useAuth';
import { apiClient } from '@/lib/api/enterprise-api-client';
// 🏢 ENTERPRISE: Centralized real-time service for cross-page sync
import { RealtimeService, type ProjectUpdatedPayload } from '@/services/realtime';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('useFirestoreProjects');

/**
 * 🏗️ FIRESTORE PROJECTS HOOK
 *
 * Enterprise-grade hook για loading projects via /api/projects/list
 * Option A Architecture: Διαχωρισμένο από /api/audit/bootstrap
 *
 * @module hooks/useFirestoreProjects
 * @version 3.0.0
 * @enterprise Phase 4 - Authenticated API Client + Auth-Ready Gating
 */

export interface FirestoreProject {
  id: string;
  name: string;
  title: string;
  status: 'planning' | 'in_progress' | 'completed' | 'on_hold' | 'cancelled';
  company: string;
  companyId: string;
  address: string;
  city: string;
  progress: number;
  totalValue: number;
  startDate: string;
  completionDate: string;
  lastUpdate: string;
  totalArea: number;
}

// ============================================================================
// API RESPONSE TYPE - UNWRAPPED DATA
// ============================================================================

/**
 * 🏢 ENTERPRISE: Response data type (apiClient returns unwrapped data)
 *
 * The endpoint returns: { success: true, data: { projects, count, ... } }
 * But apiClient.get() unwraps it and returns just the data object.
 */
interface ProjectListData {
  projects: FirestoreProject[];
  count: number;
  loadedAt: string;
  source: 'cache' | 'firestore';
}

// ============================================================================
// MAIN HOOK
// ============================================================================

export function useFirestoreProjects() {
  // 🔐 ENTERPRISE: Wait for auth state before making API calls
  const { user, loading: authLoading } = useAuth();

  const [projects, setProjects] = useState<FirestoreProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // 🏢 ENTERPRISE: Trigger for manual refetch
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // 🏢 ENTERPRISE: AbortController ref για proper cleanup
  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * 🏢 ENTERPRISE: Manual refetch function
   * Call this after successful updates to refresh the projects list
   */
  const refetch = () => {
    logger.info('Manual refetch triggered');
    setRefreshTrigger(prev => prev + 1);
  };

  // 🏢 ENTERPRISE: Centralized Real-time Service (ZERO DUPLICATES)
  // Uses RealtimeService.subscribeToProjectUpdates() for cross-page sync
  useEffect(() => {
    const handleProjectUpdate = (payload: ProjectUpdatedPayload) => {
      logger.info('Applying update for project', { projectId: payload.projectId });

      setProjects(prev => prev.map(project =>
        project.id === payload.projectId
          ? { ...project, ...payload.updates }
          : project
      ));
    };

    // Subscribe to project updates (same-page + cross-page)
    const unsubscribe = RealtimeService.subscribe('PROJECT_UPDATED', handleProjectUpdate);

    return unsubscribe;
  }, []);

  useEffect(() => {
    async function fetchProjects() {
      // 🔐 AUTH-READY GATING - Wait for authentication
      if (authLoading) {
        logger.info('Waiting for auth state');
        return;
      }

      if (!user) {
        // User not authenticated - cannot proceed
        setLoading(false);
        setError('User not authenticated');
        return;
      }

      // Cancel any in-flight request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // Create new AbortController for this request
      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        setLoading(true);
        setError(null);

        logger.info('Fetching from /api/projects/list');

        // 🏢 ENTERPRISE: Use centralized API client (automatic Authorization header + unwrap)
        // apiClient.get() returns unwrapped data (not { success, data })
        const result = await apiClient.get<ProjectListData>('/api/projects/list');

        // Check if request was aborted
        if (controller.signal.aborted) {
          logger.info('Request aborted');
          return;
        }

        // 🏢 ENTERPRISE: Validate unwrapped data
        if (!result || !result.projects) {
          throw new Error('Invalid response format from API');
        }

        logger.info('Loaded projects', { count: result.count, source: result.source });

        setProjects(result.projects);

      } catch (err) {
        // Ignore abort errors
        if (err instanceof Error && err.name === 'AbortError') {
          logger.info('Request aborted');
          return;
        }

        logger.error('Fetch projects error', { error: err });

        // 🏢 Enterprise error handling με proper type guards
        if (err instanceof Error) {
          if (err.message.includes('HTTP 401') || err.message.includes('HTTP 403')) {
            setError('🔒 Authorization failed. Please log in again.');
          } else if (err.message.includes('HTTP 5')) {
            setError('⚠️ Server error. Please try again later.');
          } else if (err.message.includes('network') || err.message.includes('fetch')) {
            setError('Network error. Check your connection.');
          } else {
            setError(`Error loading projects: ${err.message}`);
          }
        } else {
          setError('Unknown error loading projects');
        }
      } finally {
        // Only update loading if not aborted
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    fetchProjects();

    // Cleanup: abort request on unmount
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [authLoading, user, refreshTrigger]); // Re-fetch when auth state changes or manual trigger

  return { projects, loading, error, refetch };
}