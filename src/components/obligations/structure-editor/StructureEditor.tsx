"use client";

import React, { useCallback, useEffect, useRef } from 'react';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
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
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const sectionsCountRef = useRef(sections.length);

  const {
    state,
    handlers,
  } = useStructureEditorState({
    initialSections: sections,
    sections,
    onSectionsChange,
    readOnly,
    onActiveItemChange,
  });

  // Auto-scroll to new section when added
  useEffect(() => {
    if (sections.length > sectionsCountRef.current) {
      // New section was added
      const newSectionIndex = sections.length - 1;
      const newSectionId = sections[newSectionIndex]?.id;

      if (newSectionId) {
        // Small delay to ensure DOM is updated
        setTimeout(() => {
          const sectionElement = document.getElementById(`section-${newSectionId}`);
          if (sectionElement) {
            sectionElement.scrollIntoView({
              behavior: 'smooth',
              block: 'center'
            });
          }
        }, 100);
      }
    }

    sectionsCountRef.current = sections.length;
  }, [sections.length]);

  // Auto-scroll when activeItem changes (for newly created items)
  useEffect(() => {
    if (activeItemId && state.editingItem === activeItemId) {
      // Small delay to ensure DOM is updated and editing started
      setTimeout(() => {
        const activeElement = document.getElementById(`section-${activeItemId}`);
        if (activeElement) {
          activeElement.scrollIntoView({
            behavior: 'smooth',
            block: 'center'
          });
        }
      }, 150);
    }
  }, [activeItemId, state.editingItem]);

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
      expandedItems={state.expandedItems}
      editingItem={state.editingItem}
    />
  ), [state.expandedItems, state.editingItem, activeItemId, readOnly, state.dragState, handlers]);

  return (
    <div className="space-y-4">
      <HeaderBar
        sectionsCount={sections.length}
        readOnly={readOnly}
        onAddSection={handlers.addSection}
      />
      <ScrollArea ref={scrollAreaRef} className="h-[600px]">
        <div className="space-y-4 pr-4">
          {sections.length > 0 ? (
            sections.map(renderSection)
          ) : (
            <EmptyState readOnly={readOnly} onAddSection={handlers.addSection} />
          )}
        </div>
        <ScrollBar orientation="vertical" />
      </ScrollArea>
    </div>
  );
}

