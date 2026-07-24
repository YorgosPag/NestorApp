'use client';

/**
 * ADR-692 Φ2 — «Διαμπερής Επιλογή» (X-ray) ribbon toggle (View tab, panel «Εμφάνιση»).
 *
 * Καθορίζει τι πιάνει το ορθογώνιο επιλογής ΣΤΟ 3D:
 *   • ΕΝΕΡΓΗ (προεπιλογή) → select-through, η σύμβαση AutoCAD/Revit: μετράει η προβολή της
 *     οντότητας, ακόμη κι αν κρύβεται πίσω από άλλη γεωμετρία (CPU, occlusion-agnostic).
 *   • ΑΝΕΝΕΡΓΗ → μόνο ό,τι φαίνεται πραγματικά: ένα GPU id-pass στο mouseup κόβει όσες
 *     οντότητες δεν έχουν ούτε ένα ορατό pixel μέσα στο ορθογώνιο.
 *
 * Λεπτός reader/writer του `marqueeSelectThrough` στο `ViewMode3DStore` (per-session SSoT),
 * διαβασμένο event-time από τον ενορχηστρωτή `marquee-3d-apply` — μηδέν subscription στον
 * καυτό δρόμο του drag (ADR-040). Markup μέσω του `<RibbonToggleWidget config>` (ADR-599).
 */

import React from 'react';
import { ScanEye, Eye } from 'lucide-react';
import { useViewMode3DStore } from '../../../bim-3d/stores/ViewMode3DStore';
import { RibbonToggleWidget, type RibbonToggleConfig } from './RibbonToggleWidget';

const MARQUEE_SELECT_THROUGH_TOGGLE: RibbonToggleConfig = {
  useToggleState: () => {
    const value = useViewMode3DStore((s) => s.marqueeSelectThrough);
    const set = useViewMode3DStore((s) => s.setMarqueeSelectThrough);
    return { value, toggle: () => set(!value) };
  },
  labelKey: 'ribbon.commands.marqueeSelectThrough.label',
  activeIcon: ScanEye,
  inactiveIcon: Eye,
  // Σύμβαση ADR-599: όταν είναι ΕΝΕΡΓΟ δείχνει την ΕΝΕΡΓΕΙΑ «απενεργοποίηση» (και αντίστροφα).
  activeLabelKey: 'ribbon.commands.marqueeSelectThrough.disable',
  inactiveLabelKey: 'ribbon.commands.marqueeSelectThrough.enable',
  activeTooltipKey: 'ribbon.commands.marqueeSelectThrough.tooltipDisable',
  inactiveTooltipKey: 'ribbon.commands.marqueeSelectThrough.tooltipEnable',
};

export const MarqueeSelectThroughToggle: React.FC = () => (
  <RibbonToggleWidget config={MARQUEE_SELECT_THROUGH_TOGGLE} />
);
