'use client';

import React from 'react';
import {
  useAutoBreaklineState,
} from '../../systems/topography/auto-breaklines/auto-breakline-store';
import { CoordinateTransforms } from '../../rendering/core/CoordinateTransforms';
import type { ViewTransform, Viewport } from '../../rendering/types/Types';
import type { AutoBreaklineCandidate } from '../../systems/topography/auto-breaklines/auto-breakline-types';

interface Props {
  readonly transform: ViewTransform;
  readonly viewport: Viewport;
}

/** Ticked = will be added on confirm. Unticked = shown, but rejected. */
const APPROVED_COLOR = '#22c55e';
const REJECTED_COLOR = '#94a3b8';

/**
 * ADR-650 M8β/Γ — προεπισκόπηση των ΠΡΟΤΕΙΝΟΜΕΝΩΝ γραμμών ασυνέχειας (auto-breaklines).
 *
 * Ο μηχανικός πρέπει να ΔΕΙ τι θα προστεθεί πριν το εγκρίνει — μια λίστα «βρέθηκαν 12
 * υποψήφιες» χωρίς σχήμα στον καμβά δεν είναι κρίσιμη πληροφορία, είναι αριθμός (§9,
 * human-certifier: preview ≡ ό,τι θα γραφτεί). Πράσινο συμπαγές = τσεκαρισμένη (θα μπει)·
 * γκρι διακεκομμένο = ξετσεκαρισμένη (θα αγνοηθεί). Οι κορυφές είναι ήδη WORLD canonical mm
 * (ADR-462) = canvas units, όπως και οι ισοϋψείς — καμία μετατροπή.
 *
 * ADR-040 compliant: standalone subscriber leaf (`useSyncExternalStore` εδώ, ΟΧΙ στο shell),
 * LOW-frequency store (γράφεται μόνο σε κλικ). Mirror του `RegionPerimeterPreviewOverlay`.
 */
export function TopoAutoBreaklinePreviewOverlay({ transform, viewport }: Props) {
  const { report, selected } = useAutoBreaklineState();

  if (report === null || report.candidates.length === 0) return null;

  const toPath = (candidate: AutoBreaklineCandidate): string => {
    const d = candidate.vertices
      .map((v) => CoordinateTransforms.worldToScreen({ x: v.x, y: v.y }, transform, viewport))
      .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
      .join(' ');
    return candidate.closed ? `${d} Z` : d;
  };

  return (
    <svg
      className="absolute inset-0 size-full pointer-events-none z-10"
      xmlns="http://www.w3.org/2000/svg"
    >
      {report.candidates.map((candidate) => {
        const approved = selected.has(candidate.id);
        return (
          <path
            key={candidate.id}
            d={toPath(candidate)}
            fill="none"
            stroke={approved ? APPROVED_COLOR : REJECTED_COLOR}
            strokeWidth={approved ? 3 : 2}
            strokeDasharray={approved ? undefined : '6 4'}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        );
      })}
    </svg>
  );
}
