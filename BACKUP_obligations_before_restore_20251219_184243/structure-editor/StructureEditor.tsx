"use client";

import React, { useCallback } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useStructureEditorState } from './hooks/useStructureEditorState';
import { HeaderBar } from './parts/HeaderBar';
import { SectionCard } from './parts/SectionCard';
import { EmptyState } from './parts/EmptyState';
import type { StructureEditorProps } from './types';
import type { ObligationSection } from '@/types/obligations';

export default function StructureEditor({
  sections,
  onSectionsChange,
  onActiveItemChange,
  activeItemId,
  readOnly = false
}: StructureEditorProps) {
  const {
    state,
    handlers,
  } = useStructureEditorState({
    initialSections: sections,
    onSectionsChange,
    readOnly,
    onActiveItemChange,
  });

  const renderSection = useCallback((section: ObligationSection, index: number) => (
    <SectionCard
      key={section.id}
      section={section}
      index={index}
      isExpanded={state.expandedItems.includes(section.id)}
      isEditing={state.editingItem === section.id}
      isActive={activeItemId === section.id}
      readOnly={readOnly}
      dragState={state.dragState}
      handlers={handlers}
      activeItemId={activeItemId}
    />
  ), [state.expandedItems, state.editingItem, activeItemId, readOnly, state.dragState, handlers]);

  return (
    <div className="space-y-4">
      <HeaderBar
        sectionsCount={sections.length}
        readOnly={readOnly}
        onAddSection={handlers.addSection}
      />
      <ScrollArea className="max-h-[600px]">
        <div className="space-y-4">
          {sections.length > 0 ? (
            sections.map(renderSection)
          ) : (
            <EmptyState readOnly={readOnly} onAddSection={handlers.addSection} />
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
