'use client';

/**
 * ADR-363 — «Ετικέτες ανοιγμάτων» ribbon toggle (contextual «Ιδιότητες Ανοίγματος»).
 *
 * Εναλλάσσει την scene-wide ορατότητα των opening tags (πόρτες/παράθυρα). Μετακινήθηκε
 * από το αριστερό panel «Επίπεδα» (πρώην `AnnotationsSection`) στο contextual tab, δίπλα
 * στο στυλ ετικέτας — Revit/ArchiCAD-grade (η ορατότητα ζει εκεί που δουλεύεις το άνοιγμα).
 *
 * SSoT: reads/writes το `systems/layers/opening-tag-layer` (in-memory layer store) —
 * ίδιο state, νέο σημείο έκθεσης. `value` = «ορατό» (visibility-style convention του
 * RibbonToggleWidget: active=Eye/turn-off-action). ADR-599 markup ενοποίηση μέσω
 * `<RibbonToggleWidget config>` — μηδέν copy-pasted markup.
 */

import React from 'react';
import { Eye, EyeOff } from 'lucide-react';
import {
  useOpeningTagLayerVisible,
  setOpeningTagLayerVisible,
} from '../../../systems/layers/opening-tag-layer';
import { RibbonToggleWidget, type RibbonToggleConfig } from './RibbonToggleWidget';

const OPENING_TAG_VISIBILITY_TOGGLE: RibbonToggleConfig = {
  useToggleState: () => {
    const visible = useOpeningTagLayerVisible();
    return {
      value: visible,
      toggle: () => setOpeningTagLayerVisible(!visible),
    };
  },
  labelKey: 'ribbon.commands.openingEditor.tagVisibility.label',
  activeIcon: Eye,
  inactiveIcon: EyeOff,
  activeLabelKey: 'ribbon.commands.openingEditor.tagVisibility.hide',
  inactiveLabelKey: 'ribbon.commands.openingEditor.tagVisibility.show',
  activeTooltipKey: 'ribbon.commands.openingEditor.tagVisibility.tooltipHide',
  inactiveTooltipKey: 'ribbon.commands.openingEditor.tagVisibility.tooltipShow',
};

export const OpeningTagLayerToggle: React.FC = () => (
  <RibbonToggleWidget config={OPENING_TAG_VISIBILITY_TOGGLE} />
);
