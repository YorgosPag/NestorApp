'use client';

/**
 * ADR-443 — Κοινά primitives για τα dedicated wall-tool glyphs (SSoT).
 *
 * Giorgio 2026-07-03: «να χρησιμοποιούμε ΠΑΝΤΟΤΕ το ίδιο μέγεθος τοίχους στα εικονίδια».
 * Ώστε ο καφέ τοίχος σε ΟΛΑ τα εικονίδια (πάνω-σε-οντότητα / 4-γραμμές / μέσα-σε-περιοχή)
 * να έχει ΑΚΡΙΒΩΣ τις ίδιες διαστάσεις, ζει εδώ ΕΝΑ `WallBar` σταθερού μεγέθους — αντί
 * για ανά-icon hardcoded rect.
 */

import * as React from 'react';
import { WALL_IDENTITY_COLOR } from '../../../../bim/walls/wall-render-palette';

/** Κοινές διαστάσεις «wall bar» (μήκος × πάχος) — ΙΔΙΟ μέγεθος τοίχου σε ΟΛΑ τα wall icons. */
export const WALL_BAR_LENGTH = 15;
export const WALL_BAR_WIDTH = 3.6;

/** Λευκή υφιστάμενη οντότητα (host) πάνω στην οποία κυλά το φάντασμα του τοίχου (Giorgio 2026-07-03). */
export const HOST_ENTITY_COLOR = '#ffffff';

interface WallBarProps {
  /** Κέντρο του bar. */
  readonly cx: number;
  readonly cy: number;
  /** Περιστροφή σε μοίρες (0 = οριζόντιο, μήκος κατά X· 90 = κατακόρυφο). */
  readonly angle?: number;
  /** Χρώμα περιγράμματος (default = καφέ ταυτότητα τοίχου· host → λευκό). */
  readonly stroke?: string;
}

/**
 * Ένα «wall bar» σταθερών διαστάσεων (`WALL_BAR_LENGTH × WALL_BAR_WIDTH`), κεντραρισμένο
 * στο (cx,cy) και περιστραμμένο `angle°`. Κληρονομεί strokeWidth από το wrapping <svg>.
 */
export const WallBar: React.FC<WallBarProps> = ({ cx, cy, angle = 0, stroke = WALL_IDENTITY_COLOR }) => (
  <rect
    x={cx - WALL_BAR_LENGTH / 2}
    y={cy - WALL_BAR_WIDTH / 2}
    width={WALL_BAR_LENGTH}
    height={WALL_BAR_WIDTH}
    rx="0.5"
    stroke={stroke}
    transform={angle ? `rotate(${angle} ${cx} ${cy})` : undefined}
  />
);
