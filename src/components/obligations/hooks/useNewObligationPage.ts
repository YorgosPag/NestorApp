"use client";

/**
 * =============================================================================
 * NEW OBLIGATION PAGE - Custom Hook
 * =============================================================================
 *
 * All state, effects, memos, and handlers for the New Obligation page.
 *
 * @module app/obligations/new/useNewObligationPage
 */

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { ENTITY_ROUTES } from '@/lib/routes';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import {
  Owner,
  ProjectDetails,
  ObligationDocument,
  ObligationSection,
  generateTableOfContents
} from "@/types/obligations";
import { DEFAULT_TEMPLATE_SECTIONS } from '@/types/mock-obligations';
import { obligationsService } from "@/services/obligations.service";
import { OBLIGATION_PREVIEW_LAYOUT } from "@/components/obligations/config/preview-layout";
import { createModuleLogger } from '@/lib/telemetry';
import { apiClient } from '@/lib/api/enterprise-api-client';
import { API_ROUTES } from '@/config/domain-constants';
import { CompaniesService } from "@/services/companies.service";
import { getNavigationCompanyIds } from "@/services/navigation-companies.service";
import type { CompanyContact } from "@/types/contacts";
import type { Project } from "@/types/project";

const logger = createModuleLogger('NewObligationPage');

// =============================================================================
// TYPES
// =============================================================================

export interface ObligationFormData {
  title: string;
  projectName: string;
  contractorCompany: string;
  owners: Owner[];
  projectDetails: ProjectDetails;
  sections: ObligationSection[];
  companyId?: string;
  projectId?: string | number;
  buildingId?: string;
}

// =============================================================================
// HELPERS
// =============================================================================

/** Auto-resize textarea to fit content */
export const autoResize = (textarea: HTMLTextAreaElement) => {
  textarea.style.height = 'auto';
  const computedStyle = window.getComputedStyle(textarea);
  const minHeight = parseInt(computedStyle.minHeight) || 40;
  const maxHeight = parseInt(computedStyle.maxHeight) || 300;
  const scrollHeight = textarea.scrollHeight;
  const newHeight = Math.max(minHeight, Math.min(maxHeight, scrollHeight));
  textarea.style.height = newHeight + 'px';
};

// =============================================================================
// HOOK
// =============================================================================

export function useNewObligationPage() {
  const router = useRouter();
  const { t } = useTranslation('obligations');

  const [formData, setFormData] = useState<ObligationFormData>({
    title: "",
    projectName: "",
    contractorCompany: "",
    owners: [{ id: "1", name: "", share: 100 }],
    projectDetails: {
      location: "",
      address: "",
      plotNumber: "",
      buildingPermitNumber: "",
      contractDate: undefined,
      deliveryDate: undefined,
      notaryName: ""
    },
    sections: DEFAULT_TEMPLATE_SECTIONS,
    companyId: undefined,
    projectId: undefined,
    buildingId: undefined
  });

  const [useTemplate, setUseTemplate] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'split' | 'edit-only'>('split');
  const [activeItem, setActiveItem] = useState<{type: 'section' | 'article' | 'paragraph', id: string} | null>(null);
  const [dynamicHeight, setDynamicHeight] = useState<string>(OBLIGATION_PREVIEW_LAYOUT.initialPreviewHeight);
  const previewContentRef = useRef<HTMLDivElement>(null);
  const calculateHeightRef = useRef<() => void>();
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const textareaTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Companies & projects state
  const [companies, setCompanies] = useState<CompanyContact[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loadingCompanies, setLoadingCompanies] = useState(false);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [navigationCompanyMap, setNavigationCompanyMap] = useState<Map<string, string>>(new Map());

  // ── Height calculation ──────────────────────────
  const calculateHeight = useCallback(() => {
    const viewportHeight = window.innerHeight;
    const headerOffset = 160;
    const minHeight = OBLIGATION_PREVIEW_LAYOUT.minHeightPx;
    const neededHeight = Math.max(minHeight, viewportHeight - headerOffset);
    setDynamicHeight(`${neededHeight}px`);
  }, []);

  calculateHeightRef.current = calculateHeight;

  useEffect(() => {
    timerRef.current = setTimeout(() => calculateHeightRef.current?.(), 100);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  useEffect(() => {
    const handleResize = () => calculateHeightRef.current?.();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // ── Load companies and build navigation mapping ──
  useEffect(() => {
    const loadCompaniesAndMapping = async () => {
      setLoadingCompanies(true);
      try {
        const companiesService = new CompaniesService();
        const companyContacts = await companiesService.getAllCompaniesForSelect();
        setCompanies(companyContacts);

        const navigationIds = await getNavigationCompanyIds();
        const mapping = new Map<string, string>();

        companyContacts.forEach(company => {
          mapping.set(company.id!, company.id!);
        });

        setNavigationCompanyMap(mapping);

        logger.info('Companies mapping built', {
          totalCompanies: companyContacts.length,
          mappingEntries: mapping.size,
          navigationIds: navigationIds.length
        });
      } catch (error) {
        logger.error('Error loading companies', { error });
      } finally {
        setLoadingCompanies(false);
      }
    };

    loadCompaniesAndMapping();
  }, []);

  // ── Load projects when company changes ──
  useEffect(() => {
    const loadProjectsForCompany = async () => {
      if (!formData.companyId) {
        setProjects([]);
        return;
      }

      setLoadingProjects(true);
      try {
        const contactIdForProjects = navigationCompanyMap.get(formData.companyId) || formData.companyId;

        interface ProjectListApiItem {
          id: string;
          name?: string;
          title?: string;
          companyId?: string;
          linkedCompanyId?: string | null;
          company?: string;
          status?: string;
          address?: string;
          city?: string;
          startDate?: string;
          completionDate?: string;
          totalValue?: number;
        }

        interface ProjectListApiResponse {
          projects?: ProjectListApiItem[];
        }

        const listResponse = await apiClient.get<ProjectListApiResponse>(API_ROUTES.PROJECTS.LIST);
        const companyName = companies.find((company) => company.id === formData.companyId)?.companyName || '';
        const candidateCompanyIds = new Set([String(contactIdForProjects), String(formData.companyId)]);

        const fallbackListProjects = (listResponse?.projects || []).filter((project) => {
          const byLinkedCompanyId = project.linkedCompanyId ? candidateCompanyIds.has(String(project.linkedCompanyId)) : false;
          const byCompanyId = project.companyId ? candidateCompanyIds.has(String(project.companyId)) : false;
          const byCompanyName = companyName && project.company ? project.company === companyName : false;
          return byLinkedCompanyId || byCompanyId || byCompanyName;
        });

        const uniqueProjects = fallbackListProjects.map((project) => ({
          id: String(project.id),
          name: project.title || project.name || '',
          title: project.title || project.name || '',
          status: (project.status as Project['status']) || 'planning',
          company: project.company || companyName,
          companyId: project.companyId || String(formData.companyId || ''),
          address: project.address || '',
          city: project.city || '',
          progress: 0,
          totalValue: project.totalValue || 0,
          startDate: project.startDate,
          completionDate: project.completionDate,
          lastUpdate: new Date().toISOString(),
          totalArea: 0,
        } as Project));

        setProjects(uniqueProjects);
        logger.info(`Loaded ${uniqueProjects.length} projects for company ${contactIdForProjects}`);
      } catch (error) {
        logger.error('Error loading projects for company', { error });
        setProjects([]);
      } finally {
        setLoadingProjects(false);
      }
    };

    if (navigationCompanyMap.size > 0) {
      loadProjectsForCompany();
    }
  }, [formData.companyId, navigationCompanyMap, companies]);

  // ── Auto-resize textareas ──
  useEffect(() => {
    const autoResizeAllTextareas = () => {
      const textareas = document.querySelectorAll('textarea');
      textareas.forEach(textarea => {
        if (textarea instanceof HTMLTextAreaElement) {
          autoResize(textarea);
        }
      });
    };

    textareaTimerRef.current = setTimeout(autoResizeAllTextareas, 100);
    return () => { if (textareaTimerRef.current) clearTimeout(textareaTimerRef.current); };
  }, [formData.sections]);

  // ── Template initialization ──
  useEffect(() => {
    if (useTemplate && formData.sections.length === 0) {
      setFormData(prev => ({
        ...prev,
        sections: DEFAULT_TEMPLATE_SECTIONS.map(section => ({ ...section, isExpanded: false }))
      }));
    } else if (!useTemplate) {
      setFormData(prev => ({ ...prev, sections: [] }));
    }
  }, [useTemplate]);

  // ── Memos ──
  const tableOfContents = useMemo(() => {
    const mockDocument: ObligationDocument = {
      id: 'preview',
      ...formData,
      createdAt: new Date(),
      updatedAt: new Date(),
      status: 'draft'
    };
    return generateTableOfContents(mockDocument);
  }, [formData]);

  const companyOptions = useMemo(() =>
    companies
      .filter(company => company.id)
      .map(company => ({
        id: company.id as string,
        name: company.companyName || t('preview.unknownContractor')
      })),
    [companies, t]
  );

  const projectOptions = useMemo(() =>
    projects.map(project => ({
      id: String(project.id),
      name: project.name || t('preview.unknownProject')
    })),
    [projects, t]
  );

  // ── Handlers ──
  const handleInputChange = useCallback((field: keyof ObligationFormData, value: ObligationFormData[keyof ObligationFormData]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleCompanySelection = useCallback((companyId: string) => {
    const selectedCompany = companies.find(c => c.id === companyId);
    setFormData(prev => ({
      ...prev,
      companyId,
      contractorCompany: selectedCompany?.companyName || prev.contractorCompany,
      projectId: undefined,
      projectName: ""
    }));
  }, [companies]);

  const handleProjectSelection = useCallback((projectId: string | number) => {
    const selectedProject = projects.find(p => p.id === projectId);
    setFormData(prev => ({
      ...prev,
      projectId,
      projectName: selectedProject?.name || prev.projectName,
      projectDetails: {
        ...prev.projectDetails,
        location: selectedProject?.city || prev.projectDetails.location,
        address: selectedProject?.address || prev.projectDetails.address
      }
    }));
  }, [projects]);

  const handleSubmit = async () => {
    setIsLoading(true);

    if (!formData.title.trim()) {
      alert(t('validation.titleRequired'));
      setIsLoading(false);
      return;
    }

    if (!formData.projectName.trim()) {
      alert(t('validation.projectNameRequired'));
      setIsLoading(false);
      return;
    }

    if (!formData.companyId) {
      logger.warn('No company selected - obligation will use legacy contractorCompany field');
    }

    try {
      const selectedCompany = formData.companyId ? companies.find(c => c.id === formData.companyId) : null;
      const selectedProject = formData.projectId ? projects.find(p => p.id === formData.projectId) : null;

      const obligationData = {
        ...formData,
        status: "draft" as const,
        ...(selectedCompany && {
          companyDetails: {
            name: selectedCompany.companyName || formData.contractorCompany,
            email: selectedCompany.emails?.[0]?.email || '',
            phone: selectedCompany.phones?.[0]?.number || '',
            address: selectedCompany.addresses?.[0]?.street || '',
            registrationNumber: selectedCompany.vatNumber || ''
          }
        }),
        ...(selectedProject && {
          projectInfo: {
            description: selectedProject.title || '',
            location: selectedProject.city || '',
            startDate: selectedProject.startDate ? new Date(selectedProject.startDate) : undefined,
            endDate: selectedProject.completionDate ? new Date(selectedProject.completionDate) : undefined,
            projectType: selectedProject.status || '',
            budget: selectedProject.totalValue
          }
        })
      };

      logger.info('Creating obligation with enterprise data', {
        hasCompany: !!formData.companyId,
        hasProject: !!formData.projectId,
        companyName: selectedCompany?.companyName,
        projectName: selectedProject?.name
      });

      const newObligation = await obligationsService.create(obligationData);
      router.push(ENTITY_ROUTES.obligations.edit(newObligation.id));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Error creating obligation', { error, errorMessage });
      alert(t('validation.createError') + ': ' + errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleViewMode = useCallback(() => {
    setViewMode(prev => prev === 'split' ? 'edit-only' : 'split');
  }, []);

  return {
    t,
    formData,
    useTemplate, setUseTemplate,
    isLoading,
    viewMode, toggleViewMode,
    activeItem, setActiveItem,
    dynamicHeight,
    previewContentRef,
    companies: companyOptions,
    projects: projectOptions,
    loadingCompanies,
    loadingProjects,
    tableOfContents,
    handleInputChange,
    handleCompanySelection,
    handleProjectSelection,
    handleSubmit,
  };
}
