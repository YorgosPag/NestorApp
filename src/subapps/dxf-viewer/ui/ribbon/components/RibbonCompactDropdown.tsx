'use client';

/**
 * `RibbonCompactDropdown` — SSoT για το «label + compact dropdown» ribbon widget
 * (N.0.2 / N.18, 2026-07-20).
 *
 * WHY: το ίδιο ~25-γραμμο JSX (row → label → compact wrapper → `DropdownMenu` με
 * `dxf-ribbon-wall-length-input` trigger + `▾`) ήταν αντιγραμμένο στα
 * `RibbonHatchListWidget` και `RibbonMepCircuitPickerWidget` — το header του
 * πρώτου το δήλωνε κιόλας («dropdown pattern template = RibbonMepCircuitPicker»).
 * Το jscpd (CHECK 3.28) το πιάνει ως structural clone ανεξαρτήτως ονομάτων.
 *
 * Το component ιδιοκτητεύει ΜΟΝΟ το κέλυφος. Το περιεχόμενο κάθε item είναι
 * `ReactNode`, ώστε ο καλών να δίνει ό,τι θέλει (swatch χρώματος + εμβαδόν,
 * σκέτο όνομα κυκλώματος, …) χωρίς να διαρρέει η σημασιολογία του εδώ.
 *
 * ⚠️ Δεν είναι Radix `Select` (ADR-001): αυτά τα widgets είναι **command menus**
 * (η επιλογή εκτελεί ενέργεια — select+zoom, set active id), όχι δεσμευμένα
 * πεδία τιμής. Γι' αυτό `DropdownMenu`, όπως και πριν.
 */

import React from 'react';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/hooks/useSemanticColors';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';

export interface RibbonCompactDropdownItem {
  /** React key + stable identity (entity id / system id). */
  readonly key: string;
  /** Ό,τι εμφανίζεται στη γραμμή του μενού (κείμενο, swatch + κείμενο, …). */
  readonly content: React.ReactNode;
  readonly onSelect: () => void;
  /** Extra κλάσεις για τη γραμμή (π.χ. `flex items-center gap-2`). */
  readonly itemClassName?: string;
}

export interface RibbonCompactDropdownProps {
  /** Ορατό label αριστερά + `aria-label` του trigger. */
  readonly label: string;
  /** Το κείμενο του trigger (χωρίς το `▾` — το προσθέτει το component). */
  readonly triggerContent: React.ReactNode;
  readonly items: readonly RibbonCompactDropdownItem[];
  readonly align?: 'start' | 'end';
}

export function RibbonCompactDropdown({
  label,
  triggerContent,
  items,
  align = 'start',
}: RibbonCompactDropdownProps): React.JSX.Element {
  const colors = useSemanticColors();

  return (
    <span className="dxf-ribbon-combobox-row">
      <span className="dxf-ribbon-combobox-label">{label}</span>
      <span className="dxf-ribbon-widget-compact">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={cn('dxf-ribbon-wall-length-input', colors.bg.primary)}
              aria-label={label}
            >
              {triggerContent} ▾
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align={align}>
            {items.map((item) => (
              <DropdownMenuItem
                key={item.key}
                onSelect={item.onSelect}
                className={item.itemClassName}
              >
                {item.content}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </span>
    </span>
  );
}
