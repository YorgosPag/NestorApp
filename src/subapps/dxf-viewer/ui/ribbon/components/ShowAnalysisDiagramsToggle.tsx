'use client';

/**
 * ADR-483 (T3-UI / Slice 4) — "Διαγράμματα Μ/V/N" ribbon toggle (View tab).
 *
 * One-click master switch για το canvas overlay διαγραμμάτων ροπής ανά δοκάρι
 * (Revit/Robot moment diagrams): ON → κάθε φέρον δοκάρι δείχνει το διάγραμμα
 * ροπών· OFF → κανονικό σχέδιο. Thin reader/writer του `showAnalysisDiagrams`
 * flag στο TRANSIENT `useAnalysisDiagramViewStore`, διαβασμένο από το
 * `StructuralDiagramOverlay`.
 *
 * ADR-599: toggle markup ενοποιήθηκε στο `<RibbonToggleWidget config>`.
 */

import React from 'react';
import { LineChart, Ban } from 'lucide-react';
import { useAnalysisDiagramViewStore } from '../../../state/analysis-diagram-view-store';
import { RibbonToggleWidget, type RibbonToggleConfig } from './RibbonToggleWidget';

const ANALYSIS_DIAGRAMS_TOGGLE: RibbonToggleConfig = {
  useToggleState: () => {
    const value = useAnalysisDiagramViewStore((s) => s.showAnalysisDiagrams);
    const set = useAnalysisDiagramViewStore((s) => s.setShowAnalysisDiagrams);
    return { value, toggle: () => set(!value) };
  },
  labelKey: 'ribbon.commands.analysisDiagrams.label',
  activeIcon: LineChart,
  inactiveIcon: Ban,
  activeLabelKey: 'ribbon.commands.analysisDiagrams.disable',
  inactiveLabelKey: 'ribbon.commands.analysisDiagrams.enable',
  activeTooltipKey: 'ribbon.commands.analysisDiagrams.tooltipDisable',
  inactiveTooltipKey: 'ribbon.commands.analysisDiagrams.tooltipEnable',
};

export const ShowAnalysisDiagramsToggle: React.FC = () => (
  <RibbonToggleWidget config={ANALYSIS_DIAGRAMS_TOGGLE} />
);
