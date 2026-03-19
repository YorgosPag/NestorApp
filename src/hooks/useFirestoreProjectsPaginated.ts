import { useState, useEffect, useCallback, useRef } from 'react';
import { orderBy, where, startAfter, type QueryConstraint, type DocumentSnapshot, type DocumentData } from 'firebase/firestore';
import { firestoreQueryService } from '@/services/firestore';
// 🏢 ENTERPRISE: Centralized real-time service for cross-page sync
import { RealtimeService, type ProjectUpdatedPayload } from '@/services/realtime';
import { createModuleLogger } from '@/lib/telemetry';
import { applyUpdates } from '@/lib/utils';
import { getErrorMessage } from '@/lib/error-utils';

const logger = createModuleLogger('useFirestoreProjectsPaginated');

// =============================================================================
// 🚀 PAGINATED PROJECTS HOOK - ENTERPRISE PERFORMANCE
// =============================================================================
//
// ✅ ADR-214 Phase 6: Uses firestoreQueryService (tenant-aware, centralized)
// ✅ Loads projects in pages instead of all at once
// 🛡️ Memory efficient with Firebase cursors
// 📊 Supports filtering by status + client-side search
//
// =============================================================================

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

export interface ProjectFilters {
  companyId?: string;
  status?: FirestoreProject['status'];
  searchTerm?: string;
}

export interface UseFirestoreProjectsPaginatedResult {
  projects: FirestoreProject[];
  loading: boolean;
  error: string | null;
  hasNext: boolean;
  loadNext: () => Promise<void>;
  refresh: () => Promise<void>;
  filters: ProjectFilters;
  setFilters: (filters: ProjectFilters) => void;
  totalShown: number;
}

// ==========================================================================
// DOCUMENT TRANSFORM
// ==========================================================================

function toProject(raw: DocumentData & { id: string }): FirestoreProject {
  let mappedStatus = raw.status as string;
  if (raw.status === 'construction' || raw.status === 'active') {
    mappedStatus = 'in_progress';
  }

  return {
    id: raw.id,
    name: (raw.name as string) || '',
    title: (raw.title as string) || '',
    status: mappedStatus as FirestoreProject['status'],
    company: (raw.company as string) || '',
    companyId: (raw.companyId as string) || '',
    address: (raw.address as string) || '',
    city: (raw.city as string) || '',
    progress: (raw.progress as number) || 0,
    totalValue: (raw.totalValue as number) || 0,
    startDate: (raw.startDate as string) || '',
    completionDate: (raw.completionDate as string) || '',
    lastUpdate: (raw.lastUpdate as string) || '',
    totalArea: (raw.totalArea as number) || 0,
  };
}

export function useFirestoreProjectsPaginated(
  initialFilters: ProjectFilters = {},
  pageSize: number = 20
): UseFirestoreProjectsPaginatedResult {
  const [projects, setProjects] = useState<FirestoreProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasNext, setHasNext] = useState(false);
  const [filters, setFilters] = useState<ProjectFilters>(initialFilters);

  // Refs to avoid stale closure issues in loadNext/refresh callbacks
  const allProjectsRef = useRef<FirestoreProject[]>([]);
  const lastDocRef = useRef<DocumentSnapshot | null>(null);

  // ==========================================================================
  // CLIENT-SIDE SEARCH FILTER
  // ==========================================================================

  const filteredProjects = useCallback((allProjects: FirestoreProject[]): FirestoreProject[] => {
    if (!filters.searchTerm) return allProjects;

    const searchLower = filters.searchTerm.toLowerCase();
    return allProjects.filter(project =>
      project.name.toLowerCase().includes(searchLower) ||
      project.title.toLowerCase().includes(searchLower) ||
      project.company.toLowerCase().includes(searchLower) ||
      project.address.toLowerCase().includes(searchLower) ||
      project.city.toLowerCase().includes(searchLower)
    );
  }, [filters.searchTerm]);

  // ==========================================================================
  // LOAD FUNCTIONS (firestoreQueryService — ADR-214)
  // ==========================================================================

  const loadNext = useCallback(async () => {
    if (loading) return;

    setLoading(true);
    setError(null);

    try {
      const constraints: QueryConstraint[] = [orderBy('lastUpdate', 'desc')];
      // companyId: auto-injected by tenant config — NOT needed explicitly
      if (filters.status) {
        constraints.push(where('status', '==', filters.status));
      }
      if (lastDocRef.current) {
        constraints.push(startAfter(lastDocRef.current));
      }

      logger.info('Loading next page');
      const result = await firestoreQueryService.getAll<DocumentData & { id: string }>('PROJECTS', {
        constraints,
        maxResults: pageSize,
      });

      const newItems = result.documents.map(toProject);
      const accumulated = [...allProjectsRef.current, ...newItems];
      allProjectsRef.current = accumulated;
      setProjects(filteredProjects(accumulated));
      lastDocRef.current = result.lastDocument;
      setHasNext(result.size === pageSize);

      logger.info('Loaded projects', { count: result.size, hasNext: result.size === pageSize });
    } catch (err) {
      logger.error('Load failed', { error: err });
      setError(getErrorMessage(err, 'Failed to load projects'));
    } finally {
      setLoading(false);
    }
  }, [loading, filters.status, pageSize, filteredProjects]);

  const refresh = useCallback(async () => {
    logger.info('Refreshing');

    // Reset cursor + accumulator
    allProjectsRef.current = [];
    lastDocRef.current = null;
    setHasNext(false);

    setLoading(true);
    setError(null);

    try {
      const constraints: QueryConstraint[] = [orderBy('lastUpdate', 'desc')];
      if (filters.status) {
        constraints.push(where('status', '==', filters.status));
      }

      const result = await firestoreQueryService.getAll<DocumentData & { id: string }>('PROJECTS', {
        constraints,
        maxResults: pageSize,
      });

      const newItems = result.documents.map(toProject);
      allProjectsRef.current = newItems;
      setProjects(filteredProjects(newItems));
      lastDocRef.current = result.lastDocument;
      setHasNext(result.size === pageSize);

      logger.info('Refresh complete', { count: result.size });
    } catch (err) {
      logger.error('Refresh failed', { error: err });
      setError(getErrorMessage(err, 'Failed to refresh projects'));
    } finally {
      setLoading(false);
    }
  }, [filters.status, pageSize, filteredProjects]);

  // ==========================================================================
  // FILTER UPDATE
  // ==========================================================================

  const updateFilters = useCallback((newFilters: ProjectFilters) => {
    logger.info('Updating filters', { newFilters });
    setFilters(newFilters);
  }, []);

  // ==========================================================================
  // EFFECTS
  // ==========================================================================

  // 🏢 ENTERPRISE: Centralized Real-time Service (ZERO DUPLICATES)
  // Uses RealtimeService.subscribeToProjectUpdates() for cross-page sync
  useEffect(() => {
    const handleProjectUpdate = (payload: ProjectUpdatedPayload) => {
      logger.info('Applying update for project', { projectId: payload.projectId });

      setProjects(prev => prev.map(project =>
        project.id === payload.projectId
          ? applyUpdates(project, payload.updates)
          : project
      ));
    };

    // Subscribe to project updates (same-page + cross-page)
    const unsubscribe = RealtimeService.subscribe('PROJECT_UPDATED', handleProjectUpdate, {
      checkPendingOnMount: false
    });

    return unsubscribe;
  }, []);

  // Initialize on mount or server-side filter change (status)
  // companyId is auto-injected by tenant config — no need to watch it
  useEffect(() => {
    allProjectsRef.current = [];
    lastDocRef.current = null;
    setHasNext(false);
    setLoading(false); // Reset loading so loadNext can proceed

    // Trigger first page load
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const constraints: QueryConstraint[] = [orderBy('lastUpdate', 'desc')];
        if (filters.status) {
          constraints.push(where('status', '==', filters.status));
        }

        const result = await firestoreQueryService.getAll<DocumentData & { id: string }>('PROJECTS', {
          constraints,
          maxResults: pageSize,
        });

        const newItems = result.documents.map(toProject);
        allProjectsRef.current = newItems;
        setProjects(filteredProjects(newItems));
        lastDocRef.current = result.lastDocument;
        setHasNext(result.size === pageSize);

        logger.info('Initial load complete', { count: result.size });
      } catch (err) {
        logger.error('Initial load failed', { error: err });
        setError(getErrorMessage(err, 'Failed to load projects'));
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.status, pageSize]);

  // Apply client-side search filter when searchTerm changes
  useEffect(() => {
    const filtered = filteredProjects(allProjectsRef.current);
    setProjects(filtered);
  }, [filteredProjects]);

  // ==========================================================================
  // RETURN STATE
  // ==========================================================================

  return {
    projects,
    loading,
    error,
    hasNext,
    loadNext,
    refresh,
    filters,
    setFilters: updateFilters,
    totalShown: projects.length
  };
}
