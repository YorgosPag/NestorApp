/**
 * Navigation Data Hook
 * Handles loading and management of navigation data
 *
 * 🚀 ENTERPRISE PHASE 1: Uses bootstrap endpoint for aggregated loading
 * Eliminates N+1 per-company calls → 1 single bootstrap request
 *
 * 🔐 ENTERPRISE PHASE 2: Auth-ready gating + centralized API client
 * Bootstrap waits for AuthContext ready → prevents 401 errors
 */

import { useState, useRef } from 'react';
import { useAuth } from '@/auth/hooks/useAuth';
import { apiClient } from '@/lib/api/enterprise-api-client';
import { NavigationApiService } from '../services/navigationApi';
import type { NavigationCompany, NavigationProject } from '../types';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('useNavigationData');

// ============================================================================
// TYPES - Bootstrap Response
// ============================================================================

interface BootstrapCompany {
  id: string;
  name: string;
  projectCount: number;
}

interface BootstrapProject {
  id: string;
  projectCode: string | null;
  name: string;
  companyId: string;
  status: string;
  updatedAt: string | null;
  createdAt: string | null;
  totalUnits?: number;
  soldUnits?: number;
  soldAreaM2?: number;
  // 🏢 PERF-001: Building count from bootstrap (eliminates realtime listener)
  buildingCount: number;
}

interface BootstrapResponse {
  companies: BootstrapCompany[];
  projects: BootstrapProject[];
  loadedAt: string;
  source: 'cache' | 'firestore';
  cached: boolean;
}

interface UseNavigationDataReturn {
  loadCompanies: () => Promise<NavigationCompany[]>;
  loadAllProjects: (companies: NavigationCompany[]) => Promise<NavigationProject[]>;
  loadProjectsForCompany: (companyId: string) => Promise<void>;
  loadViaBootstrap: () => Promise<{ companies: NavigationCompany[]; projects: NavigationProject[] }>;
  isLoadingCompanies: boolean;
  isLoadingProjects: boolean;
}

// ============================================================================
// BOOTSTRAP CACHE
// ============================================================================

// Module-level cache for bootstrap data (shared across hook instances)
let bootstrapCache: {
  companies: NavigationCompany[];
  projects: NavigationProject[];
  timestamp: number;
} | null = null;

const BOOTSTRAP_CACHE_TTL = 3 * 60 * 1000; // 3 minutes (matches server cache)

// 🏢 ENTERPRISE: In-flight promise for request de-duplication
// When multiple callers request bootstrap simultaneously, they all receive the SAME promise
// This eliminates duplicate API calls (React Query/SWR pattern)
let inFlightBootstrapPromise: Promise<{ companies: NavigationCompany[]; projects: NavigationProject[] }> | null = null;

export function useNavigationData(): UseNavigationDataReturn {
  // 🔐 ENTERPRISE: Wait for auth state before making API calls
  const { user, loading: authLoading } = useAuth();

  const [isLoadingCompanies, setIsLoadingCompanies] = useState(false);
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);

  // Refs to track loading state and prevent duplicate calls
  const companiesLoadingRef = useRef(false);
  const companiesLoadedRef = useRef(false);
  const companiesDataRef = useRef<NavigationCompany[]>([]);
  const projectsDataRef = useRef<NavigationProject[]>([]);
  // When true, next bootstrap request bypasses server cache
  const bustServerCacheRef = useRef(false);
  // Note: bootstrapLoadingRef removed - replaced with module-level inFlightBootstrapPromise for proper de-duplication

  /**
   * 🚀 ENTERPRISE: Load via bootstrap endpoint (1 request for all data)
   *
   * 🏢 REQUEST DE-DUPLICATION PATTERN:
   * - If cache is valid → return cache immediately
   * - If request is in-flight → return SAME promise (no duplicate API call)
   * - If no cache and no in-flight → start new request and store promise
   *
   * 🔐 AUTH-READY GATING:
   * - Waits for AuthContext to be ready (user authenticated + token available)
   * - Prevents 401 errors from unauthenticated requests
   *
   * This is the enterprise pattern used by React Query, SWR, and Apollo Client.
   */
  const loadViaBootstrap = async (): Promise<{ companies: NavigationCompany[]; projects: NavigationProject[] }> => {
    // 🔐 STEP 0: AUTH-READY GATING - Check authentication state
    // ENTERPRISE FIX: Removed polling loop (closure bug - authLoading never updates inside Promise)
    // The caller (NavigationContext) is responsible for waiting until auth is ready
    if (authLoading) {
      logger.info('Auth still loading - caller should retry when ready');
      throw new Error('AUTH_LOADING');
    }

    if (!user) {
      logger.info('User not authenticated - caller should retry when ready');
      throw new Error('USER_NOT_AUTHENTICATED');
    }

    // 1. Check cache first (instant return)
    if (bootstrapCache && (Date.now() - bootstrapCache.timestamp) < BOOTSTRAP_CACHE_TTL) {
      logger.info('Bootstrap CACHE HIT');
      return {
        companies: bootstrapCache.companies,
        projects: bootstrapCache.projects
      };
    }

    // 2. 🏢 ENTERPRISE: Return in-flight promise if request already running
    // This ensures ALL concurrent callers wait for the SAME request
    if (inFlightBootstrapPromise) {
      logger.info('Bootstrap in-flight - attaching to existing request...');
      return inFlightBootstrapPromise;
    }

    // 3. Start new request and store promise for de-duplication
    setIsLoadingCompanies(true);
    setIsLoadingProjects(true);

    // Create the actual fetch promise
    const fetchPromise = (async (): Promise<{ companies: NavigationCompany[]; projects: NavigationProject[] }> => {
      try {
        logger.info('Starting bootstrap request...');

        // 🏢 ENTERPRISE: Use centralized API client (automatic Authorization header + error handling)
        // apiClient automatically handles errors (401/403/500) and unwraps response
        // Bust server cache when explicitly refreshing (e.g. after adding a company)
        const url = bustServerCacheRef.current
          ? `/api/audit/bootstrap?t=${Date.now()}`
          : '/api/audit/bootstrap';
        bustServerCacheRef.current = false;
        const bootstrapData = await apiClient.get<BootstrapResponse>(url);
        logger.info('Bootstrap loaded', { companiesCount: bootstrapData.companies.length, projectsCount: bootstrapData.projects.length });

        // Transform to NavigationCompany format
        const companies: NavigationCompany[] = bootstrapData.companies.map(c => ({
          id: c.id,
          companyName: c.name
        }));

        // Transform to NavigationProject format
        const projects: NavigationProject[] = bootstrapData.projects.map(p => ({
          id: p.id,
          name: p.name,
          company: '', // Will be looked up if needed
          companyId: p.companyId,
          projectCode: p.projectCode,
          status: p.status,
          buildings: [], // Loaded on-demand (Phase 3)
          // 🏢 PERF-001: Use bootstrap count instead of realtime listener
          buildingCount: p.buildingCount
        }));

        // Update cache
        bootstrapCache = {
          companies,
          projects,
          timestamp: Date.now()
        };

        // Update refs for compatibility with existing code
        companiesDataRef.current = companies;
        projectsDataRef.current = projects;
        companiesLoadedRef.current = true;

        return { companies, projects };

      } catch (error) {
        logger.error('Bootstrap failed', { error });
        // Fallback to legacy loading if bootstrap fails
        logger.warn('Falling back to legacy loading...');
        return loadLegacy();
      }
    })();

    // Store the promise for de-duplication
    inFlightBootstrapPromise = fetchPromise;

    try {
      // Wait for result
      const result = await fetchPromise;
      return result;
    } finally {
      // 🏢 ENTERPRISE: Clear in-flight promise AFTER completion
      // This allows new requests after this one finishes
      inFlightBootstrapPromise = null;
      setIsLoadingCompanies(false);
      setIsLoadingProjects(false);
    }
  };

  /**
   * 🔄 Legacy loading (fallback if bootstrap fails)
   */
  const loadLegacy = async (): Promise<{ companies: NavigationCompany[]; projects: NavigationProject[] }> => {
    const companies = await NavigationApiService.loadCompanies();
    const projects = await NavigationApiService.loadAllProjects(companies);
    return { companies, projects };
  };

  /**
   * Load companies - now uses bootstrap internally
   */
  const loadCompanies = async (): Promise<NavigationCompany[]> => {
    // If already loaded via bootstrap, return cached
    if (companiesLoadedRef.current && companiesDataRef.current.length > 0) {
      return companiesDataRef.current;
    }

    // Use bootstrap for initial load
    const { companies } = await loadViaBootstrap();
    return companies;
  };

  /**
   * Load all projects - now returns cached data from bootstrap
   */
  const loadAllProjects = async (companies: NavigationCompany[]): Promise<NavigationProject[]> => {
    // If we already have projects from bootstrap, return them
    if (projectsDataRef.current.length > 0) {
      logger.info('Using cached projects from bootstrap');
      return projectsDataRef.current;
    }

    // If no cached data, use bootstrap
    const { projects } = await loadViaBootstrap();
    return projects;
  };

  /**
   * Load projects for specific company (on-demand)
   */
  const loadProjectsForCompany = async (companyId: string): Promise<void> => {
    // For individual company loads, use the API service
    // This is for cases when we need to refresh a specific company's projects
    try {
      await NavigationApiService.loadProjectsForCompany(companyId);
    } catch (error) {
      logger.error('Error loading projects for company', { companyId, error });
      throw error;
    }
  };

  // Reset refs for fresh start
  const resetRefs = () => {
    companiesLoadingRef.current = false;
    companiesLoadedRef.current = false;
    companiesDataRef.current = [];
    projectsDataRef.current = [];
    bootstrapCache = null;
    inFlightBootstrapPromise = null; // 🏢 Clear in-flight promise too
  };

  /**
   * Clear ALL client-side caches (bootstrap + refs)
   * Must be called before re-fetching to get fresh data
   */
  const clearAllClientCaches = () => {
    resetRefs();
    bustServerCacheRef.current = true;
    logger.info('All navigation caches cleared (server bust on next request)');
  };

  return {
    loadCompanies,
    loadAllProjects,
    loadProjectsForCompany,
    loadViaBootstrap,
    isLoadingCompanies,
    isLoadingProjects,
    resetRefs,
    clearAllClientCaches
  } as UseNavigationDataReturn & { resetRefs: () => void; clearAllClientCaches: () => void };
}