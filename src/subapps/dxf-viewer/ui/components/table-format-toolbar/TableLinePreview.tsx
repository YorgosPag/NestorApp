'use client';

/**
 * ADR-750 Φ5/Φ6 — **η ΜΙΑ γραμμή δείγματος** της μπάρας πίνακα: μοτίβο × πάχος × χρώμα.
 *
 * ## Γιατί εξήχθη (N.18 / CHECK 3.28)
 * Γεννήθηκε ιδιωτική μέσα στο {@link TableBorderPencilPanel} (`DashPreview`). Η Φ6 ρωτά **το
 * ίδιο ακριβώς πράγμα** σε δύο ακόμη σημεία — το listbox των 14 στυλ και η προεπισκόπηση
 * χρώματος του διαλόγου — δηλαδή θα ήταν sibling clone μέσα στο ίδιο commit, ακριβώς το σχήμα
 * που μετρά το jscpd ανεξάρτητα ονόματος.
 *
 * Ουσιαστικά: το μοτίβο περνά από το {@link buildLinetypeThumbnailFromPattern}, δηλαδή από το
 * **ίδιο** `dashMmToScreenPx` που χρησιμοποιεί ο renderer. Δεύτερο αντίγραφο θα ήταν δεύτερη
 * απάντηση στο «πώς φαίνεται μια διακεκομμένη», και θα απέκλινε την ημέρα που θα αλλάξει η
 * κλίμακα του thumbnail.
 *
 * Χωρίς `colorHex` κληρονομεί το `currentColor` — theme-correct (N.3): σε λίστα τύπου/πάχους το
 * ζητούμενο είναι το **σχήμα**, και ένα σταθερό χρώμα θα εξαφανιζόταν στο ένα από τα δύο θέματα.
 *
 * @module subapps/dxf-viewer/ui/components/table-format-toolbar/TableLinePreview
 * @see rendering/linetype-thumbnail.ts — η κλίμακα του μοτίβου (κοινή με το ribbon)
 */

import React from 'react';
import { buildLinetypeThumbnailFromPattern } from '../../../rendering/linetype-thumbnail';

/** Πόσο παχιά ζωγραφίζεται μια πένα του ενός χιλιοστού, σε μονάδες `viewBox`. */
const PREVIEW_PX_PER_MM = 3;
/** Κάτω από αυτό η λεπτότερη πένα θα εξαφανιζόταν — hairline αντί για τίποτα. */
const PREVIEW_MIN_WIDTH = 0.75;

/** Το πάχος απόδοσης μιας πένας, με το δάπεδο ορατότητας — η **μία** μετατροπή mm → viewBox. */
export function tableLinePreviewStrokeWidth(widthMm: number): number {
  return Math.max(widthMm * PREVIEW_PX_PER_MM, PREVIEW_MIN_WIDTH);
}

export interface TableLinePreviewProps {
  readonly patternMm: readonly number[];
  readonly widthMm: number;
  /** Απόν ⇒ `currentColor` (δες την κεφαλίδα). */
  readonly colorHex?: string;
  readonly className?: string;
}

export function TableLinePreview({
  patternMm, widthMm, colorHex, className,
}: TableLinePreviewProps): React.ReactElement {
  const thumb = buildLinetypeThumbnailFromPattern(patternMm);
  return (
    <svg
      className={className}
      viewBox={`0 0 ${thumb.width} ${thumb.height}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <line
        x1={0}
        y1={thumb.height / 2}
        x2={thumb.width}
        y2={thumb.height / 2}
        stroke={colorHex ?? 'currentColor'}
        strokeWidth={tableLinePreviewStrokeWidth(widthMm)}
        strokeDasharray={thumb.dash.length > 0 ? thumb.dash.join(' ') : undefined}
      />
    </svg>
  );
}
