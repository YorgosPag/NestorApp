
"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
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
  Plus,
  Trash2,
  Save,
  FileText,
  Eye,
  ChevronRight,
  ChevronDown,
  Layout,
  BookOpen
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
import Link from "next/link";

interface FormData {
  title: string;
  projectName: string;
  contractorCompany: string;
  owners: Owner[];
  projectDetails: ProjectDetails;
  sections: ObligationSection[];
}

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
    sections: []
  });

  const [useTemplate, setUseTemplate] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'split' | 'edit-only'>('split');
  const [activeItem, setActiveItem] = useState<{type: 'section' | 'article' | 'paragraph', id: string} | null>(null);
  const [expandedItems, setExpandedItems] = useState<string[]>([]);
  
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

  const renderTableOfContents = useCallback(() => {
    const renderTocItem = (item: TableOfContentsItem) => (
      <div key={item.id} className="ml-4">
        <div 
          className={`flex items-center gap-2 py-1 text-sm cursor-pointer hover:bg-gray-100 rounded px-2 ${
            activeItem?.id === item.id ? 'bg-blue-50 text-blue-700' : 'text-gray-600'
          }`}
          onClick={() => setActiveItem({ type: item.type, id: item.id })}
        >
          <span className="font-mono text-xs min-w-8">{item.number}</span>
          <span className="truncate">{item.title}</span>
        </div>
        {item.children?.map(renderTocItem)}
      </div>
    );

    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            Πίνακας Περιεχομένων
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-48">
            {tableOfContents.length > 0 ? (
              <div className="space-y-1">
                {tableOfContents.map(renderTocItem)}
              </div>
            ) : (
              <p className="text-sm text-gray-500 italic">
                Προσθέστε ενότητες για να δημιουργηθεί ο πίνακας περιεχομένων
              </p>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    );
  }, [tableOfContents, activeItem]);

  const renderPreview = useCallback(() => {
    return (
      <div className="space-y-4">
        {/* Document Header */}
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-xl">{formData.title || "Νέα Συγγραφή Υποχρεώσεων"}</CardTitle>
            <CardDescription className="text-base">{formData.projectName || "Όνομα Έργου"}</CardDescription>
          </CardHeader>
        </Card>

        {/* Table of Contents */}
        {renderTableOfContents()}

        {/* Sections Preview */}
        <ScrollArea className="h-96">
          <div className="space-y-4">
            {formData.sections.map((section) => (
              <Card 
                key={section.id} 
                className={`${activeItem?.id === section.id ? 'ring-2 ring-blue-500' : ''}`}
              >
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Badge variant="outline">{section.number}</Badge>
                    {section.title}
                  </CardTitle>
                </CardHeader>
                {section.content && (
                  <CardContent className="pt-0">
                    <div className="prose prose-sm max-w-none text-sm text-gray-700">
                      {section.content}
                    </div>
                  </CardContent>
                )}

                {/* Articles Preview */}
                {section.articles && section.articles.length > 0 && (
                  <CardContent className="pt-0">
                    <div className="space-y-3 ml-4">
                      {section.articles.map((article) => (
                        <div 
                          key={article.id}
                          className={`border-l-2 border-gray-200 pl-4 ${
                            activeItem?.id === article.id ? 'border-blue-500' : ''
                          }`}
                        >
                          <h4 className="font-medium text-sm flex items-center gap-2">
                            <Badge variant="secondary" className="text-xs">{article.number}</Badge>
                            {article.title}
                          </h4>
                          {article.content && (
                            <div className="text-xs text-gray-600 mt-1">
                              {article.content}
                            </div>
                          )}

                          {/* Paragraphs Preview */}
                          {article.paragraphs && article.paragraphs.length > 0 && (
                            <div className="space-y-2 mt-2 ml-4">
                              {article.paragraphs.map((paragraph) => (
                                <div 
                                  key={paragraph.id}
                                  className={`text-xs ${
                                    activeItem?.id === paragraph.id ? 'bg-blue-50 p-2 rounded' : ''
                                  }`}
                                >
                                  <span className="font-mono mr-2">{paragraph.number}.</span>
                                  {paragraph.content}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                )}
              </Card>
            ))}

            {formData.sections.length === 0 && (
              <Card>
                <CardContent className="text-center py-8">
                  <FileText className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p className="text-gray-500">Δεν έχουν προστεθεί ενότητες ακόμα</p>
                </CardContent>
              </Card>
            )}
          </div>
        </ScrollArea>
      </div>
    );
  }, [formData, activeItem, renderTableOfContents]);

  const renderStructureEditor = useCallback(() => {
    return (
      <div className="space-y-4">
        {/* Add Section Button */}
        <div className="flex items-center justify-between">
          <h3 className="font-medium">Δομή Εγγράφου</h3>
          <Button onClick={addSection} size="sm" className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Νέα Ενότητα
          </Button>
        </div>

        {/* Sections Editor */}
        <ScrollArea className="h-96">
          <div className="space-y-2">
            {formData.sections.map((section) => (
              <Card key={section.id} className="p-3">
                <div className="space-y-3">
                  {/* Section Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleExpanded(section.id)}
                        className="p-0 h-6 w-6"
                      >
                        {expandedItems.includes(section.id) ? 
                          <ChevronDown className="h-4 w-4" /> : 
                          <ChevronRight className="h-4 w-4" />
                        }
                      </Button>
                      <Badge variant="outline">{section.number}</Badge>
                      <span className="text-sm font-medium">{section.title || "Χωρίς τίτλο"}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => addArticle(section.id)}
                        className="h-7 px-2"
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteSection(section.id)}
                        className="h-7 px-2 text-red-600"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>

                  {/* Section Content Editor */}
                  {expandedItems.includes(section.id) && (
                    <div className="space-y-3 pl-6">
                      <div className="space-y-2">
                        <Input
                          placeholder="Τίτλος ενότητας"
                          value={section.title}
                          onChange={(e) => updateSection(section.id, { title: e.target.value })}
                          className="text-sm"
                        />
                        <Textarea
                          placeholder="Περιεχόμενο ενότητας"
                          value={section.content}
                          onChange={(e) => updateSection(section.id, { content: e.target.value })}
                          rows={3}
                          className="text-sm"
                        />
                      </div>

                      {/* Articles */}
                      {section.articles && section.articles.map((article) => (
                        <Card key={article.id} className="p-2 bg-gray-50">
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Badge variant="secondary" className="text-xs">{article.number}</Badge>
                                <span className="text-xs">{article.title || "Χωρίς τίτλο"}</span>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => addParagraph(section.id, article.id)}
                                className="h-6 px-2 text-xs"
                              >
                                + Παράγραφος
                              </Button>
                            </div>
                            
                            <Input
                              placeholder="Τίτλος άρθρου"
                              value={article.title}
                              onChange={(e) => updateArticle(section.id, article.id, { title: e.target.value })}
                              className="text-xs h-7"
                            />

                            {/* Paragraphs */}
                            {article.paragraphs && article.paragraphs.map((paragraph) => (
                              <div key={paragraph.id} className="flex items-center gap-2 ml-4">
                                <span className="text-xs font-mono min-w-6">{paragraph.number}.</span>
                                <Textarea
                                  placeholder="Περιεχόμενο παραγράφου"
                                  value={paragraph.content}
                                  onChange={(e) => updateParagraph(section.id, article.id, paragraph.id, { content: e.target.value })}
                                  rows={2}
                                  className="text-xs"
                                />
                              </div>
                            ))}
                          </div>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </ScrollArea>
      </div>
    );
  }, [
    formData.sections, 
    addSection, 
    toggleExpanded, 
    expandedItems, 
    addArticle, 
    deleteSection, 
    updateSection, 
    addParagraph,
    updateArticle,
    updateParagraph
  ]);

  return (
    <PageLayout>
      <div className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8">
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
              <p className="text-gray-600 text-sm">Δημιουργήστε μια νέα συγγραφή υποχρεώσεων με live preview</p>
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
        <div className={`grid gap-6 ${viewMode === 'split' ? 'lg:grid-cols-2' : 'lg:grid-cols-1'}`}>
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
                {renderStructureEditor()}
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
                  {renderPreview()}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </PageLayout>
  );
}
