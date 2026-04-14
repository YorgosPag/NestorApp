/**
 * =============================================================================
 * Document Template Panel — Create documents from templates
 * =============================================================================
 *
 * Lists available templates, allows variable fill-in, and renders
 * preview of the generated document.
 *
 * @module components/shared/files/DocumentTemplatePanel
 * @enterprise ADR-191 Phase 4.1 — Document Templates
 */

'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  FileSignature,
  Plus,
  Trash2,
  Eye,
  Copy,
  FileText,
  Receipt,
  Scale,
  Award,
  ScrollText,
  Mail,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { Spinner } from '@/components/ui/spinner';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import {
  DocumentTemplateService,
  type DocumentTemplate,
  type TemplateCategory,
} from '@/services/document-template.service';
import {
  createDocumentTemplateWithPolicy,
  deleteDocumentTemplateWithPolicy,
} from '@/services/filesystem/file-mutation-gateway';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import '@/lib/design-system';

// ============================================================================
// TYPES
// ============================================================================

export interface DocumentTemplatePanelProps {
  companyId: string;
  currentUserId: string;
  className?: string;
}

// ============================================================================
// HELPERS
// ============================================================================

const CATEGORY_ICONS: Record<TemplateCategory, typeof FileText> = {
  contract: Scale,
  permit: Award,
  invoice: Receipt,
  report: ScrollText,
  letter: Mail,
  certificate: Award,
  other: FileText,
};

const CATEGORY_KEYS: Record<TemplateCategory, string> = {
  contract: 'templates.categories.contract',
  permit: 'templates.categories.permit',
  invoice: 'templates.categories.invoice',
  report: 'templates.categories.report',
  letter: 'templates.categories.letter',
  certificate: 'templates.categories.certificate',
  other: 'templates.categories.other',
};

// ============================================================================
// COMPONENT
// ============================================================================

export function DocumentTemplatePanel({
  companyId,
  currentUserId,
  className,
}: DocumentTemplatePanelProps) {
  const { t } = useTranslation(['files', 'files-media']);
  const colors = useSemanticColors();

  const categoryLabels = useMemo<Record<TemplateCategory, string>>(() => {
    const entries = Object.entries(CATEGORY_KEYS) as [TemplateCategory, string][];
    return Object.fromEntries(
      entries.map(([key, translationKey]) => [key, t(translationKey)])
    ) as Record<TemplateCategory, string>;
  }, [t]);
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState<DocumentTemplate | null>(null);
  const [variableValues, setVariableValues] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  // New template form
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState<TemplateCategory>('contract');
  const [newContent, setNewContent] = useState('');

  // Fetch templates
  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const data = await DocumentTemplateService.getTemplates(companyId);
      setTemplates(data);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  // Select template and init variable values
  const handleSelectTemplate = useCallback((tmpl: DocumentTemplate) => {
    setSelectedTemplate(tmpl);
    const defaults: Record<string, string> = {};
    for (const v of tmpl.variables) {
      defaults[v.key] = v.defaultValue;
    }
    setVariableValues(defaults);
    setPreview(null);
  }, []);

  // Generate preview
  const handlePreview = useCallback(() => {
    if (!selectedTemplate) return;
    const rendered = DocumentTemplateService.renderTemplate(
      selectedTemplate.content,
      variableValues
    );
    setPreview(rendered);
  }, [selectedTemplate, variableValues]);

  // Copy rendered HTML to clipboard
  const handleCopy = useCallback(async () => {
    if (preview) {
      await navigator.clipboard.writeText(preview);
    }
  }, [preview]);

  // Create template
  const handleCreate = useCallback(async () => {
    if (!newName.trim() || !newContent.trim()) return;

    // Extract {{variables}} from content
    const varMatches = newContent.match(/\{\{(\w+)\}\}/g) ?? [];
    const uniqueVars = [...new Set(varMatches.map((m) => m.replace(/\{|\}/g, '')))];
    const variables = uniqueVars.map((key) => ({
      key,
      label: key,
      type: 'text' as const,
      defaultValue: '',
      required: true,
    }));

    await createDocumentTemplateWithPolicy({
      companyId,
      name: newName.trim(),
      category: newCategory,
      content: newContent,
      variables,
      createdBy: currentUserId,
    });

    setCreating(false);
    setNewName('');
    setNewContent('');
    fetchTemplates();
  }, [companyId, currentUserId, newName, newCategory, newContent, fetchTemplates]);

  // Delete template
  const handleDelete = useCallback(
    async (id: string) => {
      await deleteDocumentTemplateWithPolicy(id);
      if (selectedTemplate?.id === id) {
        setSelectedTemplate(null);
        setPreview(null);
      }
      fetchTemplates();
    },
    [selectedTemplate, fetchTemplates]
  );

  return (
    <section className={cn('flex flex-col h-full', className)}>
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b bg-muted/20">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <FileSignature className={cn("h-4 w-4", colors.text.muted)} />
          {t('templates.title')}
        </h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setCreating(!creating)}
          className="h-7 px-2 text-xs"
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          {t('templates.create')}
        </Button>
      </header>

      {/* Create form */}
      {creating && (
        <section className="px-4 py-3 border-b bg-muted/10 space-y-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={t('templates.namePlaceholder')}
            className="w-full text-sm border rounded px-2 py-1.5 bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          />

          <select
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value as TemplateCategory)}
            className="w-full text-sm border rounded px-2 py-1.5 bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {(Object.keys(CATEGORY_KEYS) as TemplateCategory[]).map((cat) => (
              <option key={cat} value={cat}>
                {categoryLabels[cat]}
              </option>
            ))}
          </select>

          <Textarea
            size="lg"
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            placeholder={t('templates.contentPlaceholder')}
            className="font-mono"
          />

          <nav className="flex gap-2 justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCreating(false)}
              className="h-7 text-xs"
            >
              {t('common.cancel')}
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={handleCreate}
              disabled={!newName.trim() || !newContent.trim()}
              className="h-7 text-xs"
            >
              {t('templates.save')}
            </Button>
          </nav>
        </section>
      )}

      <section className="flex flex-1 overflow-hidden">
        {/* Template list */}
        <nav className="w-48 border-r overflow-y-auto">
          {loading ? (
            <p className="text-center py-8">
              <Spinner size="small" className="inline" />
            </p>
          ) : templates.length === 0 ? (
            <p className={cn("text-xs text-center py-8 px-2", colors.text.muted)}>
              {t('templates.empty')}
            </p>
          ) : (
            <ul className="p-1 space-y-0.5">
              {templates.map((tmpl) => {
                const Icon = CATEGORY_ICONS[tmpl.category] ?? FileText;
                return (
                  <li key={tmpl.id}>
                    <button
                      type="button"
                      onClick={() => handleSelectTemplate(tmpl)}
                      className={cn(
                        'w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-xs transition-colors',
                        selectedTemplate?.id === tmpl.id
                          ? 'bg-accent text-accent-foreground'
                          : 'hover:bg-accent/50'
                      )}
                    >
                      <Icon className={cn("h-3.5 w-3.5 flex-shrink-0", colors.text.muted)} />
                      <span className="truncate">{tmpl.name}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </nav>

        {/* Template detail / fill-in form */}
        <section className="flex-1 overflow-y-auto p-4">
          {!selectedTemplate ? (
            <p className={cn("text-sm text-center py-8", colors.text.muted)}>
              {t('templates.selectTemplate')}
            </p>
          ) : (
            <article className="space-y-4">
              {/* Template header */}
              <header className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">{selectedTemplate.name}</h3>
                <nav className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(selectedTemplate.id)}
                    disabled={selectedTemplate.isSystem}
                    className="h-6 px-2 text-xs text-destructive"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </nav>
              </header>

              {/* Variables */}
              {selectedTemplate.variables.length > 0 && (
                <fieldset className="space-y-2">
                  <legend className={cn("text-xs font-medium mb-1", colors.text.muted)}>
                    {t('templates.variables')}
                  </legend>
                  {selectedTemplate.variables.map((v) => (
                    <label key={v.key} className="flex flex-col gap-0.5">
                      <span className={cn("text-xs", colors.text.muted)}>
                        {v.label}
                        {v.required && <span className="text-destructive ml-0.5">*</span>}
                      </span>
                      <input
                        type={v.type === 'date' ? 'date' : v.type === 'number' ? 'number' : 'text'}
                        value={variableValues[v.key] ?? ''}
                        onChange={(e) =>
                          setVariableValues((prev) => ({
                            ...prev,
                            [v.key]: e.target.value,
                          }))
                        }
                        className="text-sm border rounded px-2 py-1 bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                    </label>
                  ))}
                </fieldset>
              )}

              {/* Actions */}
              <nav className="flex gap-2">
                <Button
                  variant="default"
                  size="sm"
                  onClick={handlePreview}
                  className="text-xs"
                >
                  <Eye className="h-3.5 w-3.5 mr-1" />
                  {t('templates.preview')}
                </Button>
                {preview && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopy}
                    className="text-xs"
                  >
                    <Copy className="h-3.5 w-3.5 mr-1" />
                    {t('templates.copy')}
                  </Button>
                )}
              </nav>

              {/* Preview */}
              {preview && (
                <article
                  className="border rounded-md p-4 bg-white text-black prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: preview }}
                />
              )}
            </article>
          )}
        </section>
      </section>
    </section>
  );
}
