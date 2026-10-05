'use client';

/**
 * @fileoverview **ΚΟΥΜΠΙ-ΕΙΚΟΝΙΔΙΟ ΜΕ ΥΠΟΧΡΕΩΤΙΚΟ ΟΝΟΜΑ** — το πρότυπο GitHub Primer `IconButton`.
 * @related ADR-898 §21.6 Ε10 · WCAG 2.2 SC 4.1.2 (Name, Role, Value) · ui/button · ui/tooltip
 * @module components/ui/icon-button
 *
 * 🔴 **ΓΙΑΤΙ ΥΠΑΡΧΕΙ.** Το σχήμα `Tooltip → TooltipTrigger → Button size="icon" → <Icon/>` γραφόταν με το
 * χέρι, και το tooltip **δεν** είναι όνομα: το Radix το δένει με `aria-describedby`, και μόνο όσο είναι
 * ανοιχτό. Ένα κουμπί με μόνο εικονίδιο + tooltip ανακοινώνεται ως σκέτο «κουμπί». Μετρημένο 2026-10-05:
 * 46 τέτοια κουμπιά σε 22 αρχεία του `src/`.
 *
 * 🔑 **ΜΙΑ συμβολοσειρά, δύο ρόλοι.** Το `label` είναι **υποχρεωτικό** και γίνεται ταυτόχρονα `aria-label`
 * και κείμενο του tooltip ⇒ όνομα και tooltip **δεν μπορούν** να αποκλίνουν, και κανένα δεν ξεχνιέται.
 * Τα `aria-label` / `aria-labelledby` / `title` λείπουν επίτηδες από τα props: δεύτερη πηγή ονόματος δεν
 * γράφεται (ίδια τεχνική με το `ToggleButton`).
 *
 * `busy` ⇒ το εικονίδιο γίνεται `Spinner`, το κουμπί απενεργοποιείται και φέρει `aria-busy`· το όνομα **μένει**.
 *
 * ⚠️ Θέλει πρόγονο `TooltipProvider` (τον δίνει κάθε layout — ADR-813).
 * ⚠️ Για κουμπί με κατάσταση (πατημένο/όχι) χρησιμοποίησε το `ToggleButton`· για dropdown trigger μέσα σε
 * tooltip το σχήμα είναι άλλο (βλ. `ToolbarIconButton`).
 */

import * as React from 'react';

import { Button, type ButtonProps } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

/** Καθυστέρηση εμφάνισης — ίδια με τις γραμμές ενεργειών που αντικαθιστά. */
const TOOLTIP_DELAY_MS = 300;

export interface IconButtonProps
  extends Omit<ButtonProps, 'size' | 'children' | 'asChild' | 'title' | 'aria-label' | 'aria-labelledby'> {
  /** Το προσβάσιμο όνομα **και** το κείμενο του tooltip. Μεταφρασμένο — ποτέ ωμό κείμενο (N.11). */
  readonly label: string;
  /** Το εικονίδιο. Διακοσμητικό: το όνομα το φέρει το κουμπί. */
  readonly children: React.ReactNode;
  readonly size?: 'icon' | 'icon-sm';
  /** Η πράξη τρέχει: `Spinner` στη θέση του εικονιδίου, κουμπί ανενεργό, `aria-busy`. */
  readonly busy?: boolean;
  readonly tooltipSide?: React.ComponentPropsWithoutRef<typeof TooltipContent>['side'];
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ label, children, size = 'icon-sm', variant = 'ghost', busy = false, disabled, tooltipSide, ...props }, ref) => (
    <Tooltip delayDuration={TOOLTIP_DELAY_MS}>
      <TooltipTrigger asChild>
        <Button
          ref={ref}
          variant={variant}
          size={size}
          {...props}
          disabled={disabled || busy}
          aria-busy={busy || undefined}
          aria-label={label}
        >
          {busy ? <Spinner size="small" color="inherit" /> : children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side={tooltipSide}>{label}</TooltipContent>
    </Tooltip>
  ),
);
IconButton.displayName = 'IconButton';
