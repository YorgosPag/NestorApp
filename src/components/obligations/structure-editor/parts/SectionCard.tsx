"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTranslation } from '@/i18n';
import { GripVertical, ChevronRight, ChevronDown, FileText, Plus, Save, X, Copy, Trash2 } from 'lucide-react';
import { RichTextEditor } from '@/components/obligations/rich-text-editor';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { ObligationSection, SectionCategory } from '@/types/obligations';
import { categoryLabels } from '../config/categoryLabels';
import { ArticleItem } from './ArticleItem';
import type { useStructureEditorState } from '../hooks/useStructureEditorState';

type Handlers = ReturnType<typeof useStructureEditorState>['handlers'];

interface SectionCardProps {
  section: ObligationSection;
  index: number;
  isExpanded: boolean;
  isEditing: boolean;
  isActive: boolean;
  readOnly: boolean;
  dragState: ReturnType<typeof useStructureEditorState>['state']['dragState'];
  handlers: Handlers;
  activeItemId?: string;
  expandedItems: string[];
  editingItem: string | null;
}

export function SectionCard({
  section,
  index,
  isExpanded,
  isEditing,
  isActive,
  readOnly,
  dragState,
  handlers,
  activeItemId,
  expandedItems,
  editingItem,
}: SectionCardProps) {
  const iconSizes = useIconSizes();
  const { t } = useTranslation('obligations');
  const hasArticles = section.articles && section.articles.length > 0;

  return (
    <Card
      id={`section-${section.id}`}
      draggable={!readOnly}
      onDragStart={(e) => handlers.handleDragStart(e, 'section', section.id, index)}
      onDragOver={handlers.handleDragOver}
      onDrop={(e) => handlers.handleDrop(e, 'section', index)}
      className={cn(
        "group relative",
        isActive && "ring-2 ring-primary",
        dragState?.dragId === section.id && "opacity-50"
      )}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          {!readOnly && <GripVertical className={`${iconSizes.sm} text-muted-foreground cursor-move opacity-0 group-hover:opacity-100`} />}
          {(hasArticles || section.content) && (
            <Button variant="ghost" size="sm" onClick={() => handlers.toggleExpanded(section.id)} className={`${iconSizes.md} p-0`}>
              {isExpanded ? <ChevronDown className={iconSizes.sm} /> : <ChevronRight className={iconSizes.sm} />}
            </Button>
          )}
          <FileText className={`${iconSizes.sm} text-primary`} />
          <Badge variant="outline">{section.number}</Badge>
          <div className="flex-1">
            {isEditing ? (
              <div className="space-y-3">
                <Input
                  value={section.title}
                  onChange={(e) => handlers.updateSection(section.id, { title: e.target.value })}
                  placeholder={t('section.titlePlaceholder')}
                  className="font-semibold"
                />
                <Select
                  value={section.category}
                  onValueChange={(value: SectionCategory) => handlers.updateSection(section.id, { category: value })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(categoryLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex items-center gap-2">
                  <input type="checkbox" checked={section.isRequired} onChange={(e) => handlers.updateSection(section.id, { isRequired: e.target.checked })} className="rounded" />
                  <Label className="text-sm">{t('section.requiredSection')}</Label>
                </div>
              </div>
            ) : (
              <div className="cursor-pointer" onClick={() => handlers.startEditing('section', section.id)}>
                <CardTitle className="text-base">{section.title || <span className="text-muted-foreground italic">{t('section.noTitle')}</span>}</CardTitle>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="secondary" className="text-xs">{categoryLabels[section.category]}</Badge>
                  {section.isRequired && <Badge variant="destructive" className="text-xs">{t('section.required')}</Badge>}
                </div>
              </div>
            )}
          </div>
          {!readOnly && (
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
              {isEditing ? (
                <>
                  <Button size="sm" onClick={handlers.stopEditing}><Save className={iconSizes.sm} /></Button>
                  <Button size="sm" variant="outline" onClick={handlers.stopEditing}><X className={iconSizes.sm} /></Button>
                </>
              ) : (
                <>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="sm" onClick={() => handlers.addArticle(section.id)} className="h-8 px-2"><Plus className={iconSizes.sm} /></Button>
                    </TooltipTrigger>
                    <TooltipContent>{t('section.addArticle')}</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="sm" onClick={() => handlers.duplicateSection(section.id)} className="h-8 px-2"><Copy className={iconSizes.sm} /></Button>
                    </TooltipTrigger>
                    <TooltipContent>{t('section.duplicateSection')}</TooltipContent>
                  </Tooltip>
                  <Button variant="ghost" size="sm" onClick={() => handlers.deleteSection(section.id)} className="h-8 px-2 text-destructive hover:text-destructive/80"><Trash2 className={iconSizes.sm} /></Button>
                </>
              )}
            </div>
          )}
        </div>
      </CardHeader>
      {isExpanded && (
        <CardContent className="pt-0">
          {isEditing && (
            <div className="mb-4">
              <Label className="text-sm">{t('section.contentLabel')}</Label>
              <RichTextEditor
                value={section.content}
                onChange={(content) => handlers.updateSection(section.id, { content })}
                placeholder={t('section.contentPlaceholder')}
                minHeight={120}
              />
            </div>
          )}
          {!isEditing && section.content && (
            <div className="mb-4 p-3 bg-muted/30 rounded-md">
              <div className="prose prose-sm max-w-none text-sm">{section.content}</div>
            </div>
          )}
          {hasArticles && (
            <div className="space-y-2">
              {(section.articles || []).map((article, aIndex) => (
                <ArticleItem
                  key={article.id}
                  article={article}
                  index={aIndex}
                  sectionId={section.id}
                  isExpanded={expandedItems.includes(article.id)}
                  isEditing={editingItem === article.id}
                  isActive={activeItemId === article.id}
                  readOnly={readOnly}
                  hasParagraphs={!!(article.paragraphs && article.paragraphs.length > 0)}
                  dragState={dragState}
                  handlers={handlers}
                  activeItemId={activeItemId}
                />
              ))}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
