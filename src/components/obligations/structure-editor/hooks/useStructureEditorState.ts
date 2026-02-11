"use client";

import { useState, useCallback } from 'react';
import type { ObligationSection, ObligationArticle, ObligationParagraph } from '@/types/obligations';
import { createNewSection, createNewArticle, createNewParagraph, renumberSections, renumberArticles } from '@/types/obligations';
import type { DragState, DragKind } from '../dnd/dnd-types';
import { generateTempId } from '@/services/enterprise-id.service';

interface UseStructureEditorStateProps {
  initialSections: ObligationSection[];
  sections: ObligationSection[]; // Add current sections prop
  onSectionsChange: (sections: ObligationSection[]) => void;
  onActiveItemChange?: (item: { type: 'section' | 'article' | 'paragraph'; id: string } | null) => void;
  readOnly?: boolean;
}

export function useStructureEditorState({
  sections,
  onSectionsChange,
  onActiveItemChange,
  readOnly,
}: UseStructureEditorStateProps) {
  const [expandedItems, setExpandedItems] = useState<string[]>([]);
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);

  const toggleExpanded = useCallback((id: string) => {
    setExpandedItems(prev =>
      prev.includes(id)
        ? prev.filter(item => item !== id)
        : [...prev, id]
    );
  }, []);

  const startEditing = useCallback((type: 'section' | 'article' | 'paragraph', id: string) => {
    if (readOnly) return;
    setEditingItem(id);
    onActiveItemChange?.({ type, id });
  }, [readOnly, onActiveItemChange]);

  const stopEditing = useCallback(() => {
    setEditingItem(null);
  }, []);

  // Section Handlers
  const addSection = useCallback(() => {
    if (readOnly) return;
    const newSection = createNewSection(sections.length);
    const newSections = [...sections, newSection];
    onSectionsChange(renumberSections(newSections));
    setExpandedItems(prev => [...prev, newSection.id]);
    startEditing('section', newSection.id);
  }, [readOnly, sections, onSectionsChange, startEditing]);

  const updateSection = useCallback((sectionId: string, updates: Partial<ObligationSection>) => {
    if (readOnly) return;
    const newSections = sections.map(s => s.id === sectionId ? { ...s, ...updates } : s);
    onSectionsChange(newSections);
  }, [readOnly, sections, onSectionsChange]);

  const deleteSection = useCallback((sectionId: string) => {
    if (readOnly) return;
    const newSections = sections.filter(s => s.id !== sectionId);
    onSectionsChange(renumberSections(newSections));
    if (editingItem === sectionId) stopEditing();
  }, [readOnly, sections, onSectionsChange, editingItem, stopEditing]);

  // 🏢 ENTERPRISE: Using centralized ID generation (crypto-secure)
  const duplicateSection = useCallback((sectionId: string) => {
    if (readOnly) return;
    const sectionToDuplicate = sections.find(s => s.id === sectionId);
    if (!sectionToDuplicate) return;
    const newId = () => generateTempId(); // Crypto-secure IDs

    const duplicatedSection: ObligationSection = {
      ...sectionToDuplicate,
      id: newId(),
      title: `${sectionToDuplicate.title} (Αντίγραφο)`,
      order: sections.length,
      articles: (sectionToDuplicate.articles || []).map(article => {
        const newArticleId = newId();
        return {
          ...article,
          id: newArticleId,
          sectionId: duplicatedSection.id,
          paragraphs: (article.paragraphs || []).map(p => ({ ...p, id: newId(), articleId: newArticleId })),
        };
      }),
    };
    const newSections = [...sections, duplicatedSection];
    onSectionsChange(renumberSections(newSections));
  }, [readOnly, sections, onSectionsChange]);

  // Article Handlers
  const addArticle = useCallback((sectionId: string) => {
    if (readOnly) return;
    const section = sections.find(s => s.id === sectionId);
    if (!section) return;
    const newArticle = createNewArticle(sectionId, section.articles?.length || 0);
    updateSection(sectionId, { articles: [...(section.articles || []), newArticle], isExpanded: true });
    setExpandedItems(prev => [...prev, sectionId, newArticle.id]);
    startEditing('article', newArticle.id);
  }, [readOnly, sections, updateSection, startEditing]);
  
  const updateArticle = useCallback((sectionId: string, articleId: string, updates: Partial<ObligationArticle>) => {
      if (readOnly) return;
      updateSection(sectionId, {
          articles: sections.find(s => s.id === sectionId)?.articles?.map(a =>
              a.id === articleId ? { ...a, ...updates } : a
          )
      });
  }, [readOnly, sections, updateSection]);

  const deleteArticle = useCallback((sectionId: string, articleId: string) => {
      if (readOnly) return;
      updateSection(sectionId, {
          articles: sections.find(s => s.id === sectionId)?.articles?.filter(a => a.id !== articleId)
      });
      if (editingItem === articleId) stopEditing();
  }, [readOnly, sections, updateSection, editingItem, stopEditing]);
  
  // Paragraph Handlers
  const addParagraph = useCallback((sectionId: string, articleId: string) => {
    if (readOnly) return;
    const section = sections.find(s => s.id === sectionId);
    const article = section?.articles?.find(a => a.id === articleId);
    if (!article) return;
    const newParagraph = createNewParagraph(articleId, article.paragraphs?.length || 0);
    updateArticle(sectionId, articleId, { paragraphs: [...(article.paragraphs || []), newParagraph], isExpanded: true });
    setExpandedItems(prev => [...prev, sectionId, articleId]);
    startEditing('paragraph', newParagraph.id);
  }, [readOnly, sections, updateArticle, startEditing]);

  const updateParagraph = useCallback((sectionId: string, articleId: string, paragraphId: string, updates: Partial<ObligationParagraph>) => {
    if (readOnly) return;
    const section = sections.find(s => s.id === sectionId);
    updateArticle(sectionId, articleId, {
      paragraphs: section?.articles?.find(a => a.id === articleId)?.paragraphs?.map(p =>
        p.id === paragraphId ? { ...p, ...updates } : p
      )
    });
  }, [readOnly, sections, updateArticle]);

  const deleteParagraph = useCallback((sectionId: string, articleId: string, paragraphId: string) => {
    if (readOnly) return;
    const section = sections.find(s => s.id === sectionId);
    updateArticle(sectionId, articleId, {
      paragraphs: section?.articles?.find(a => a.id === articleId)?.paragraphs?.filter(p => p.id !== paragraphId)
    });
    if (editingItem === paragraphId) stopEditing();
  }, [readOnly, sections, updateArticle, editingItem, stopEditing]);

  // DND Handlers
  const handleDragStart = useCallback((e: React.DragEvent, type: DragKind, id: string, index: number, parentId?: string) => {
    if (readOnly) return;
    setDragState({ isDragging: true, dragType: type, dragId: id, dragIndex: index, parentId });
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
  }, [readOnly]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, targetType: DragKind, targetIndex: number, targetParentId?: string) => {
    e.preventDefault();
    if (readOnly || !dragState) return;
    const { dragType, dragIndex, parentId: dragParentId } = dragState;

    if (dragType === 'section' && targetType === 'section') {
      const newSections = [...sections];
      const [draggedSection] = newSections.splice(dragIndex, 1);
      newSections.splice(targetIndex, 0, draggedSection);
      onSectionsChange(renumberSections(newSections));
    } else if (dragType === 'article' && targetType === 'article' && dragParentId === targetParentId && dragParentId) {
      // 🏢 ENTERPRISE: Type guard already verified dragParentId is string via && dragParentId
      const parentId = dragParentId; // TypeScript knows this is string here
      const section = sections.find(s => s.id === parentId);
      if (!section || !section.articles) return;
      const newArticles = [...section.articles];
      const [draggedArticle] = newArticles.splice(dragIndex, 1);
      newArticles.splice(targetIndex, 0, draggedArticle);
      updateSection(parentId, { articles: renumberArticles(newArticles) });
    }
    setDragState(null);
  }, [readOnly, dragState, sections, onSectionsChange, updateSection]);

  return {
    state: {
      expandedItems,
      editingItem,
      dragState,
    },
    handlers: {
      toggleExpanded,
      startEditing,
      stopEditing,
      addSection,
      updateSection,
      deleteSection,
      duplicateSection,
      addArticle,
      updateArticle,
      deleteArticle,
      addParagraph,
      updateParagraph,
      deleteParagraph,
      handleDragStart,
      handleDragOver,
      handleDrop,
    },
  };
}
