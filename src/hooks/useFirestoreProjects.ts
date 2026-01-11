import { useState, useEffect, useRef } from 'react';

/**
 * 🏗️ FIRESTORE PROJECTS HOOK
 *
 * Enterprise-grade hook για loading projects via /api/projects/list
 * Option A Architecture: Διαχωρισμένο από /api/audit/bootstrap
 *
 * @module hooks/useFirestoreProjects
 * @version 2.0.0
 * @enterprise Phase 3 - Data Architecture Separation
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
// API RESPONSE TYPE
// ============================================================================

interface ProjectListResponse {
  success: boolean;
  data?: {
    projects: FirestoreProject[];
    count: number;
    loadedAt: string;
    source: 'cache' | 'firestore';
  };
  error?: {
    code: string;
    message: string;
  };
}

// ============================================================================
// MAIN HOOK
// ============================================================================

export function useFirestoreProjects() {
  const [projects, setProjects] = useState<FirestoreProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 🏢 ENTERPRISE: AbortController ref για proper cleanup
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    async function fetchProjects() {
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

        console.log('🏗️ [useFirestoreProjects] Fetching from /api/projects/list...');

        const response = await fetch('/api/projects/list', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          signal: controller.signal,
        });

        // Check if request was aborted
        if (controller.signal.aborted) {
          console.log('🏗️ [useFirestoreProjects] Request aborted');
          return;
        }

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result: ProjectListResponse = await response.json();

        // Check if request was aborted after parsing
        if (controller.signal.aborted) {
          return;
        }

        if (!result.success || !result.data) {
          throw new Error(result.error?.message || 'Unknown API error');
        }

        console.log(`✅ [useFirestoreProjects] Loaded ${result.data.count} projects (source: ${result.data.source})`);

        setProjects(result.data.projects);

      } catch (err) {
        // Ignore abort errors
        if (err instanceof Error && err.name === 'AbortError') {
          console.log('🏗️ [useFirestoreProjects] Request aborted');
          return;
        }

        console.error('❌ [useFirestoreProjects] ERROR:', err);

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
  }, []);

  return { projects, loading, error };
}