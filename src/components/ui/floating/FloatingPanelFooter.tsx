'use client';

/**
 * ADR-929 §6.25 — Το **καρφωμένο υποσέλιδο** μιας αιωρούμενης παλέτας: η κύρια ενέργεια που δεν κυλά ποτέ μακριά.
 *
 * ── ΓΙΑΤΙ ΧΩΡΙΣΤΗ ΥΠΟΔΟΧΗ ΚΑΙ ΟΧΙ `sticky` ΜΕΣΑ ΣΤΟ `Content` ──
 * Σε παλέτα με ελεγχόμενο μέγεθος η ρίζα είναι `flex flex-col overflow-hidden` και το `Content` είναι το
 * `flex-1 min-h-0 overflow-auto` (βλ. `FloatingPanel`). Ένα αδελφό **μετά** το `Content` είναι εξ ορισμού έξω από την
 * κύλιση — καμία `sticky` παγίδα (που σπάει μόλις κάποιος πρόγονος αποκτήσει `overflow`). Ίδιο σχήμα με το κάτω
 * τμήμα κουμπιών των παλετών Revit/ArchiCAD και του Figma properties panel: η πράξη μένει στη θέση της.
 *
 * Προαιρετικό: οι υπάρχουσες παλέτες δεν το χρησιμοποιούν και μένουν ακριβώς ως έχουν.
 */

import * as React from 'react';
import { cn } from '@/lib/utils';

interface FloatingPanelFooterProps {
  readonly className?: string;
  readonly children: React.ReactNode;
  readonly 'data-testid'?: string;
}

export function FloatingPanelFooter({ className, children, 'data-testid': testId }: FloatingPanelFooterProps): React.JSX.Element {
  return (
    <footer className={cn('flex shrink-0 flex-col gap-1.5 border-t border-border p-2', className)} data-testid={testId}>
      {children}
    </footer>
  );
}
