'use client';

/**
 * ADR-443 — Dedicated glyph για το εργαλείο «Τοίχος πάνω σε οντότητα» (`wall-on-entity`).
 *
 * Εξαίρεση στο base+method composition (`StructuralToolIcon`): ο Giorgio ζήτησε ρητά
 * (screenshots 2026-07-03) το εικονίδιο να δείχνει τη ΣΧΕΣΗ — ο τοίχος (φάντασμα) κυλά και
 * πατάει (κάθετα) πάνω στο σώμα μιας υφιστάμενης οντότητας, σε σχήμα ✓:
 *   · τοίχος   → καφέ `WallBar` (ταυτότητα τοίχου, SSoT `WALL_IDENTITY_COLOR`).
 *   · οντότητα → λευκό `WallBar` (`HOST_ENTITY_COLOR`) — η υφιστάμενη οντότητα-host.
 *
 * Και τα δύο μέλη = ΙΔΙΟ `WallBar` (ίδιες διαστάσεις με τους τοίχους των άλλων wall icons —
 * Giorgio: «πάντοτε το ίδιο μέγεθος τοίχους»). Ο καφές είναι κάθετος στη host (90°).
 */

import * as React from 'react';
import { WallBar, HOST_ENTITY_COLOR } from './wall-icon-primitives';

interface WallOnEntityIconProps {
  className?: string;
}

export const WallOnEntityIcon: React.FC<WallOnEntityIconProps> = ({ className }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {/* Υφιστάμενη οντότητα (host): λευκό bar, κεκλιμένο (κάτω-δεξιά κλάδος του ✓). */}
    <WallBar cx={14} cy={13.5} angle={-28} stroke={HOST_ENTITY_COLOR} />
    {/* Τοίχος (φάντασμα): καφέ bar, κάθετο στη host, πατάει πάνω στο σώμα της. */}
    <WallBar cx={8.1} cy={8.15} angle={62} />
  </svg>
);
