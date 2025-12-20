
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
import Link from "next/link";

interface FormData {
  title: string;
  projectName: string;
  contractorCompany: string;
  owners: Owner[];
  projectDetails: ProjectDetails;
  sections: ObligationSection[];
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
  const router = useRouter();
  const [formData, setFormData] = useState<FormData>({
    title: "",
    projectName: "",
    contractorCompany: "Χ.Γ.Γ. ΠΑΓΩΝΗΣ Ο.Ε.",
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
    sections: DEFAULT_TEMPLATE_SECTIONS
  });

  const [useTemplate, setUseTemplate] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'split' | 'edit-only'>('split');
  const [activeItem, setActiveItem] = useState<{type: 'section' | 'article' | 'paragraph', id: string} | null>(null);
  const [expandedItems, setExpandedItems] = useState<string[]>([]);

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

    // Run after a small delay to ensure DOM is updated
    const timeoutId = setTimeout(autoResizeAllTextareas, 100);

    return () => clearTimeout(timeoutId);
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

    // Run after a small delay to ensure DOM is updated after expansion
    const timeoutId = setTimeout(autoResizeAllTextareas, 150);

    return () => clearTimeout(timeoutId);
  }, [expandedItems]); // Re-run when accordion items expand/collapse

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

  const handleInputChange = useCallback((field: keyof FormData, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  }, []);

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
                const parsed = raw === '' ? '' : (parseFloat(raw) || 0);
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
    
    // Validation
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

    try {
      const newObligation = await obligationsService.create({
        ...formData,
        status: "draft"
      });

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
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Link href="/obligations">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold">Νέα Συγγραφή Υποχρεώσεων</h1>
              <p className="text-muted-foreground text-sm">Δημιουργήστε μια νέα συγγραφή υποχρεώσεων με live preview</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={() => setViewMode(viewMode === 'split' ? 'edit-only' : 'split')}
              size="sm"
            >
              <Layout className="h-4 w-4 mr-2" />
              {viewMode === 'split' ? 'Μόνο επεξεργασία' : 'Split View'}
            </Button>
            <Button 
              onClick={handleSubmit} 
              disabled={isLoading}
              className="flex items-center gap-2"
            >
              <Save className="h-4 w-4" />
              {isLoading ? "Δημιουργία..." : "Δημιουργία"}
            </Button>
          </div>
        </div>

        {/* Main Content */}
        <div className={`grid gap-6 ${viewMode === 'split' ? 'lg:grid-cols-[1fr_1fr]' : 'lg:grid-cols-1'} w-full`}>
          {/* Left Panel - Editor */}
          <div className="space-y-6">
            {/* Basic Information */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Βασικές Πληροφορίες</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="title" className="text-sm">Τίτλος *</Label>
                    <Input
                      id="title"
                      value={formData.title}
                      onChange={(e) => handleInputChange("title", e.target.value)}
                      placeholder="π.χ. Συγγραφή Υποχρεώσεων - Οικόπεδο Αθανασιάδη"
                      className="mt-1"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="projectName" className="text-sm">Όνομα Έργου *</Label>
                    <Input
                      id="projectName"
                      value={formData.projectName}
                      onChange={(e) => handleInputChange("projectName", e.target.value)}
                      placeholder="π.χ. Επέκταση Θέρμης"
                      className="mt-1"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="contractorCompany" className="text-sm">Εργολάβος</Label>
                  <Input
                    id="contractorCompany"
                    value={formData.contractorCompany}
                    onChange={(e) => handleInputChange("contractorCompany", e.target.value)}
                    className="mt-1"
                  />
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
                    className="h-4 w-4"
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
          </div>

          {/* Right Panel - Live Preview */}
          {viewMode === 'split' && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Eye className="h-4 w-4" />
                    Προεπισκόπηση
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <LivePreview
                    document={{
                      id: 'new-obligation',
                      title: formData.title || 'Νέα Συγγραφή Υποχρεώσεων',
                      projectName: formData.projectName || 'Όνομα Έργου',
                      sections: formData.sections,
                      status: 'draft',
                      createdAt: new Date(),
                      updatedAt: new Date(),
                      contractorCompany: formData.contractorCompany,
                      owners: formData.owners
                    }}
                    activeItemId={activeItem?.id}
                    onItemClick={setActiveItem}
                    viewMode="preview"
                  />
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </PageLayout>
  );
}
