"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { CommonBadge } from '@/core/badges';
import { Textarea } from '@/components/ui/textarea';
import { GripVertical, Edit3, Save, X, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
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
  return (
    <div
      draggable={!readOnly}
      onDragStart={(e) => handlers.handleDragStart(e, 'paragraph', paragraph.id, index, articleId)}
      onDragOver={handlers.handleDragOver}
      onDrop={(e) => handlers.handleDrop(e, 'paragraph', index, articleId)}
      className={cn(
        "group flex items-start gap-3 p-3 border-l-2 border-gray-200 ml-8",
        isActive && "border-l-blue-500 bg-blue-50",
        dragState?.dragId === paragraph.id && "opacity-50"
      )}
    >
      {!readOnly && <GripVertical className="h-4 w-4 text-gray-400 cursor-move opacity-0 group-hover:opacity-100 mt-1" />}
      <CommonBadge
        status="company"
        customLabel={paragraph.number}
        variant="outline"
        size="sm"
        className="text-xs mt-1 min-w-6"
      />
      <div className="flex-1 space-y-2">
        {isEditing ? (
          <div className="space-y-3">
            <Textarea
              value={paragraph.content}
              onChange={(e) => handlers.updateParagraph(sectionId, articleId, paragraph.id, { content: e.target.value })}
              placeholder="Περιεχόμενο παραγράφου..."
              rows={3}
              className="text-sm"
            />
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={handlers.stopEditing}><Save className="h-3 w-3 mr-1" />Αποθήκευση</Button>
              <Button size="sm" variant="outline" onClick={handlers.stopEditing}><X className="h-3 w-3" /></Button>
            </div>
          </div>
        ) : (
          <div className="cursor-pointer text-sm text-gray-700 hover:text-gray-900" onClick={() => handlers.startEditing('paragraph', paragraph.id)}>
            {paragraph.content || <span className="text-gray-400 italic">Κλικ για προσθήκη περιεχομένου...</span>}
          </div>
        )}
      </div>
      {!readOnly && !isEditing && (
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
          <Button variant="ghost" size="sm" onClick={() => handlers.startEditing('paragraph', paragraph.id)} className="h-7 px-2"><Edit3 className="h-3 w-3" /></Button>
          <Button variant="ghost" size="sm" onClick={() => handlers.deleteParagraph(sectionId, articleId, paragraph.id)} className="h-7 px-2 text-red-600 hover:text-red-700"><Trash2 className="h-3 w-3" /></Button>
        </div>
      )}
    </div>
  );
}
