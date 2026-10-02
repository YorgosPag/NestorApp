'use client';

/**
 * @fileoverview **Η μπάρα εργαλείων του χάρτη** — κάθετη, στο δεξί άκρο (θέση `tools`).
 * @related ADR-777 §8.85 · map-overlay-slots.ts · overlay-surface.ts
 * @module subapps/geo-canvas/components/map-overlays/MapToolbar
 *
 * 🔑 **Εικονίδιο + tooltip, όχι ετικέτα** — όπως το Google Maps και η Redfin: τα εργαλεία του
 * χάρτη είναι συνήθεια, όχι ανακάλυψη, και μια ετικέτα 20 χαρακτήρων ανά κουμπί ξαναφέρνει τη
 * στοίβα που σκέπαζε τον χάρτη. Το όνομα **δεν χάνεται**: είναι το `aria-label` (αναγνώστες
 * οθόνης) **και** το tooltip (ποντίκι · εστίαση πληκτρολογίου).
 *
 * ⚠️ **Στόχος 40×40** (`size="icon"`) — WCAG 2.5.5. Ένα εργαλείο που αστοχεί στο δάχτυλο δεν
 * είναι εργαλείο.
 *
 * ⚠️ **Τα πάνελ ενός εργαλείου (π.χ. στρώσεις) ανοίγουν ΚΑΤΩ από την μπάρα, στοιχισμένα δεξιά**
 * — `MAP_TOOLBAR_PANEL`. Η θέση `tools` είναι `absolute`, άρα είναι ο πρόγονος αναφοράς· το `<ul>`
 * και το `<li>` μένουν **χωρίς** θέση επίτηδες. Πάνελ προς τα αριστερά δεν χωρά στα 390px.
 */

import React from 'react';

import { Button } from '@/components/ui/button';
import { ToggleButton } from '@/components/ui/toggle-button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { MAP_OVERLAY_INTERACTIVE, MAP_OVERLAY_SLOT, MAP_OVERLAY_UNCLIPPED } from './map-overlay-slots';

/** Το πάνελ ενός εργαλείου: κάτω από την μπάρα, δεξιά στοιχισμένο. */
export const MAP_TOOLBAR_PANEL = 'absolute right-0 top-full mt-2';

interface MapToolbarProps {
  /** Το όνομα της ομάδας για αναγνώστες οθόνης. */
  readonly label: string;
  /** `MapToolbarButton`s — ό,τι είναι `null` απλώς λείπει. */
  readonly children: React.ReactNode;
}

export function MapToolbar({ label, children }: MapToolbarProps) {
  return (
    <nav aria-label={label} className={MAP_OVERLAY_SLOT.tools}>
      <ul className={cn(MAP_OVERLAY_INTERACTIVE, MAP_OVERLAY_UNCLIPPED, 'm-0 flex list-none flex-col gap-1 rounded-lg border border-border bg-card p-1 shadow-lg')}>
        {children}
      </ul>
    </nav>
  );
}

interface MapToolbarButtonProps {
  /** Όνομα **και** tooltip — ένα κείμενο, ποτέ δύο που αποκλίνουν. */
  readonly label: string;
  readonly icon: React.ReactNode;
  readonly onClick: () => void;
  /**
   * Εργαλείο με κατάσταση (στρώση αναμμένη) ⇒ `ToggleButton` (`aria-pressed` + γέμισμα τονισμού,
   * `COLOR_BRIDGE.selectionControl.pressed` — ποτέ `bg-primary`, που στο σκοτεινό ≡ `--card`).
   * `undefined` ⇒ απλή πράξη.
   */
  readonly pressed?: boolean;
  /** Ό,τι ανοίγει το εργαλείο (π.χ. πάνελ) — τοποθετείται με `MAP_TOOLBAR_PANEL`. */
  readonly children?: React.ReactNode;
}

type ToolTriggerProps = Omit<MapToolbarButtonProps, 'children'> &
  Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onClick' | 'aria-pressed'>;

/**
 * ⚠️ **`forwardRef` + διάδοση των υπόλοιπων props**: το `TooltipTrigger asChild` (Radix `Slot`)
 * περνά ref και χειριστές δείκτη/εστίασης στο παιδί. Χωρίς αυτά το tooltip **δεν ανοίγει ποτέ** —
 * σιωπηλά.
 */
const ToolTrigger = React.forwardRef<HTMLButtonElement, ToolTriggerProps>(
  ({ label, icon, onClick, pressed, ...slot }, ref) => {
    const common = { ...slot, ref, type: 'button' as const, size: 'icon' as const, variant: 'ghost' as const, onClick, 'aria-label': label };
    return pressed === undefined ? <Button {...common}>{icon}</Button> : <ToggleButton {...common} pressed={pressed}>{icon}</ToggleButton>;
  },
);
ToolTrigger.displayName = 'MapToolTrigger';

export function MapToolbarButton({ children, ...trigger }: MapToolbarButtonProps) {
  return (
    <li>
      <Tooltip>
        <TooltipTrigger asChild>
          <ToolTrigger {...trigger} />
        </TooltipTrigger>
        <TooltipContent side="left">{trigger.label}</TooltipContent>
      </Tooltip>
      {children}
    </li>
  );
}
