'use client';

/**
 * ADR-443 — Dedicated glyph για το εργαλείο «Τοίχος από 4 γραμμές» (`wall-region-lines`).
 *
 * Εξαίρεση στο base+method composition (`StructuralToolIcon`): ο Giorgio ζήτησε ρητά
 * (screenshot 2026-07-03) το εικονίδιο να δείχνει τη ΡΟΗ του εργαλείου — 4 διακριτές
 * γραμμές που σχηματίζουν ένα ορθογώνιο (input) → ένας τοίχος που το γεμίζει (output):
 *   · 4 γραμμές  → κεκλιμένο ορθογώνιο με ΚΕΝΑ στις γωνίες (τονίζει «4 ξεχωριστές γραμμές»,
 *     όχι κλειστό polygon), σε μπλε (επιλεγμένες γραμμές — Giorgio 2026-07-03).
 *   · τοίχος     → κάθετο μέλος αριστερά, `WALL_IDENTITY_COLOR` (το καφέ που έχει ο τοίχος
 *     στον καμβά) — SSoT `wall-render-palette`, ΟΧΙ hardcoded.
 *
 * Sizing όπως `StructuralToolIcon`/`CircleIcon`: no width/height — ο caller περνά το
 * ribbon icon class.
 */

import * as React from 'react';
import { WallBar } from './wall-icon-primitives';

/** Μπλε των «επιλεγμένων γραμμών» (input) — Giorgio 2026-07-03· ξεχωρίζει από τον καφέ τοίχο. */
const PICKED_LINE_COLOR = '#3b82f6';

interface WallFromLinesIconProps {
  className?: string;
}

export const WallFromLinesIcon: React.FC<WallFromLinesIconProps> = ({ className }) => (
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
    {/* 4 διακριτές γραμμές (input): κεκλιμένο ορθογώνιο με κενά στις γωνίες. */}
    <g stroke={PICKED_LINE_COLOR}>
      <line x1="8.3" y1="13.3" x2="17.2" y2="6.3" />
      <line x1="18.3" y1="6" x2="21.2" y2="9.7" />
      <line x1="20.7" y1="10.7" x2="11.8" y2="17.7" />
      <line x1="10.7" y1="18" x2="7.8" y2="14.3" />
    </g>
  </svg>
);
