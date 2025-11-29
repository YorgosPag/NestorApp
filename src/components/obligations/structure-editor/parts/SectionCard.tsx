"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CommonBadge } from '@/core/badges';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { GripVertical, ChevronRight, ChevronDown, FileText, Plus, Edit3, Save, X, Copy, Trash2 } from 'lucide-react';
import { RichTextEditor } from '@/components/obligations/rich-text-editor';
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
}: SectionCardProps) {
  const hasArticles = section.articles && section.articles.length > 0;

  return (
    <Card
      draggable={!readOnly}
      onDragStart={(e) => handlers.handleDragStart(e, 'section', section.id, index)}
      onDragOver={handlers.handleDragOver}
      onDrop={(e) => handlers.handleDrop(e, 'section', index)}
      className={cn(
        "group relative",
        isActive && "ring-2 ring-blue-500",
        dragState?.dragId === section.id && "opacity-50"
      )}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          {!readOnly && <GripVertical className="h-4 w-4 text-gray-400 cursor-move opacity-0 group-hover:opacity-100" />}
          {(hasArticles || section.content) && (
            <Button variant="ghost" size="sm" onClick={() => handlers.toggleExpanded(section.id)} className="h-6 w-6 p-0">
              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </Button>
          )}
          <FileText className="h-4 w-4 text-blue-600" />
          <CommonBadge
            status="company"
            customLabel={section.number}
            variant="outline"
            size="sm"
          />
          <div className="flex-1">
            {isEditing ? (
              <div className="space-y-3">
                <Input
                  value={section.title}
                  onChange={(e) => handlers.updateSection(section.id, { title: e.target.value })}
                  placeholder="Τίτλος ενότητας..."
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
                  <Label className="text-sm">Απαραίτητη ενότητα</Label>
                </div>
              </div>
            ) : (
              <div className="cursor-pointer" onClick={() => handlers.startEditing('section', section.id)}>
                <CardTitle className="text-base">{section.title || <span className="text-gray-400 italic">Χωρίς τίτλο</span>}</CardTitle>
                <div className="flex items-center gap-2 mt-1">
                  <CommonBadge
                    status="company"
                    customLabel={categoryLabels[section.category]}
                    variant="secondary"
                    size="sm"
                    className="text-xs"
                  />
                  {section.isRequired && (
                    <CommonBadge
                      status="company"
                      customLabel="Απαραίτητο"
                      variant="destructive"
                      size="sm"
                      className="text-xs"
                    />
                  )}
                </div>
              </div>
            )}
          </div>
          {!readOnly && (
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
              {isEditing ? (
                <>
                  <Button size="sm" onClick={handlers.stopEditing}><Save className="h-4 w-4" /></Button>
                  <Button size="sm" variant="outline" onClick={handlers.stopEditing}><X className="h-4 w-4" /></Button>
                </>
              ) : (
                <>
                  <Button variant="ghost" size="sm" onClick={() => handlers.addArticle(section.id)} className="h-8 px-2" title="Προσθήκη άρθρου"><Plus className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="sm" onClick={() => handlers.duplicateSection(section.id)} className="h-8 px-2" title="Αντιγραφή ενότητας"><Copy className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="sm" onClick={() => handlers.deleteSection(section.id)} className="h-8 px-2 text-red-600 hover:text-red-700"><Trash2 className="h-4 w-4" /></Button>
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
              <Label className="text-sm">Περιεχόμενο Ενότητας</Label>
              <RichTextEditor
                value={section.content}
                onChange={(content) => handlers.updateSection(section.id, { content })}
                placeholder="Περιεχόμενο της ενότητας..."
                minHeight={120}
              />
            </div>
          )}
          {!isEditing && section.content && (
            <div className="mb-4 p-3 bg-gray-50 rounded-md">
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
                  hasParagraphs={article.paragraphs && article.paragraphs.length > 0}
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
