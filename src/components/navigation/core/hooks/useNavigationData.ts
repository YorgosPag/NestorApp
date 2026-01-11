/**
 * Navigation Data Hook
 * Handles loading and management of navigation data
 *
 * 🚀 ENTERPRISE PHASE 1: Uses bootstrap endpoint for aggregated loading
 * Eliminates N+1 per-company calls → 1 single bootstrap request
 */

import { useState, useRef } from 'react';
import { NavigationApiService } from '../services/navigationApi';
import type { NavigationCompany, NavigationProject } from '../types';

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
  const [isLoadingCompanies, setIsLoadingCompanies] = useState(false);
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);

  // Refs to track loading state and prevent duplicate calls
  const companiesLoadingRef = useRef(false);
  const companiesLoadedRef = useRef(false);
  const companiesDataRef = useRef<NavigationCompany[]>([]);
  const projectsDataRef = useRef<NavigationProject[]>([]);
  // Note: bootstrapLoadingRef removed - replaced with module-level inFlightBootstrapPromise for proper de-duplication

  /**
   * 🚀 ENTERPRISE: Load via bootstrap endpoint (1 request for all data)
   *
   * 🏢 REQUEST DE-DUPLICATION PATTERN:
   * - If cache is valid → return cache immediately
   * - If request is in-flight → return SAME promise (no duplicate API call)
   * - If no cache and no in-flight → start new request and store promise
   *
   * This is the enterprise pattern used by React Query, SWR, and Apollo Client.
   */
  const loadViaBootstrap = async (): Promise<{ companies: NavigationCompany[]; projects: NavigationProject[] }> => {
    // 1. Check cache first (instant return)
    if (bootstrapCache && (Date.now() - bootstrapCache.timestamp) < BOOTSTRAP_CACHE_TTL) {
      console.log('⚡ [Navigation] Bootstrap CACHE HIT');
      return {
        companies: bootstrapCache.companies,
        projects: bootstrapCache.projects
      };
    }

    // 2. 🏢 ENTERPRISE: Return in-flight promise if request already running
    // This ensures ALL concurrent callers wait for the SAME request
    if (inFlightBootstrapPromise) {
      console.log('⏳ [Navigation] Bootstrap in-flight - attaching to existing request...');
      return inFlightBootstrapPromise;
    }

    // 3. Start new request and store promise for de-duplication
    setIsLoadingCompanies(true);
    setIsLoadingProjects(true);

    // Create the actual fetch promise
    const fetchPromise = (async (): Promise<{ companies: NavigationCompany[]; projects: NavigationProject[] }> => {
      try {
        console.log('🚀 [Navigation] Starting bootstrap request...');
        const response = await fetch('/api/audit/bootstrap');

        if (!response.ok) {
          throw new Error(`Bootstrap failed: ${response.status}`);
        }

        const result = await response.json();

        if (!result.success || !result.data) {
          throw new Error('Bootstrap returned invalid data');
        }

        const bootstrapData = result.data as BootstrapResponse;
        console.log(`✅ [Navigation] Bootstrap loaded: ${bootstrapData.companies.length} companies, ${bootstrapData.projects.length} projects`);

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
        console.error('❌ [Navigation] Bootstrap failed:', error);
        // Fallback to legacy loading if bootstrap fails
        console.log('⚠️ [Navigation] Falling back to legacy loading...');
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
      console.log('⚡ [Navigation] Using cached projects from bootstrap');
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
      console.error(`NavigationData: Error loading projects for company ${companyId}:`, error);
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

  return {
    loadCompanies,
    loadAllProjects,
    loadProjectsForCompany,
    loadViaBootstrap,
    isLoadingCompanies,
    isLoadingProjects,
    // Expose reset for testing or special cases
    resetRefs
  } as UseNavigationDataReturn & { resetRefs: () => void };
}