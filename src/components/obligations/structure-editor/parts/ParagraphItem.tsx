// 🌐 i18n: All labels converted to i18n keys - 2026-01-19
"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RichTextEditor } from '@/components/obligations/rich-text-editor';
import { useIconSizes } from '@/hooks/useIconSizes';
import { GripVertical, Edit3, Save, X, Trash2 } from 'lucide-react';
import { cn } from '@/lib/design-system';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n';
import type { ObligationParagraph } from '@/types/obligations';
import type { useStructureEditorState } from '../hooks/useStructureEditorState';

type Handlers = ReturnType<typeof useStructureEditorState>['handlers'];

interface ParagraphItemProps {
  paragraph: ObligationParagraph;
  index: number;
  sectionId: string;
  articleId: string;
  isEditing: boolean;
  isActive: boolean;
  readOnly: boolean;
  dragState: ReturnType<typeof useStructureEditorState>['state']['dragState'];
  handlers: Handlers;
}

export function ParagraphItem({
  paragraph,
  index,
  sectionId,
  articleId,
  isEditing,
  isActive,
  readOnly,
  dragState,
  handlers,
}: ParagraphItemProps) {
  const { t } = useTranslation('obligations');
  const { t: tCommon } = useTranslation('common');
  const iconSizes = useIconSizes();

  return (
    <div
      draggable={!readOnly}
      onDragStart={(e) => handlers.handleDragStart(e, 'paragraph', paragraph.id, index, articleId)}
      onDragOver={handlers.handleDragOver}
      onDrop={(e) => handlers.handleDrop(e, 'paragraph', index, articleId)}
      className={cn(
        "group flex items-start gap-3 p-3 border-l-2 border-muted ml-8",
        isActive && "border-l-primary bg-primary/10",
        dragState?.dragId === paragraph.id && "opacity-50"
      )}
    >
      {!readOnly && <GripVertical className={`${iconSizes.sm} text-muted-foreground cursor-move opacity-0 group-hover:opacity-100 mt-1`} />}
      <Badge variant="outline" className="text-xs mt-1 min-w-6">{paragraph.number}</Badge>
      <div className="flex-1 space-y-2">
        {isEditing ? (
          <div className="space-y-3">
            <RichTextEditor
              value={paragraph.content}
              onChange={(content) => handlers.updateParagraph(sectionId, articleId, paragraph.id, { content })}
              placeholder={t('paragraph.contentPlaceholder')}
              minHeight={80}
              showStats={false}
            />
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={handlers.stopEditing}><Save className={`${iconSizes.xs} mr-1`} />{tCommon('buttons.save')}</Button>
              <Button size="sm" variant="outline" onClick={handlers.stopEditing}><X className={iconSizes.xs} /></Button>
            </div>
          </div>
        ) : (
          <div className="cursor-pointer text-sm text-foreground hover:text-foreground/80" onClick={() => handlers.startEditing('paragraph', paragraph.id)}>
            {paragraph.content || <span className="text-muted-foreground italic">{t('paragraph.noContent')}</span>}
          </div>
        )}
      </div>
      {!readOnly && !isEditing && (
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
          <Button variant="ghost" size="sm" onClick={() => handlers.startEditing('paragraph', paragraph.id)} className="h-7 px-2"><Edit3 className={iconSizes.xs} /></Button>
          <Button variant="ghost" size="sm" onClick={() => handlers.deleteParagraph(sectionId, articleId, paragraph.id)} className="h-7 px-2 text-destructive hover:text-destructive/80"><Trash2 className={iconSizes.xs} /></Button>
        </div>
      )}
    </div>
  );
}


