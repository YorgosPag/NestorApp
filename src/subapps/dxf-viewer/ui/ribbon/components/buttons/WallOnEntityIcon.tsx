'use client';

/**
 * ADR-443 — Dedicated glyph για το εργαλείο «Τοίχος πάνω σε οντότητα» (`wall-on-entity`).
 *
 * Εξαίρεση στο base+method composition (`StructuralToolIcon`): ο Giorgio ζήτησε ρητά
 * (screenshot 2026-07-03) το εικονίδιο να δείχνει τη ΣΧΕΣΗ — έναν κάθετο τοίχο που
 * πατάει (⊥) πάνω σε μια οριζόντια οντότητα-host — αντί για το γενικό «wall base +
 * on-entity badge». Δεν χωράει στο fragment map (το base=wall είναι πάντα 2 οριζόντιες
 * γραμμές), οπότε ζει ως ξεχωριστό component.
 *
 * Χρώματα (Giorgio):
 *   · Τοίχος   → `WALL_IDENTITY_COLOR` = το καφέ (brick-warm poché) που έχει ο τοίχος
 *     στον καμβά — SSoT `wall-render-palette`, ΟΧΙ hardcoded.
 *   · Οντότητα → `currentColor` = ίδιο χρώμα με όλα τα άλλα ribbon icons (theme-aware).
 *
 * Sizing όπως `StructuralToolIcon`/`CircleIcon`: no width/height — ο caller περνά το
 * ribbon icon class (`dxf-ribbon-btn-icon-large|small`).
 */

import * as React from 'react';
import { WALL_IDENTITY_COLOR } from '../../../../bim/walls/wall-render-palette';

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
    {/* Οντότητα-host: οριζόντιο μέλος στη βάση — χρώμα άλλων icons (currentColor). */}
    <rect x="2" y="16.75" width="20" height="4.75" rx="0.6" stroke="currentColor" />
    {/* Τοίχος: κάθετο μέλος που πατάει (⊥) πάνω στο host — καφέ ταυτότητα τοίχου. */}
    <rect x="9.5" y="2.5" width="5" height="14.25" rx="0.6" stroke={WALL_IDENTITY_COLOR} />
  </svg>
);
