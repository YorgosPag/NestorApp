
"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ArrowLeft,
  Save,
  Eye,
  Layout
} from "lucide-react";
import { PageLayout } from "@/components/app/page-layout";
import { 
  Owner, 
  ProjectDetails, 
  ObligationDocument, 
  ObligationSection, 
  ObligationArticle, 
  ObligationParagraph,
  TableOfContentsItem,
  createNewSection,
  createNewArticle,
  createNewParagraph,
  generateTableOfContents,
  renumberSections
} from "@/types/obligations";
import { DEFAULT_TEMPLATE_SECTIONS } from '@/types/mock-obligations';
import { obligationsService } from "@/services/obligations.service";
import { TableOfContents } from "@/components/obligations/table-of-contents";
import StructureEditor from "@/components/obligations/structure-editor";
import LivePreview from "@/components/obligations/live-preview";
import { RichTextEditor } from "@/components/obligations/rich-text-editor";
import { useIconSizes } from '@/hooks/useIconSizes';
import Link from "next/link";

// 🏢 ENTERPRISE: Import existing κεντρικοποιημένων components & services
import { CompaniesService } from "@/services/companies.service";
import { getNavigationCompanyIds } from "@/services/navigation-companies.service";
import { useCompanyRelationships } from "@/services/relationships/hooks/useEnterpriseRelationships";
import type { Contact } from "@/types/contacts";
import type { ProjectStructure } from "@/services/projects/contracts";

interface FormData {
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
  const [formData, setFormData] = useState<FormData>({
    title: "",
    projectName: "",
    contractorCompany: "Ν.Χ.Γ. ΠΑΓΩΝΗΣ & ΣΙΑ Ο.Ε.", // 🔧 ΔΙΟΡΘΩΣΗ: Σωστή εταιρική ονομασία
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
  const [expandedItems, setExpandedItems] = useState<string[]>([]);
  const [dynamicHeight, setDynamicHeight] = useState('calc(100vh-120px)');
  const previewContentRef = useRef<HTMLDivElement>(null);
  const calculateHeightRef = useRef<() => void>();
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const textareaTimerRef = useRef<NodeJS.Timeout | null>(null);
  const expandedTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Height calculation function
  const calculateHeight = useCallback(() => {
    if (previewContentRef.current) {
      const scrollHeight = previewContentRef.current.scrollHeight;
      const viewportHeight = window.innerHeight;
      const headerHeight = 120;
      const minHeight = 400;

      // ΓΙΩΡΓΟΣ: Κόκκινο container να είναι 2300px
      const neededHeight = 2300;

      // Debug logging για το ύψος του κίτρινου container
      console.log('🟨 ΚΙΤΡΙΝΟ CONTAINER HEIGHT:', {
        scrollHeight: `${scrollHeight}px`,
        viewportHeight: `${viewportHeight}px`,
        headerHeight: `${headerHeight}px`,
        calculatedNeededHeight: `${neededHeight}px`,
        finalDynamicHeight: `${neededHeight}px`
      });

      setDynamicHeight(`${neededHeight}px`);
    }
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
  const [companies, setCompanies] = useState<Contact[]>([]);
  const [projects, setProjects] = useState<ProjectStructure[]>([]);
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
        const companyContacts = await companiesService.getAllActiveCompanies();
        setCompanies(companyContacts);

        // 🔗 ENTERPRISE: Build mapping από contacts.id → navigation_companies.contactId
        // Αυτό είναι απαραίτητο γιατί το projects API περιμένει το contactId από navigation_companies
        const navigationIds = await getNavigationCompanyIds();
        const mapping = new Map<string, string>();

        // Map κάθε company ID (από contacts) στο αντίστοιχο contactId (για projects API)
        // Η λογική είναι: στο navigation_companies η εταιρεία αποθηκεύεται με contactId="pzNUy8ksddGCtcQMqumR"
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

        console.log("🏢 Companies mapping built:", {
          totalCompanies: companyContacts.length,
          mappingEntries: mapping.size,
          navigationIds: navigationIds.length
        });

      } catch (error) {
        console.error("Error loading companies:", error);
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

        console.log("🔗 Loading projects:", {
          selectedCompanyId: formData.companyId,
          mappedContactId: contactIdForProjects,
          usingMapping: contactIdForProjects !== formData.companyId
        });

        // 🚀 ENTERPRISE RELATIONSHIP ENGINE: Φόρτωση projects μέσω centralized system
        console.log(`🏗️ ENTERPRISE: Loading projects for company ${contactIdForProjects} via Relationship Engine`);
        const projectsData = await companyRelationships.getProjects();
        setProjects(projectsData);

        console.log(`✅ ENTERPRISE: Loaded ${projectsData.length} projects for company ${contactIdForProjects} via Relationship Engine`);

      } catch (error) {
        console.error("Error loading projects for company:", error);
        setProjects([]);
      } finally {
        setLoadingProjects(false);
      }
    };

    // Μόνο αν έχουμε το mapping έτοιμο
    if (navigationCompanyMap.size > 0) {
      loadProjectsForCompany();
    }
  }, [formData.companyId, navigationCompanyMap]);

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

  // Auto-resize textareas when accordion items are expanded
  useEffect(() => {
    const autoResizeAllTextareas = () => {
      const textareas = document.querySelectorAll('textarea');
      textareas.forEach(textarea => {
        if (textarea instanceof HTMLTextAreaElement) {
          autoResize(textarea);
        }
      });
    };

    // Run after a small delay to ensure DOM is updated after expansion - Strict Mode safe
    expandedTimerRef.current = setTimeout(autoResizeAllTextareas, 150);

    return () => {
      if (expandedTimerRef.current) {
        clearTimeout(expandedTimerRef.current);
      }
    };
  }, [expandedItems]); // Re-run when accordion items expand/collapse

  // CSS overscroll-behavior χειρίζεται το synchronized scrolling φυσικά

  // Initialize with template if selected
  useEffect(() => {
    if (useTemplate && formData.sections.length === 0) {
      setFormData(prev => ({
        ...prev,
        sections: DEFAULT_TEMPLATE_SECTIONS.map(section => ({
          ...section,
          articles: [],
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
    companies.map(company => ({
      id: company.id,
      name: company.companyName || 'Άγνωστη εταιρεία'
    })),
    [companies]
  );

  // 🏢 ENTERPRISE: Transform projects for centralized Select
  const projectOptions = useMemo(() =>
    projects.map(project => ({
      id: String(project.id),
      name: project.name || 'Άγνωστο έργο'
    })),
    [projects]
  );

  const handleInputChange = useCallback((field: keyof FormData, value: any) => {
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
        location: selectedProject?.location || prev.projectDetails.location,
        address: selectedProject?.address || prev.projectDetails.address
      }
    }));
  }, [projects]);

  const handleProjectDetailsChange = useCallback((field: keyof ProjectDetails, value: string) => {
    setFormData(prev => ({
      ...prev,
      projectDetails: {
        ...(prev.projectDetails ?? {}),
        [field]: value
      }
    }));
  }, []);

  const handleOwnerChange = useCallback((index: number, field: keyof Owner, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      owners: prev.owners.map((owner, i) => {
        if (i === index) {
            if (field === 'share') {
                const raw = value as string;
                const parsed = raw === '' ? undefined : (parseFloat(raw) || 0);
                return { ...owner, [field]: parsed };
            }
            return { ...owner, [field]: value };
        }
        return owner;
      })
    }));
  }, []);

  const addOwner = useCallback(() => {
    const newId = (formData.owners.length + 1).toString();
    handleInputChange("owners", [...formData.owners, { id: newId, name: "", share: 0 }]);
  }, [formData.owners, handleInputChange]);

  const removeOwner = useCallback((index: number) => {
    if (formData.owners.length > 1) {
      handleInputChange("owners", formData.owners.filter((_, i) => i !== index));
    }
  }, [formData.owners, handleInputChange]);

  // Section management
  const addSection = useCallback(() => {
    const newSection = createNewSection(formData.sections.length);
    handleInputChange("sections", [...formData.sections, newSection]);
    setActiveItem({ type: 'section', id: newSection.id });
    setExpandedItems(prev => [...prev, newSection.id]);
  }, [formData.sections, handleInputChange]);

  const updateSection = useCallback((sectionId: string, updates: Partial<ObligationSection>) => {
    handleInputChange("sections", formData.sections.map(section =>
      section.id === sectionId ? { ...section, ...updates } : section
    ));
  }, [formData.sections, handleInputChange]);

  const deleteSection = useCallback((sectionId: string) => {
    handleInputChange("sections", renumberSections(formData.sections.filter(s => s.id !== sectionId)));
    setExpandedItems(prev => prev.filter(id => id !== sectionId));
    if (activeItem?.id === sectionId) {
      setActiveItem(null);
    }
  }, [formData.sections, handleInputChange, activeItem]);

  // Article management
  const addArticle = useCallback((sectionId: string) => {
    const newSections = formData.sections.map(section => {
      if (section.id === sectionId) {
        const newArticle = createNewArticle(sectionId, section.articles?.length || 0);
        return { ...section, articles: [...(section.articles || []), newArticle], isExpanded: true };
      }
      return section;
    });
    handleInputChange("sections", newSections);
  }, [formData.sections, handleInputChange]);

  const updateArticle = useCallback((sectionId: string, articleId: string, updates: Partial<ObligationArticle>) => {
    const newSections = formData.sections.map(section => {
        if (section.id === sectionId) {
            return { ...section, articles: section.articles?.map(a => a.id === articleId ? { ...a, ...updates } : a)};
        }
        return section;
    });
    handleInputChange("sections", newSections);
  }, [formData.sections, handleInputChange]);
  

  // Paragraph management
  const addParagraph = useCallback((sectionId: string, articleId: string) => {
    const newSections = formData.sections.map(section => {
        if (section.id === sectionId) {
            return {
                ...section,
                articles: section.articles?.map(a => {
                    if (a.id === articleId) {
                        const newParagraph = createNewParagraph(articleId, a.paragraphs?.length || 0);
                        return { ...a, paragraphs: [...(a.paragraphs || []), newParagraph], isExpanded: true };
                    }
                    return a;
                })
            };
        }
        return section;
    });
    handleInputChange("sections", newSections);
  }, [formData.sections, handleInputChange]);

  const updateParagraph = useCallback((sectionId: string, articleId: string, paragraphId: string, updates: Partial<ObligationParagraph>) => {
    const newSections = formData.sections.map(section => {
        if (section.id === sectionId) {
            return {
                ...section,
                articles: section.articles?.map(a => {
                    if (a.id === articleId) {
                        return { ...a, paragraphs: a.paragraphs?.map(p => p.id === paragraphId ? { ...p, ...updates } : p) };
                    }
                    return a;
                })
            };
        }
        return section;
    });
    handleInputChange("sections", newSections);
  }, [formData.sections, handleInputChange]);

  const toggleExpanded = useCallback((id: string) => {
    setExpandedItems(prev => 
      prev.includes(id) 
        ? prev.filter(item => item !== id)
        : [...prev, id]
    );
  }, []);

  const handleSubmit = async () => {
    setIsLoading(true);

    // 🏢 ENTERPRISE VALIDATION
    if (!formData.title.trim()) {
      alert("Παρακαλώ εισάγετε τίτλο");
      setIsLoading(false);
      return;
    }

    if (!formData.projectName.trim()) {
      alert("Παρακαλώ εισάγετε όνομα έργου");
      setIsLoading(false);
      return;
    }

    // 🔗 ENTERPRISE: Validate company selection (optional but recommended)
    if (!formData.companyId) {
      console.warn("⚠️ No company selected - obligation will use legacy contractorCompany field");
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
            email: selectedCompany.email,
            phone: selectedCompany.phone,
            address: selectedCompany.address,
            registrationNumber: selectedCompany.taxNumber
          }
        }),

        // 🔗 ENTERPRISE: Rich project details (if project selected)
        ...(selectedProject && {
          projectInfo: {
            description: selectedProject.description,
            location: selectedProject.location,
            startDate: selectedProject.startDate,
            endDate: selectedProject.endDate,
            projectType: selectedProject.type,
            budget: selectedProject.budget
          }
        })
      };

      console.log("🏢 Creating obligation with enterprise data:", {
        hasCompany: !!formData.companyId,
        hasProject: !!formData.projectId,
        companyName: selectedCompany?.companyName,
        projectName: selectedProject?.name
      });

      const newObligation = await obligationsService.create(obligationData);

      router.push(`/obligations/${newObligation.id}/edit`);
    } catch (error) {
      console.error("Error creating obligation:", error);
      alert("Σφάλμα κατά τη δημιουργία της συγγραφής υποχρεώσεων");
    } finally {
      setIsLoading(false);
    }
  };




  return (
    <PageLayout>
      <div className="max-w-full mx-auto p-4 md:p-6 lg:p-8">
        {/* Header */}
        <header className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Link href="/obligations">
              <Button variant="ghost" size="sm">
                <ArrowLeft className={iconSizes.sm} />
              </Button>
            </Link>
            <hgroup>
              <h1 className="text-2xl font-bold">Νέα Συγγραφή Υποχρεώσεων</h1>
              <p className="text-muted-foreground text-sm">Δημιουργήστε μια νέα συγγραφή υποχρεώσεων με live preview</p>
            </hgroup>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={() => setViewMode(viewMode === 'split' ? 'edit-only' : 'split')}
              size="sm"
            >
              <Layout className={`${iconSizes.sm} mr-2`} />
              {viewMode === 'split' ? 'Μόνο επεξεργασία' : 'Split View'}
            </Button>
            <Button 
              onClick={handleSubmit} 
              disabled={isLoading}
              className="flex items-center gap-2"
            >
              <Save className={iconSizes.sm} />
              {isLoading ? "Δημιουργία..." : "Δημιουργία"}
            </Button>
          </div>
        </header>

        {/* Main Content */}
        <section
          className={`obligations-page flex-1 grid gap-6 ${viewMode === 'split' ? 'lg:grid-cols-[1fr_1fr] lg:items-start' : 'lg:grid-cols-1'} w-full min-h-0`}
          aria-label="Επεξεργασία υποχρέωσης"
        >
          {/* Left Panel - Editor */}
          <section className="space-y-6" aria-label="Φόρμα επεξεργασίας">
            {/* Basic Information */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Βασικές Πληροφορίες</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* 🏢 ENTERPRISE: Company & Project Selection ΠΡΩΤΑ */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <fieldset className="space-y-2">
                    <Label className="text-sm">Εταιρεία Κατασκευαστή *</Label>
                    <Select
                      value={formData.companyId || ""}
                      onValueChange={handleCompanySelection}
                      disabled={loadingCompanies}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue
                          placeholder={loadingCompanies ? "Φόρτωση εταιρειών..." : "Επιλέξτε εταιρεία"}
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
                    <Label className="text-sm">Έργο (Προαιρετικό)</Label>
                    <Select
                      value={formData.projectId ? String(formData.projectId) : ""}
                      onValueChange={(value) => handleProjectSelection(value)}
                      disabled={!formData.companyId || loadingProjects}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue
                          placeholder={
                            !formData.companyId
                              ? "Πρώτα επιλέξτε εταιρεία"
                              : loadingProjects
                              ? "Φόρτωση έργων..."
                              : "Επιλέξτε έργο"
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

                {/* Τίτλος και Όνομα Έργου ΚΑΤΩ από τα dropdowns */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <fieldset>
                    <Label htmlFor="title" className="text-sm">Τίτλος *</Label>
                    <Input
                      id="title"
                      value={formData.title}
                      onChange={(e) => handleInputChange("title", e.target.value)}
                      placeholder="π.χ. Συγγραφή Υποχρεώσεων - Οικόπεδο Αθανασιάδη"
                      className="mt-1"
                    />
                  </fieldset>

                  <fieldset>
                    <Label htmlFor="projectName" className="text-sm">Όνομα Έργου *</Label>
                    <Input
                      id="projectName"
                      value={formData.projectName}
                      onChange={(e) => handleInputChange("projectName", e.target.value)}
                      placeholder="π.χ. Επέκταση Θέρμης"
                      className="mt-1"
                    />
                  </fieldset>
                </div>
              </CardContent>
            </Card>

            {/* Template Selection */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Πρότυπο</CardTitle>
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
                    Χρήση προεπιλεγμένου προτύπου ({DEFAULT_TEMPLATE_SECTIONS.length} ενότητες)
                  </Label>
                </div>
              </CardContent>
            </Card>

            {/* Structure Editor */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Δομή & Περιεχόμενο</CardTitle>
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
            <aside className="space-y-6 relative" aria-label="Προεπισκόπηση">
              <Card
                className="flex flex-col relative"
                style={{ height: dynamicHeight }}
              >
                <CardHeader className="relative z-10 bg-card">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Eye className={iconSizes.sm} />
                    Live Preview
                  </CardTitle>
                  <CardDescription>Δείτε πως θα φαίνεται το τελικό έγγραφο</CardDescription>
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
                      title: formData.title || "Νέα Συγγραφή Υποχρεώσεων",
                      projectName: formData.projectName || "Άγνωστο έργο",
                      contractorCompany: formData.contractorCompany || "Άγνωστος εργολάβος",
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
