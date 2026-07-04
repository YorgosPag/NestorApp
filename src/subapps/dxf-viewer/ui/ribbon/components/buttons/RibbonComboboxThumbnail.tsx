'use client';

/**
 * ADR-562 Φ8 — Inline-SVG preview για ribbon combobox options (linetype μοτίβο /
 * arrowhead σχήμα). AutoCAD/Figma-style «δείξε το preview δίπλα στο όνομα».
 *
 * Theme-correct: `stroke`/`fill="currentColor"` → κληρονομεί το χρώμα κειμένου του
 * SelectItem (light/dark + hover highlight), μηδέν hardcoded χρώμα (N.3). Η γεωμετρία
 * έρχεται από τους SSoT builders (ίδιο SSoT με τον renderer) — δες τα thumbnail modules.
 *
 * @see rendering/linetype-thumbnail.ts · systems/dimensions/arrowhead-thumbnail.ts
 */

import React from 'react';
import type { RibbonComboboxThumbnailDescriptor } from '../../types/ribbon-types';
import { buildLinetypeThumbnail } from '../../../../rendering/linetype-thumbnail';
import { buildArrowheadThumbnail } from '../../../../systems/dimensions/arrowhead-thumbnail';

const LinetypeThumb: React.FC<{ name: string }> = ({ name }) => {
  const t = buildLinetypeThumbnail(name);
  return (
    <svg
      viewBox={`0 0 ${t.width} ${t.height}`}
      className="h-3.5 w-10 shrink-0"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <line
        x1={0}
        y1={t.height / 2}
        x2={t.width}
        y2={t.height / 2}
        stroke="currentColor"
        strokeWidth={1.25}
        strokeDasharray={t.dash.length > 0 ? t.dash.join(' ') : undefined}
      />
    </svg>
  );
};

const ArrowheadThumb: React.FC<{ name: string }> = ({ name }) => {
  const t = buildArrowheadThumbnail(name);
  return (
    <svg viewBox={`0 0 ${t.size} ${t.size}`} className="h-5 w-5 shrink-0" aria-hidden="true">
      {t.primitives.map((p, i) => {
        if (p.kind === 'line') {
          return (
            <line
              key={i}
              x1={p.x1}
              y1={p.y1}
              x2={p.x2}
              y2={p.y2}
              stroke="currentColor"
              strokeWidth={1}
              strokeLinecap="round"
            />
          );
        }
        if (p.kind === 'polygon') {
          return (
            <polygon
              key={i}
              points={p.points.map(([x, y]) => `${x},${y}`).join(' ')}
              stroke="currentColor"
              strokeWidth={1}
              strokeLinejoin="round"
              fill={p.solid ? 'currentColor' : 'none'}
            />
          );
        }
        return (
          <circle
            key={i}
            cx={p.cx}
            cy={p.cy}
            r={p.r}
            stroke="currentColor"
            strokeWidth={1}
            fill={p.solid ? 'currentColor' : 'none'}
          />
        );
      })}
    </svg>
  );
};

/** Ζωγραφίζει το κατάλληλο inline-SVG preview ανάλογα με το `kind` του descriptor. */
export function RibbonComboboxThumbnail({
  thumbnail,
}: {
  thumbnail: RibbonComboboxThumbnailDescriptor;
}) {
  return thumbnail.kind === 'linetype' ? (
    <LinetypeThumb name={thumbnail.name} />
  ) : (
    <ArrowheadThumb name={thumbnail.name} />
  );
}
