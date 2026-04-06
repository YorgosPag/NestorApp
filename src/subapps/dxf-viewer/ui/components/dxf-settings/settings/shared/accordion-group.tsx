/**
 * Accordion Group & Hooks
 *
 * Multi-accordion state management and roving tabindex support.
 * Extracted from AccordionSection.tsx for SRP compliance (ADR-065 Phase 4).
 *
 * @module dxf-settings/shared/accordion-group
 */

'use client';

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { PANEL_LAYOUT } from '../../../../../config/panel-tokens';

// ============================================================================
// useAccordion HOOK
// ============================================================================

export interface UseAccordionOptions {
  defaultOpenSection?: string;
  multiple?: boolean;
}

export function useAccordion(
  defaultOpenSection?: string | UseAccordionOptions
) {
  const options: UseAccordionOptions = typeof defaultOpenSection === 'string'
    ? { defaultOpenSection }
    : defaultOpenSection || {};

  const { defaultOpenSection: initialSection, multiple = false } = options;

  const [openSections, setOpenSections] = useState<Set<string>>(
    new Set(initialSection ? [initialSection] : [])
  );

  const toggleSection = useCallback((sectionId: string) => {
    setOpenSections(current => {
      const newSet = new Set(current);
      if (newSet.has(sectionId)) {
        newSet.delete(sectionId);
      } else {
        if (!multiple) {
          newSet.clear();
        }
        newSet.add(sectionId);
      }
      return newSet;
    });
  }, [multiple]);

  const isOpen = useCallback((sectionId: string) => {
    return openSections.has(sectionId);
  }, [openSections]);

  const openSection = useCallback((sectionId: string) => {
    setOpenSections(current => {
      const newSet = multiple ? new Set(current) : new Set<string>();
      newSet.add(sectionId);
      return newSet;
    });
  }, [multiple]);

  const closeSection = useCallback((sectionId: string) => {
    setOpenSections(current => {
      const newSet = new Set(current);
      newSet.delete(sectionId);
      return newSet;
    });
  }, []);

  const closeAll = useCallback(() => {
    setOpenSections(new Set());
  }, []);

  return {
    openSections: Array.from(openSections),
    toggleSection,
    isOpen,
    openSection,
    closeSection,
    closeAll,
    /** @deprecated Use openSections array instead */
    legacyOpenSection: openSections.size > 0 ? Array.from(openSections)[0] : null,
    /** @deprecated Use toggleSection instead */
    setOpenSection: (sectionId: string | null) => {
      setOpenSections(sectionId ? new Set([sectionId]) : new Set());
    }
  };
}

// ============================================================================
// ACCORDION GROUP CONTEXT (Roving Tabindex)
// ============================================================================

interface AccordionGroupContextValue {
  registerAccordion: (id: string, ref: React.RefObject<HTMLButtonElement>) => void;
  unregisterAccordion: (id: string) => void;
  focusedId: string | null;
  setFocusedId: (id: string) => void;
  handleKeyNavigation: (id: string, e: React.KeyboardEvent) => void;
}

const AccordionGroupContext = React.createContext<AccordionGroupContextValue | null>(null);

export function useAccordionGroup() {
  return React.useContext(AccordionGroupContext);
}

export interface AccordionGroupProps {
  children: React.ReactNode;
  className?: string;
  autoFocus?: boolean;
}

export function AccordionGroup({ children, className = '', autoFocus = false }: AccordionGroupProps) {
  const [accordions, setAccordions] = useState<Map<string, React.RefObject<HTMLButtonElement>>>(new Map());
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const accordionIds = useMemo(() => Array.from(accordions.keys()), [accordions]);

  const registerAccordion = useCallback((id: string, ref: React.RefObject<HTMLButtonElement>) => {
    setAccordions(prev => new Map(prev).set(id, ref));
  }, []);

  const unregisterAccordion = useCallback((id: string) => {
    setAccordions(prev => {
      const newMap = new Map(prev);
      newMap.delete(id);
      return newMap;
    });
  }, []);

  useEffect(() => {
    if (autoFocus && accordionIds.length > 0 && !focusedId) {
      const firstId = accordionIds[0];
      setFocusedId(firstId);
      accordions.get(firstId)?.current?.focus();
    }
  }, [autoFocus, accordionIds, focusedId, accordions]);

  const handleKeyNavigation = useCallback((currentId: string, e: React.KeyboardEvent) => {
    const currentIndex = accordionIds.indexOf(currentId);
    if (currentIndex === -1) return;

    let targetIndex: number | null = null;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        targetIndex = currentIndex < accordionIds.length - 1 ? currentIndex + 1 : currentIndex;
        break;
      case 'ArrowUp':
        e.preventDefault();
        targetIndex = currentIndex > 0 ? currentIndex - 1 : currentIndex;
        break;
      case 'Home':
        e.preventDefault();
        targetIndex = 0;
        break;
      case 'End':
        e.preventDefault();
        targetIndex = accordionIds.length - 1;
        break;
    }

    if (targetIndex !== null && targetIndex !== currentIndex) {
      const targetId = accordionIds[targetIndex];
      setFocusedId(targetId);
      accordions.get(targetId)?.current?.focus();
    }
  }, [accordionIds, accordions]);

  const contextValue = useMemo<AccordionGroupContextValue>(() => ({
    registerAccordion,
    unregisterAccordion,
    focusedId,
    setFocusedId,
    handleKeyNavigation
  }), [registerAccordion, unregisterAccordion, focusedId, handleKeyNavigation]);

  return (
    <AccordionGroupContext.Provider value={contextValue}>
      <div className={`${PANEL_LAYOUT.SPACING.GAP_SM} ${className}`} role="group">
        {children}
      </div>
    </AccordionGroupContext.Provider>
  );
}
