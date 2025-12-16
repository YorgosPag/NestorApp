import { useState, useEffect, useCallback } from 'react';
import { collection, query, orderBy, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { InfiniteScrollPagination, PaginatedResult } from '@/lib/pagination';
import { COLLECTIONS } from '@/config/firestore-collections';

// =============================================================================
// 🚀 PAGINATED PROJECTS HOOK - ENTERPRISE PERFORMANCE
// =============================================================================
//
// ✅ Loads projects in pages instead of all at once
// ❌ No more 1000+ project loading lag
// 🛡️ Memory efficient with Firebase cursors
// 📊 Supports filtering by company and status
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

export function useFirestoreProjectsPaginated(
  initialFilters: ProjectFilters = {},
  pageSize: number = 20
): UseFirestoreProjectsPaginatedResult {
  const [projects, setProjects] = useState<FirestoreProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasNext, setHasNext] = useState(false);
  const [filters, setFilters] = useState<ProjectFilters>(initialFilters);
  const [pagination, setPagination] = useState<InfiniteScrollPagination<FirestoreProject> | null>(null);

  // ==========================================================================
  // QUERY BUILDER
  // ==========================================================================

  const buildQuery = useCallback((currentFilters: ProjectFilters) => {
    let projectsQuery = query(
      collection(db, COLLECTIONS.PROJECTS),
      orderBy('lastUpdate', 'desc') // Most recent first
    );

    // Add filters
    if (currentFilters.companyId) {
      projectsQuery = query(projectsQuery, where('companyId', '==', currentFilters.companyId));
    }

    if (currentFilters.status) {
      projectsQuery = query(projectsQuery, where('status', '==', currentFilters.status));
    }

    return projectsQuery;
  }, []);

  // ==========================================================================
  // DOCUMENT MAPPER
  // ==========================================================================

  const mapDocument = useCallback((doc: any): FirestoreProject => {
    const data = doc.data();

    let mappedStatus = data.status;
    if (data.status === 'construction' || data.status === 'active') {
      mappedStatus = 'in_progress';
    }

    return {
      id: doc.id,
      ...data,
      status: mappedStatus,
      startDate: data.startDate || '',
      completionDate: data.completionDate || ''
    } as FirestoreProject;
  }, []);

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
  // PAGINATION SETUP
  // ==========================================================================

  const initializePagination = useCallback(() => {
    console.log('🔄 [ProjectsPaginated] Initializing pagination with filters:', filters);

    const projectsQuery = buildQuery(filters);
    const newPagination = new InfiniteScrollPagination(projectsQuery, mapDocument, pageSize);
    setPagination(newPagination);
    setProjects([]);
    setHasNext(false);

    return newPagination;
  }, [buildQuery, mapDocument, pageSize, filters]);

  // ==========================================================================
  // LOAD FUNCTIONS
  // ==========================================================================

  const loadNext = useCallback(async () => {
    if (!pagination || loading) return;

    try {
      setLoading(true);
      setError(null);

      console.log('📥 [ProjectsPaginated] Loading next page...');
      const result: PaginatedResult<FirestoreProject> = await pagination.loadNext();

      const allProjects = pagination.getAllItems();
      const filtered = filteredProjects(allProjects);

      setProjects(filtered);
      setHasNext(result.hasNext);

      console.log('✅ [ProjectsPaginated] Loaded', result.items.length, 'projects, hasNext:', result.hasNext);
    } catch (err) {
      console.error('❌ [ProjectsPaginated] Load failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to load projects');
    } finally {
      setLoading(false);
    }
  }, [pagination, loading, filteredProjects]);

  const refresh = useCallback(async () => {
    console.log('🔄 [ProjectsPaginated] Refreshing...');

    const newPagination = initializePagination();
    setPagination(newPagination);

    // Load first page
    try {
      setLoading(true);
      setError(null);

      const result: PaginatedResult<FirestoreProject> = await newPagination.loadNext();
      const filtered = filteredProjects(result.items);

      setProjects(filtered);
      setHasNext(result.hasNext);

      console.log('✅ [ProjectsPaginated] Refresh complete, loaded', result.items.length, 'projects');
    } catch (err) {
      console.error('❌ [ProjectsPaginated] Refresh failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to refresh projects');
    } finally {
      setLoading(false);
    }
  }, [initializePagination, filteredProjects]);

  // ==========================================================================
  // FILTER UPDATE
  // ==========================================================================

  const updateFilters = useCallback((newFilters: ProjectFilters) => {
    console.log('🎯 [ProjectsPaginated] Updating filters:', newFilters);
    setFilters(newFilters);
  }, []);

  // ==========================================================================
  // EFFECTS
  // ==========================================================================

  // Initialize pagination on mount or filter change
  useEffect(() => {
    const newPagination = initializePagination();
    setPagination(newPagination);

    // Load first page
    loadNext();
  }, [filters.companyId, filters.status]); // Only rebuild on server-side filters

  // Apply client-side search filter
  useEffect(() => {
    if (pagination) {
      const allProjects = pagination.getAllItems();
      const filtered = filteredProjects(allProjects);
      setProjects(filtered);
    }
  }, [pagination, filteredProjects]);

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