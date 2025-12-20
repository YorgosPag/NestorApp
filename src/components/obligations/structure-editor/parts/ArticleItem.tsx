"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { GripVertical, ChevronRight, ChevronDown, Hash, Plus, Edit3, Save, X, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ObligationArticle } from '@/types/obligations';
import { ParagraphItem } from './ParagraphItem';
import type { useStructureEditorState } from '../hooks/useStructureEditorState';

type Handlers = ReturnType<typeof useStructureEditorState>['handlers'];

interface ArticleItemProps {
  article: ObligationArticle;
  index: number;
  sectionId: string;
  isExpanded: boolean;
  isEditing: boolean;
  isActive: boolean;
  readOnly: boolean;
  hasParagraphs: boolean;
  dragState: ReturnType<typeof useStructureEditorState>['state']['dragState'];
  handlers: Handlers;
  activeItemId?: string;
}

export function ArticleItem({
  article,
  index,
  sectionId,
  isExpanded,
  isEditing,
  isActive,
  readOnly,
  hasParagraphs,
  dragState,
  handlers,
  activeItemId,
}: ArticleItemProps) {
  return (
    <div
      draggable={!readOnly}
      onDragStart={(e) => handlers.handleDragStart(e, 'article', article.id, index, sectionId)}
      onDragOver={handlers.handleDragOver}
      onDrop={(e) => handlers.handleDrop(e, 'article', index, sectionId)}
      className={cn(
        "group border-l-2 border-accent ml-6",
        isActive && "border-l-primary bg-accent/20",
        dragState?.dragId === article.id && "opacity-50"
      )}
    >
      <div className="flex items-center gap-2 p-3">
        {!readOnly && <GripVertical className="h-4 w-4 text-muted-foreground cursor-move opacity-0 group-hover:opacity-100" />}
        {hasParagraphs && (
          <Button variant="ghost" size="sm" onClick={() => handlers.toggleExpanded(article.id)} className="h-6 w-6 p-0">
            {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          </Button>
        )}
        <Hash className="h-4 w-4 text-accent-foreground" />
        <Badge variant="secondary" className="text-xs">{article.number}</Badge>
        <div className="flex-1">
          {isEditing ? (
            <div className="space-y-2">
              <Input
                value={article.title}
                onChange={(e) => handlers.updateArticle(sectionId, article.id, { title: e.target.value })}
                placeholder="Τίτλος άρθρου..."
                className="text-sm font-medium"
              />
              <Textarea
                value={article.content}
                onChange={(e) => handlers.updateArticle(sectionId, article.id, { content: e.target.value })}
                placeholder="Περιεχόμενο άρθρου..."
                rows={2}
                className="text-sm"
              />
            </div>
          ) : (
            <div className="cursor-pointer" onClick={() => handlers.startEditing('article', article.id)}>
              <div className="font-medium text-sm">{article.title || <span className="text-muted-foreground italic">Χωρίς τίτλο</span>}</div>
              {article.content && <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{article.content}</div>}
            </div>
          )}
        </div>
        {!readOnly && (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
            {isEditing ? (
              <>
                <Button size="sm" onClick={handlers.stopEditing}><Save className="h-3 w-3" /></Button>
                <Button size="sm" variant="outline" onClick={handlers.stopEditing}><X className="h-3 w-3" /></Button>
              </>
            ) : (
              <>
                <Button variant="ghost" size="sm" onClick={() => handlers.addParagraph(sectionId, article.id)} className="h-7 px-2" title="Προσθήκη παραγράφου"><Plus className="h-3 w-3" /></Button>
                <Button variant="ghost" size="sm" onClick={() => handlers.deleteArticle(sectionId, article.id)} className="h-7 px-2 text-destructive hover:text-destructive/80"><Trash2 className="h-3 w-3" /></Button>
              </>
            )}
          </div>
        )}
      </div>
      {hasParagraphs && isExpanded && (
        <div className="space-y-1">
          {(article.paragraphs || []).map((paragraph, pIndex) => (
            <ParagraphItem
              key={paragraph.id}
              paragraph={paragraph}
              index={pIndex}
              sectionId={sectionId}
              articleId={article.id}
              isEditing={editingItem === paragraph.id}
              isActive={activeItemId === paragraph.id}
              readOnly={readOnly}
              dragState={dragState}
              handlers={handlers}
            />
          ))}
        </div>
      )}
    </div>
  );
}
