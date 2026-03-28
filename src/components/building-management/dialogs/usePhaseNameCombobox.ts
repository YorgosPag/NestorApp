/**
 * usePhaseNameCombobox — Combobox logic for construction phase/task name selection
 *
 * Extracted from ConstructionPhaseDialog to comply with 500-line component limit.
 * Handles: filtered predefined options, keyboard navigation, custom text input.
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import {
  CONSTRUCTION_PHASES,
  getPredefinedTasksForPhase,
  findPhaseKeyByTranslatedName,
} from '@/config/construction-templates';
import type { ConstructionPhase } from '@/types/building/construction';

// ─── Types ──────────────────────────────────────────────────────────────

export interface ComboboxOption {
  key: string;
  code: string;
  label: string;
}

interface UsePhaseNameComboboxParams {
  isPhaseMode: boolean;
  selectedPhaseId: string;
  phases: ConstructionPhase[];
  t: (key: string) => string;
  setName: (name: string) => void;
  setCode: (code: string) => void;
}

// ─── Hook ───────────────────────────────────────────────────────────────

export function usePhaseNameCombobox({
  isPhaseMode,
  selectedPhaseId,
  phases,
  t,
  setName,
  setCode,
}: UsePhaseNameComboboxParams) {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const resultsRef = useRef<HTMLDivElement>(null);

  // ─── Filtered Predefined Options ────────────────────────────────────

  const filteredOptions = useMemo((): ComboboxOption[] => {
    const query = searchQuery.trim().toLowerCase();

    if (isPhaseMode) {
      const allPhases = CONSTRUCTION_PHASES.map((p) => ({
        key: p.key,
        code: p.code,
        label: t(`tabs.timeline.gantt.templates.phases.${p.key}`),
      }));
      if (!query) return allPhases;
      return allPhases.filter(
        (p) => p.label.toLowerCase().includes(query) || p.code.toLowerCase().includes(query),
      );
    }

    const selectedPhase = phases.find((p) => p.id === selectedPhaseId);
    const phaseKey = selectedPhase
      ? findPhaseKeyByTranslatedName(selectedPhase.name, t)
      : undefined;

    const taskSources = phaseKey
      ? getPredefinedTasksForPhase(phaseKey)
      : CONSTRUCTION_PHASES.flatMap((p) => p.tasks);

    const allTasks = taskSources.map((task) => {
      const parentPhase = CONSTRUCTION_PHASES.find((p) =>
        p.tasks.some((pt) => pt.key === task.key && pt.code === task.code),
      );
      const parentKey = parentPhase?.key ?? '';
      return {
        key: task.key,
        code: task.code,
        label: t(`tabs.timeline.gantt.templates.tasks.${parentKey}.${task.key}`),
      };
    });

    if (!query) return allTasks;
    return allTasks.filter(
      (task) => task.label.toLowerCase().includes(query) || task.code.toLowerCase().includes(query),
    );
  }, [isPhaseMode, searchQuery, selectedPhaseId, phases, t]);

  // ─── Select Predefined Option ───────────────────────────────────────

  const handleSelectPredefined = useCallback((option: ComboboxOption) => {
    setName(option.label);
    setCode(option.code);
    setPopoverOpen(false);
    setSearchQuery('');
    setHighlightedIndex(-1);
  }, [setName, setCode]);

  // ─── Use Custom Text ────────────────────────────────────────────────

  const handleUseCustomText = useCallback(() => {
    const trimmed = searchQuery.trim();
    if (trimmed) {
      setName(trimmed);
      setPopoverOpen(false);
      setSearchQuery('');
      setHighlightedIndex(-1);
    }
  }, [searchQuery, setName]);

  // ─── Keyboard Navigation ────────────────────────────────────────────

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const totalItems = filteredOptions.length + (searchQuery.trim() ? 1 : 0);
    if (totalItems === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => {
        const next = prev < totalItems - 1 ? prev + 1 : 0;
        setTimeout(() => {
          resultsRef.current?.querySelector(`[data-option-index="${next}"]`)
            ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }, 0);
        return next;
      });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => {
        const next = prev > 0 ? prev - 1 : totalItems - 1;
        setTimeout(() => {
          resultsRef.current?.querySelector(`[data-option-index="${next}"]`)
            ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }, 0);
        return next;
      });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
        handleSelectPredefined(filteredOptions[highlightedIndex]);
      } else if (searchQuery.trim()) {
        handleUseCustomText();
      }
    } else if (e.key === 'Escape') {
      setPopoverOpen(false);
    }
  }, [filteredOptions, highlightedIndex, searchQuery, handleSelectPredefined, handleUseCustomText]);

  // ─── Open Handler ───────────────────────────────────────────────────

  const handleOpen = useCallback((isOpen: boolean) => {
    setPopoverOpen(isOpen);
    if (isOpen) {
      setSearchQuery('');
      setHighlightedIndex(-1);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, []);

  // ─── Reset ──────────────────────────────────────────────────────────

  const reset = useCallback(() => {
    setPopoverOpen(false);
    setSearchQuery('');
    setHighlightedIndex(-1);
  }, []);

  return {
    popoverOpen,
    searchQuery,
    setSearchQuery,
    inputRef,
    highlightedIndex,
    setHighlightedIndex,
    resultsRef,
    filteredOptions,
    handleSelectPredefined,
    handleUseCustomText,
    handleKeyDown,
    handleOpen,
    reset,
  };
}
