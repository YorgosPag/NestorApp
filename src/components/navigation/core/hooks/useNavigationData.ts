/**
 * Navigation Data Hook
 * Handles loading and management of navigation data
 */

import { useState, useRef } from 'react';
import { NavigationApiService } from '../services/navigationApi';
import type { NavigationCompany, NavigationProject } from '../types';

interface UseNavigationDataReturn {
  loadCompanies: () => Promise<NavigationCompany[]>;
  loadAllProjects: (companies: NavigationCompany[]) => Promise<NavigationProject[]>;
  loadProjectsForCompany: (companyId: string) => Promise<void>;
  isLoadingCompanies: boolean;
  isLoadingProjects: boolean;
}

export function useNavigationData(): UseNavigationDataReturn {
  const [isLoadingCompanies, setIsLoadingCompanies] = useState(false);
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);

  // Refs to track loading state and prevent duplicate calls
  const companiesLoadingRef = useRef(false);
  const companiesLoadedRef = useRef(false);

  const loadCompanies = async (): Promise<NavigationCompany[]> => {
    if (companiesLoadingRef.current || companiesLoadedRef.current) {
      return [];
    }

    companiesLoadingRef.current = true;
    setIsLoadingCompanies(true);

    try {
      const companies = await NavigationApiService.loadCompanies();

      companiesLoadedRef.current = true;

      return companies;

    } catch (error) {
      console.error('NavigationData: Error loading companies:', error);
      throw error;

    } finally {
      companiesLoadingRef.current = false;
      setIsLoadingCompanies(false);
    }
  };

  const loadAllProjects = async (companies: NavigationCompany[]): Promise<NavigationProject[]> => {
    if (companies.length === 0) return [];

    setIsLoadingProjects(true);

    try {
      const projects = await NavigationApiService.loadAllProjects(companies);
      return projects;

    } catch (error) {
      console.error('NavigationData: Error loading all projects:', error);
      throw error;

    } finally {
      setIsLoadingProjects(false);
    }
  };

  const loadProjectsForCompany = async (companyId: string): Promise<void> => {

    try {
      const projects = await NavigationApiService.loadProjectsForCompany(companyId);

    } catch (error) {
      console.error(`NavigationData: Error loading projects for company ${companyId}:`, error);
      throw error;
    }
  };

  // Reset refs for fresh start
  const resetRefs = () => {
    companiesLoadingRef.current = false;
    companiesLoadedRef.current = false;
  };

  return {
    loadCompanies,
    loadAllProjects,
    loadProjectsForCompany,
    isLoadingCompanies,
    isLoadingProjects,
    // Expose reset for testing or special cases
    resetRefs
  } as UseNavigationDataReturn & { resetRefs: () => void };
}