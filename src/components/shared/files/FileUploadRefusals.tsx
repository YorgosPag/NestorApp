'use client';

/**
 * @fileoverview **Γιατί δεν πέρασε το αρχείο** — inline, κάτω από τη ζώνη, όχι toast που χάνεται (ADR-054 «Αρνήσεις inline»).
 * @related components/shared/files/FileUploadZone (ο μόνος καλών) · components/ui/alert (η ΜΙΑ ειδοποίηση σφάλματος)
 * @module components/shared/files/FileUploadRefusals
 *
 * 🔑 Πρότυπο GOV.UK Design System / Carbon: το σφάλμα μένει ορατό δίπλα στο πεδίο μέχρι την επόμενη προσπάθεια, λέει
 *   **ποιο** αρχείο και **τι να κάνεις** («… πολύ μεγάλο. Μέγιστο μέγεθος: 50 MB»), και το πεδίο το δείχνει με
 *   `aria-describedby`. Το `role="alert"` του `Alert` το ανακοινώνει τη στιγμή που εμφανίζεται.
 * 🔑 Ένα στοιχείο λίστας ανά απορριφθέν αρχείο — τα έγκυρα της ίδιας επιλογής προχωρούν κανονικά.
 */

import React from 'react';

import { Alert, AlertDescription } from '@/components/ui/alert';

export interface FileUploadRefusalsProps {
  /** The id the zone's file input points at with `aria-describedby`. */
  readonly id: string;
  /** One already-translated message per refused file; empty ⇒ nothing is rendered. */
  readonly refusals: readonly string[];
}

export function FileUploadRefusals({ id, refusals }: FileUploadRefusalsProps) {
  if (refusals.length === 0) return null;
  return (
    <Alert id={id} variant="destructive" withIcon className="mt-2 text-left">
      <AlertDescription>
        <ul className="m-0 list-none p-0">
          {refusals.map((message, index) => (
            <li key={`${index}-${message}`}>{message}</li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  );
}
