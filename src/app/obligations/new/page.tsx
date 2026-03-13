
"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { ENTITY_ROUTES } from '@/lib/routes';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ArrowLeft,
  Save,
  Eye,
  Layout
} from "lucide-react";
import { PageLayout } from "@/components/app/page-layout";
import { useIconSizes } from '@/hooks/useIconSizes';
import { getSpacingClass } from '@/lib/design-system';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { 
  Owner, 
  ProjectDetails, 
  ObligationDocument, 
  ObligationSection, 
  generateTableOfContents
} from "@/types/obligations";
import { DEFAULT_TEMPLATE_SECTIONS } from '@/types/mock-obligations';
import { TEMPLATE_ARTICLE_COUNT } from '@/types/obligations/default-template';
import { obligationsService } from "@/services/obligations.service";
import StructureEditor from "@/components/obligations/structure-editor";
import LivePreview from "@/components/obligations/live-preview";
import { getDynamicHeightClass } from "@/components/ui/utils/dynamic-styles";
import { OBLIGATION_PREVIEW_LAYOUT } from "@/components/obligations/config/preview-layout";
import Link from "next/link";
import { createModuleLogger } from '@/lib/telemetry';
import { apiClient } from '@/lib/api/enterprise-api-client';
const logger = createModuleLogger('NewObligationPage');

// 🏢 ENTERPRISE: Import existing κεντρικοποιημένων components & services
import { CompaniesService } from "@/services/companies.service";
import { getNavigationCompanyIds } from "@/services/navigation-companies.service";
import { useCompanyRelationships } from "@/services/relationships/hooks/useEnterpriseRelationships";
import type { CompanyContact } from "@/types/contacts";
import type { Project } from "@/types/project";

interface ObligationFormData {
  title: string;
  projectName: string;
  contractorCompany: string; // 🔄 BACKWARD COMPATIBILITY: Κρατάμε για legacy data
  owners: Owner[];
  projectDetails: ProjectDetails;
  sections: ObligationSection[];

  // 🏢 ENTERPRISE: Νέα πεδία για database integration
  companyId?: string;        // Σύνδεση με companies collection
  projectId?: string | number; // Σύνδεση με projects collection
  buildingId?: string;       // Σύνδεση με buildings collection (optional)
}


// Helper function to auto-resize textarea
const autoResize = (textarea: HTMLTextAreaElement) => {
  textarea.style.height = 'auto';

  // Get min and max heights from inline styles if they exist
  const computedStyle = window.getComputedStyle(textarea);
  const minHeight = parseInt(computedStyle.minHeight) || 40;
  const maxHeight = parseInt(computedStyle.maxHeight) || 300;

  // Calculate the needed height
  const scrollHeight = textarea.scrollHeight;
  const newHeight = Math.max(minHeight, Math.min(maxHeight, scrollHeight));

  textarea.style.height = newHeight + 'px';
};

export default function NewObligationPage() {
  const iconSizes = useIconSizes();
  const router = useRouter();
  // 🏢 ENTERPRISE: i18n support
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

    // 🏢 ENTERPRISE: Initialize νέων πεδίων
    companyId: undefined,      // Θα συμπληρωθεί από company selection
    projectId: undefined,      // Θα συμπληρωθεί από project selection
    buildingId: undefined      // Optional - για specific building obligations
  });

  const [useTemplate, setUseTemplate] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'split' | 'edit-only'>('split');
  const [activeItem, setActiveItem] = useState<{type: 'section' | 'article' | 'paragraph', id: string} | null>(null);
  const [dynamicHeight, setDynamicHeight] = useState<string>(OBLIGATION_PREVIEW_LAYOUT.initialPreviewHeight);
  const previewContentRef = useRef<HTMLDivElement>(null);
  const previewHeightClass = getDynamicHeightClass(dynamicHeight);
  const calculateHeightRef = useRef<() => void>();
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const textareaTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Height calculation — fits viewport, content scrolls internally
  const calculateHeight = useCallback(() => {
    const viewportHeight = window.innerHeight;
    const headerOffset = 160; // app header + page header + padding
    const minHeight = OBLIGATION_PREVIEW_LAYOUT.minHeightPx;
    const neededHeight = Math.max(minHeight, viewportHeight - headerOffset);
    setDynamicHeight(`${neededHeight}px`);
  }, []);

  // Store current function in ref
  calculateHeightRef.current = calculateHeight;

  // Setup effects
  useEffect(() => {
    // Initial calculation with delay - Strict Mode safe
    timerRef.current = setTimeout(() => {
      calculateHeightRef.current?.();
    }, 100);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    // Window resize handler using ref to avoid dependency issues
    const handleResize = () => calculateHeightRef.current?.();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 🏢 ENTERPRISE: State για companies & projects
  const [companies, setCompanies] = useState<CompanyContact[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loadingCompanies, setLoadingCompanies] = useState(false);
  const [loadingProjects, setLoadingProjects] = useState(false);

  // 🏢 ENTERPRISE: Navigation company mapping (για το projects API)
  const [navigationCompanyMap, setNavigationCompanyMap] = useState<Map<string, string>>(new Map());

  // 🚀 ENTERPRISE RELATIONSHIP ENGINE: Hook για projects από συγκεκριμένη εταιρεία
  const companyRelationships = useCompanyRelationships(formData.companyId || '');

  // 🏢 ENTERPRISE: Load companies and build navigation mapping
  useEffect(() => {
    const loadCompaniesAndMapping = async () => {
      setLoadingCompanies(true);
      try {
        const companiesService = new CompaniesService();
        const companyContacts = await companiesService.getAllCompaniesForSelect();
        setCompanies(companyContacts);

        // 🔗 ENTERPRISE: Build mapping από contacts.id → navigation_companies.contactId
        // Αυτό είναι απαραίτητο γιατί το projects API περιμένει το contactId από navigation_companies
        const navigationIds = await getNavigationCompanyIds();
        const mapping = new Map<string, string>();

        // Map κάθε company ID (από contacts) στο αντίστοιχο contactId (για projects API)
        // Η λογική είναι: στο navigation_companies η εταιρεία αποθηκεύεται με contactId=LEGACY_TENANT_COMPANY_ID (ADR-210)
        // αλλά στο contacts dropdown εμφανίζεται με ID από contacts collection
        // Το projects API περιμένει το contactId από navigation_companies
        companyContacts.forEach(company => {
          // Για κάθε εταιρεία στο contacts, βρίσκουμε το navigation contactId
          const isInNavigation = navigationIds.includes(company.id!);
          if (isInNavigation) {
            // Αν η εταιρεία είναι στο navigation, το company.id ΗΔΗ είναι το σωστό contactId
            mapping.set(company.id!, company.id!);
          } else {
            // Αν δεν είναι στο navigation, πιθανόν δε θα έχει projects
            mapping.set(company.id!, company.id!);
          }
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

  // 🏢 ENTERPRISE: Load projects when company changes
  useEffect(() => {
    const loadProjectsForCompany = async () => {
      if (!formData.companyId) {
        setProjects([]);
        return;
      }

      setLoadingProjects(true);
      try {
        // 🔗 ENTERPRISE: Χρησιμοποιούμε το mapping για να βρούμε το σωστό contactId
        const contactIdForProjects = navigationCompanyMap.get(formData.companyId) || formData.companyId;

        logger.info('Loading projects', {
          selectedCompanyId: formData.companyId,
          mappedContactId: contactIdForProjects,
          usingMapping: contactIdForProjects !== formData.companyId
        });

        // 🚀 ENTERPRISE RELATIONSHIP ENGINE: Φόρτωση projects με explicit company ID
        logger.info(`Loading projects for company ${contactIdForProjects} via Relationship Engine`);

        const primaryProjects = await companyRelationships.getChildren('company', contactIdForProjects, 'project');
        const fallbackProjects =
          (!primaryProjects || primaryProjects.length === 0) && contactIdForProjects !== formData.companyId
            ? await companyRelationships.getChildren('company', String(formData.companyId), 'project')
            : [];

        const mergedProjects = [...(primaryProjects || []), ...(fallbackProjects || [])] as Project[];
        let uniqueProjects = Array.from(
          new Map(mergedProjects.map((project) => [String(project.id), project])).values()
        );

        if (uniqueProjects.length === 0) {
          interface ProjectListApiItem {
            id: string;
            name?: string;
            title?: string;
            companyId?: string;
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

          const listResponse = await apiClient.get<ProjectListApiResponse>('/api/projects/list');
          const companyName = companies.find((company) => company.id === formData.companyId)?.companyName || '';
          const candidateCompanyIds = new Set([String(contactIdForProjects), String(formData.companyId)]);

          const fallbackListProjects = (listResponse?.projects || []).filter((project) => {
            const byCompanyId = project.companyId ? candidateCompanyIds.has(String(project.companyId)) : false;
            const byCompanyName = companyName && project.company ? project.company === companyName : false;
            return byCompanyId || byCompanyName;
          });

          uniqueProjects = fallbackListProjects.map((project) => ({
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
        }

        setProjects(uniqueProjects);

        logger.info(`Loaded ${uniqueProjects.length} projects for company ${contactIdForProjects} via Relationship Engine`);
      } catch (error) {
        logger.error('Error loading projects for company', { error });
        setProjects([]);
      } finally {
        setLoadingProjects(false);
      }
    };

    // Μόνο αν έχουμε το mapping έτοιμο
    if (navigationCompanyMap.size > 0) {
      loadProjectsForCompany();
    }
  }, [formData.companyId, navigationCompanyMap, companies]);

  // Auto-resize all textareas when content changes
  useEffect(() => {
    const autoResizeAllTextareas = () => {
      // Find all textareas in the document
      const textareas = document.querySelectorAll('textarea');
      textareas.forEach(textarea => {
        if (textarea instanceof HTMLTextAreaElement) {
          autoResize(textarea);
        }
      });
    };

    // Run after a small delay to ensure DOM is updated - Strict Mode safe
    textareaTimerRef.current = setTimeout(autoResizeAllTextareas, 100);

    return () => {
      if (textareaTimerRef.current) {
        clearTimeout(textareaTimerRef.current);
      }
    };
  }, [formData.sections]); // Re-run when sections change

  // CSS overscroll-behavior χειρίζεται το synchronized scrolling φυσικά

  // Initialize with template if selected
  useEffect(() => {
    if (useTemplate && formData.sections.length === 0) {
      setFormData(prev => ({
        ...prev,
        sections: DEFAULT_TEMPLATE_SECTIONS.map(section => ({
          ...section,
          isExpanded: false
        }))
      }));
    } else if (!useTemplate) {
      setFormData(prev => ({
        ...prev,
        sections: []
      }));
    }
  }, [useTemplate]);

  // Generate table of contents when sections change
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

  // 🏢 ENTERPRISE: Transform companies for centralized Select
  const companyOptions = useMemo(() =>
    companies
      .filter(company => company.id) // Φιλτράρουμε companies χωρίς id
      .map(company => ({
        id: company.id as string, // Type assertion αφού φιλτράραμε
        name: company.companyName || t('preview.unknownContractor')
      })),
    [companies, t]
  );

  // 🏢 ENTERPRISE: Transform projects for centralized Select
  const projectOptions = useMemo(() =>
    projects.map(project => ({
      id: String(project.id),
      name: project.name || t('preview.unknownProject')
    })),
    [projects, t]
  );

  const handleInputChange = useCallback((field: keyof ObligationFormData, value: ObligationFormData[keyof ObligationFormData]) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  }, []);

  // 🏢 ENTERPRISE: Company selection handler
  const handleCompanySelection = useCallback((companyId: string) => {
    const selectedCompany = companies.find(c => c.id === companyId);

    setFormData(prev => ({
      ...prev,
      companyId,
      // 🔄 BACKWARD COMPATIBILITY: Update legacy field too
      contractorCompany: selectedCompany?.companyName || prev.contractorCompany,
      // Reset project when company changes
      projectId: undefined,
      projectName: ""
    }));
  }, [companies]);

  // 🏢 ENTERPRISE: Project selection handler
  const handleProjectSelection = useCallback((projectId: string | number) => {
    const selectedProject = projects.find(p => p.id === projectId);

    setFormData(prev => ({
      ...prev,
      projectId,
      // 🔄 BACKWARD COMPATIBILITY: Update legacy field too
      projectName: selectedProject?.name || prev.projectName,
      // 🔗 AUTO-FILL: Update project details if available
      projectDetails: {
        ...prev.projectDetails,
        location: selectedProject?.city || prev.projectDetails.location,
        address: selectedProject?.address || prev.projectDetails.address
      }
    }));
  }, [projects]);

  const handleSubmit = async () => {
    setIsLoading(true);

    // 🏢 ENTERPRISE VALIDATION
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

    // 🔗 ENTERPRISE: Validate company selection (optional but recommended)
    if (!formData.companyId) {
      logger.warn('No company selected - obligation will use legacy contractorCompany field');
    }

    try {
      // 🏢 ENTERPRISE: Build rich obligation data
      const selectedCompany = formData.companyId ? companies.find(c => c.id === formData.companyId) : null;
      const selectedProject = formData.projectId ? projects.find(p => p.id === formData.projectId) : null;

      // 🔗 ENTERPRISE: Create obligation με full integration
      const obligationData = {
        ...formData,
        status: "draft" as const,

        // 🏢 ENTERPRISE: Rich company details (if company selected)
        ...(selectedCompany && {
          companyDetails: {
            name: selectedCompany.companyName || formData.contractorCompany,
            email: selectedCompany.emails?.[0]?.email || '',
            phone: selectedCompany.phones?.[0]?.number || '',
            address: selectedCompany.addresses?.[0]?.street || '',
            registrationNumber: selectedCompany.vatNumber || ''
          }
        }),

        // 🔗 ENTERPRISE: Rich project details (if project selected)
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




  return (
    <PageLayout>
      <div className={`max-w-full mx-auto ${getSpacingClass('p', 'md')} md:p-6 lg:p-8`}>
        {/* Header */}
        <header className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Link href="/obligations">
              <Button variant="ghost" size="sm">
                <ArrowLeft className={iconSizes.sm} />
              </Button>
            </Link>
            <hgroup>
              <h1 className="text-2xl font-bold">{t('newPage.title')}</h1>
              <p className="text-muted-foreground text-sm">{t('newPage.subtitle')}</p>
            </hgroup>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={() => setViewMode(viewMode === 'split' ? 'edit-only' : 'split')}
              size="sm"
            >
              <Layout className={`${iconSizes.sm} mr-2`} />
              {viewMode === 'split' ? t('newPage.editOnly') : t('newPage.splitView')}
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isLoading}
              className="flex items-center gap-2"
            >
              <Save className={iconSizes.sm} />
              {isLoading ? t('newPage.creating') : t('newPage.create')}
            </Button>
          </div>
        </header>

        {/* Basic Info & Template — full-width above split grid */}
        <section className="space-y-6 w-full" aria-label={t('aria.editForm')}>
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('basicInfo.title')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <fieldset className="space-y-2">
                  <Label className="text-sm">{t('basicInfo.company')} {t('basicInfo.required')}</Label>
                  <Select
                    value={formData.companyId || ""}
                    onValueChange={handleCompanySelection}
                    disabled={loadingCompanies}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue
                        placeholder={loadingCompanies ? t('basicInfo.loadingCompanies') : t('basicInfo.selectCompany')}
                      />
                    </SelectTrigger>
                    <SelectContent className="max-h-80">
                      {companyOptions.map((company) => (
                        <SelectItem key={company.id} value={company.id}>
                          {company.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </fieldset>

                <fieldset className="space-y-2">
                  <Label className="text-sm">{t('basicInfo.project')}</Label>
                  <Select
                    value={formData.projectId ? String(formData.projectId) : ""}
                    onValueChange={(value) => handleProjectSelection(value)}
                    disabled={!formData.companyId || loadingProjects}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue
                        placeholder={
                          !formData.companyId
                            ? t('basicInfo.selectCompanyFirst')
                            : loadingProjects
                            ? t('basicInfo.loadingProjects')
                            : t('basicInfo.selectProject')
                        }
                      />
                    </SelectTrigger>
                    <SelectContent className="max-h-80">
                      {projectOptions.map((project) => (
                        <SelectItem key={project.id} value={project.id}>
                          {project.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </fieldset>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <fieldset>
                  <Label htmlFor="title" className="text-sm">{t('basicInfo.titleLabel')} {t('basicInfo.required')}</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => handleInputChange("title", e.target.value)}
                    placeholder={t('basicInfo.titlePlaceholder')}
                    className="mt-1"
                  />
                </fieldset>

                <fieldset>
                  <Label htmlFor="projectName" className="text-sm">{t('basicInfo.projectName')} {t('basicInfo.required')}</Label>
                  <Input
                    id="projectName"
                    value={formData.projectName}
                    onChange={(e) => handleInputChange("projectName", e.target.value)}
                    placeholder={t('basicInfo.projectNamePlaceholder')}
                    className="mt-1"
                  />
                </fieldset>
              </div>
            </CardContent>
          </Card>

          {/* Template Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('template.title')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="useTemplate"
                  checked={useTemplate}
                  onChange={(e) => setUseTemplate(e.target.checked)}
                  className={iconSizes.sm}
                />
                <Label htmlFor="useTemplate" className="text-sm">
                  {t('template.useDefault')} ({DEFAULT_TEMPLATE_SECTIONS.length} {t('template.sections')}, {TEMPLATE_ARTICLE_COUNT} {t('template.articles')})
                </Label>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Main Content — split grid: Structure Editor + Live Preview */}
        <section
          className={`obligations-page flex-1 grid gap-6 ${viewMode === 'split' ? OBLIGATION_PREVIEW_LAYOUT.splitLayoutGridClass : OBLIGATION_PREVIEW_LAYOUT.singleLayoutGridClass} w-full min-h-0`}
          aria-label={t('aria.editObligation')}
        >
          {/* Left Panel - Structure Editor */}
          <section aria-label={t('aria.editForm')}>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t('structure.title')}</CardTitle>
              </CardHeader>
              <CardContent>
                <StructureEditor
                  sections={formData.sections}
                  onSectionsChange={(sections) => handleInputChange("sections", sections)}
                  activeItemId={activeItem?.id}
                  onActiveItemChange={setActiveItem}
                />
              </CardContent>
            </Card>
          </section>


          {/* Right Panel - Live Preview */}
          {viewMode === 'split' && (
            <aside className="sticky top-6" aria-label={t('aria.preview')}>
              <Card
                className={`flex flex-col relative ${previewHeightClass}`}
              >
                <CardHeader className="relative z-10 bg-card">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Eye className={iconSizes.sm} />
                    {t('preview.title')}
                  </CardTitle>
                  <CardDescription>{t('preview.description')}</CardDescription>
                </CardHeader>
                <CardContent
                  ref={previewContentRef}
                  className="p-0 absolute inset-x-0 top-[100px] bottom-0 overflow-y-auto overscroll-auto"
                  data-testid="preview-card-content"
                >
                  <LivePreview
                    className="border-0"
                    document={{
                      id: "preview",
                      title: formData.title || t('newPage.title'),
                      projectName: formData.projectName || t('preview.unknownProject'),
                      contractorCompany: formData.contractorCompany || t('preview.unknownContractor'),
                      status: "draft",
                      createdAt: new Date(),
                      updatedAt: new Date(),
                      tableOfContents: tableOfContents,
                      sections: formData.sections,
                      projectDetails: formData.projectDetails,
                      owners: formData.owners
                    }}
                    activeItemId={activeItem?.id}
                    onItemClick={setActiveItem}
                    viewMode="preview"
                  />
                </CardContent>
              </Card>
            </aside>
          )}
        </section>
      </div>
    </PageLayout>
  );
}




