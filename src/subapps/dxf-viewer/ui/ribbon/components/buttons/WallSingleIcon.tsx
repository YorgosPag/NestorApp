'use client';

/**
 * ADR-443 — Dedicated glyph για το entry-point εργαλείο «Τοίχος» (`struct-wall-single`)
 * στην καρτέλα «Δομικά».
 *
 * Giorgio 2026-07-04: αντικατάσταση του παλιού συμβόλου με τις «δύο παράλληλες γραμμές»
 * (base+method composition `StructuralToolIcon base="wall"`) με έναν **καφέ τοίχο ως
 * ορθογώνιο** — ίδιο χρώμα (`WALL_IDENTITY_COLOR`) και **ίδιες διαστάσεις** (`WallBar`) με
 * τους τοίχους των contextual wall icons (πάνω-σε-οντότητα / 4-γραμμές / μέσα-σε-περιοχή),
 * ώστε ο τοίχος να δείχνεται ΠΑΝΤΟΤΕ ίδιος. Κατακόρυφος (90°), κεντραρισμένος.
 *
 * Εξαίρεση στο base+method composition (όπως τα υπόλοιπα dedicated wall glyphs), reusing
 * το ΙΔΙΟ `WallBar` SSoT primitive — μηδέν hardcoded rect/χρώμα.
 *
 * @see wall-icon-primitives.tsx — WallBar (σταθερό μέγεθος τοίχου, SSoT)
 */

import * as React from 'react';
import { WallBar } from './wall-icon-primitives';

interface WallSingleIconProps {
  className?: string;
}

export const WallSingleIcon: React.FC<WallSingleIconProps> = ({ className }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {/* Τοίχος = καφές WallBar (ταυτότητα τοίχου), κατακόρυφος, κεντραρισμένος. */}
    <WallBar cx={12} cy={12} angle={90} />
  </svg>
);
