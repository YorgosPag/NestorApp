'use client';

/**
 * ADR-443 — Dedicated glyph για το εργαλείο «Τοίχος μέσα σε περιοχή» (`wall-region-inside`).
 *
 * Εξαίρεση στο base+method composition (`StructuralToolIcon`): ο Giorgio ζήτησε ρητά
 * (screenshot 2026-07-03) το εικονίδιο να δείχνει την ΠΕΡΙΟΧΗ ως **πράσινο διακεκομμένο
 * (dashed) κλειστό ορθογώνιο** — ακριβώς όπως η live πράσινη διακεκομμένη preview του
 * region-fill (`RegionPerimeterPreviewOverlay`) — με τον τοίχο-output δίπλα:
 *   · περιοχή → κεκλιμένο ΚΛΕΙΣΤΟ ορθογώνιο, πράσινο dashed (η εντοπισμένη περιοχή).
 *   · τοίχος  → κάθετο μέλος αριστερά, `WALL_IDENTITY_COLOR` (καφέ ταυτότητα, SSoT).
 *
 * Διαφορά από το `WallFromLinesIcon` («4 γραμμές» = μπλε SOLID με κενά στις γωνίες): εδώ
 * το περίγραμμα είναι ΣΥΝΕΧΕΣ κλειστό & ΔΙΑΚΕΚΟΜΜΕΝΟ (region), όχι 4 ξεχωριστές γραμμές.
 */

import * as React from 'react';
import { WallBar } from './wall-icon-primitives';

/**
 * Πράσινο της εντοπισμένης περιοχής — ταυτίζεται με το buildable dashed preview του
 * region-fill (`RegionPerimeterPreviewOverlay` `#22c55e`), ώστε το εικονίδιο να μιλά την
 * ίδια οπτική γλώσσα με το live hover («αυτή η περιοχή → τοίχος»).
 */
const REGION_PREVIEW_COLOR = '#22c55e';

interface WallRegionInsideIconProps {
  className?: string;
}

export const WallRegionInsideIcon: React.FC<WallRegionInsideIconProps> = ({ className }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {/* Τοίχος (output): κάθετο μέλος αριστερά — ΙΔΙΟ `WallBar` με τα άλλα wall icons. */}
    <WallBar cx={4.1} cy={12} angle={90} />
    {/* Περιοχή (input): κλειστό κεκλιμένο ορθογώνιο, πράσινο διακεκομμένο. Κάθε πλευρά
        ξεχωριστή γραμμή με `pathLength=100` ώστε το dash να ΞΕΚΙΝΑ & ΤΕΛΕΙΩΝΕΙ ακριβώς στην
        κορυφή (d=g=100/(2n-1): μακριά n=4, κοντή n=2) → αιχμηρές, ορθογωνισμένες γωνίες αντί
        για dash που «γυρίζει» τη γωνία (όπως θα έκανε ένα ενιαίο `<polygon>`). */}
    <g stroke={REGION_PREVIEW_COLOR} strokeLinecap="butt">
      <line x1="7.5" y1="13.9" x2="18.1" y2="5.7" pathLength="100" strokeDasharray="14.29 14.29" />
      <line x1="18.1" y1="5.7" x2="21.5" y2="10.1" pathLength="100" strokeDasharray="33.33 33.33" />
      <line x1="21.5" y1="10.1" x2="10.9" y2="18.3" pathLength="100" strokeDasharray="14.29 14.29" />
      <line x1="10.9" y1="18.3" x2="7.5" y2="13.9" pathLength="100" strokeDasharray="33.33 33.33" />
    </g>
  </svg>
);
