"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { RichTextEditor } from '@/components/obligations/rich-text-editor';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTranslation } from '@/i18n';
import { GripVertical, ChevronRight, ChevronDown, Hash, Plus, Save, X, Trash2 } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/design-system';
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
  const iconSizes = useIconSizes();
  const { t } = useTranslation('obligations');

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
        {!readOnly && <GripVertical className={`${iconSizes.sm} text-muted-foreground cursor-move opacity-0 group-hover:opacity-100`} />}
        {hasParagraphs && (
          <Button variant="ghost" size="sm" onClick={() => handlers.toggleExpanded(article.id)} className={`${iconSizes.md} p-0`} aria-label={isExpanded ? t('aria.collapseParagraphs') : t('aria.expandParagraphs')}>
            {isExpanded ? <ChevronDown className={iconSizes.xs} /> : <ChevronRight className={iconSizes.xs} />}
          </Button>
        )}
        <Hash className={`${iconSizes.sm} text-accent-foreground`} />
        <Badge variant="secondary" className="text-xs">{article.number}</Badge>
        <div className="flex-1">
          {isEditing ? (
            <div className="space-y-2">
              <Input
                value={article.title}
                onChange={(e) => handlers.updateArticle(sectionId, article.id, { title: e.target.value })}
                placeholder={t('article.titlePlaceholder')}
                className="text-sm font-medium"
              />
              <RichTextEditor
                value={article.content}
                onChange={(content) => handlers.updateArticle(sectionId, article.id, { content })}
                placeholder={t('article.contentPlaceholder')}
                minHeight={80}
                showStats={false}
              />
            </div>
          ) : (
            <div className="cursor-pointer" onClick={() => handlers.startEditing('article', article.id)}>
              <div className="font-medium text-sm">{article.title || <span className="text-muted-foreground italic">{t('article.noTitle')}</span>}</div>
              {article.content && <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{article.content}</div>}
            </div>
          )}
        </div>
        {!readOnly && (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
            {isEditing ? (
              <>
                <Button size="sm" onClick={handlers.stopEditing} aria-label={t('aria.saveArticle')}><Save className={iconSizes.xs} /></Button>
                <Button size="sm" variant="outline" onClick={handlers.stopEditing} aria-label={t('aria.cancelEditing')}><X className={iconSizes.xs} /></Button>
              </>
            ) : (
              <>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="sm" onClick={() => handlers.addParagraph(sectionId, article.id)} className="h-7 px-2" aria-label={t('article.addParagraph')}><Plus className={iconSizes.xs} /></Button>
                  </TooltipTrigger>
                  <TooltipContent>{t('article.addParagraph')}</TooltipContent>
                </Tooltip>
                <Button variant="ghost" size="sm" onClick={() => handlers.deleteArticle(sectionId, article.id)} className="h-7 px-2 text-destructive hover:text-destructive/80" aria-label={t('aria.deleteArticle')}><Trash2 className={iconSizes.xs} /></Button>
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
              isEditing={activeItemId === paragraph.id && isEditing}
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


