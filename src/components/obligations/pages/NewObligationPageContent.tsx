"use client";

/**
 * New Obligation Page Content
 *
 * @module components/obligations/pages/NewObligationPageContent
 * @enterprise ADR-294 Batch 8 — extracted from app/obligations/new/page.tsx
 */

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Save, Eye, Layout } from "lucide-react";
import { PageLayout } from "@/components/app/page-layout";
import { useIconSizes } from '@/hooks/useIconSizes';
import { cn, getSpacingClass } from '@/lib/design-system';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { DEFAULT_TEMPLATE_SECTIONS } from '@/types/mock-obligations';
import { TEMPLATE_ARTICLE_COUNT } from '@/types/obligations/default-template';
import StructureEditor from "@/components/obligations/structure-editor";
import LivePreview from "@/components/obligations/live-preview";
import { getDynamicHeightClass } from "@/components/ui/utils/dynamic-styles";
import { OBLIGATION_PREVIEW_LAYOUT } from "@/components/obligations/config/preview-layout";
import Link from "next/link";

import { useNewObligationPage } from '../hooks/useNewObligationPage';

export function NewObligationPageContent() {
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();

  const {
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
  } = useNewObligationPage();

  const previewHeightClass = getDynamicHeightClass(dynamicHeight);

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
              <p className={cn("text-sm", colors.text.muted)}>{t('newPage.subtitle')}</p>
            </hgroup>
          </div>

          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={toggleViewMode} size="sm">
              <Layout className={`${iconSizes.sm} mr-2`} />
              {viewMode === 'split' ? t('newPage.editOnly') : t('newPage.splitView')}
            </Button>
            <Button onClick={handleSubmit} disabled={isLoading} className="flex items-center gap-2">
              <Save className={iconSizes.sm} />
              {isLoading ? t('newPage.creating') : t('newPage.create')}
            </Button>
          </div>
        </header>

        {/* Basic Info & Template */}
        <section className="space-y-6 w-full" aria-label={t('aria.editForm')}>
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
                      <SelectValue placeholder={loadingCompanies ? t('basicInfo.loadingCompanies') : t('basicInfo.selectCompany')} />
                    </SelectTrigger>
                    <SelectContent className="max-h-80">
                      {companyOptions.map((company) => (
                        <SelectItem key={company.id} value={company.id}>{company.name}</SelectItem>
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
                        <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>
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

        {/* Main Content — split grid */}
        <section
          className={`obligations-page flex-1 grid gap-6 ${viewMode === 'split' ? OBLIGATION_PREVIEW_LAYOUT.splitLayoutGridClass : OBLIGATION_PREVIEW_LAYOUT.singleLayoutGridClass} w-full min-h-0`}
          aria-label={t('aria.editObligation')}
        >
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

          {viewMode === 'split' && (
            <aside className="sticky top-6" aria-label={t('aria.preview')}>
              <Card className={`flex flex-col relative ${previewHeightClass}`}>
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
