'use client';

/**
 * @fileoverview **Τα πλαίσια κατάστασης πάνω στη σελίδα PDF της αναθεώρησης** (ADR-923 §5.5.2 Β8) — η στρώση που δίνει ο κατάλογος
 *   στο ουδέτερο slot `pageOverlay` του `PdfCanvasViewer`. Ο viewer δεν ξέρει τίποτα για καταστάσεις καταλόγου.
 * @module components/catalog/imports/ImportReviewOverlay
 *
 * 🔑 Ζωγραφίζει **ακριβώς** τα `dash` · `glyph` · `token` του `IMPORT_REVIEW_MARKS` — τα ίδια πεδία που κρίνει το CHECK 3.41.
 * 🔑 SVG **χωρίς** `viewBox`, συντεταγμένες σε **ποσοστά** της σελίδας: τα περιγράμματα (`non-scaling-stroke`) και τα σύμβολα
 *    γωνίας μένουν σε pixels οθόνης, δεν παραμορφώνονται με το ζουμ ή τη μη τετράγωνη σελίδα, και κανένα inline style (N.3).
 * 🔑 Κάθε πλαίσιο είναι **κουμπί** (`role="button"`, `aria-label`, Enter/Space, δακτύλιος `focus-visible`) — WCAG 2.1.1 / 4.1.2.
 */

import React, { type KeyboardEvent } from 'react';

import { IMPORT_REVIEW_MARKS, type ReviewMarkGlyph, type ReviewMarkTone } from '@/subapps/catalog/import/review-marks';
import { REVIEW_TONE_KEYS, useImportText } from './import-text';
import { useTargetLabeler } from './import-target-label';
import { useReviewHoverHandlers, useReviewHovered } from './review-hover-store';
import type { ReviewBox, ReviewBoxTarget } from './review-overlay-model';

/** Κλάσεις ανά τόνο — κυριολεκτικές, ώστε το Tailwind να τις βρει (το χρώμα ζει στο token, το σχήμα στο `IMPORT_REVIEW_MARKS`). */
const TONE_CLASS: Readonly<Record<ReviewMarkTone, { readonly stroke: string; readonly fill: string }>> = {
  pending: { stroke: 'stroke-paper-mark-pending', fill: 'fill-paper-mark-pending' },
  accepted: { stroke: 'stroke-paper-mark-accepted', fill: 'fill-paper-mark-accepted' },
  problem: { stroke: 'stroke-paper-mark-problem', fill: 'fill-paper-mark-problem' },
  dismissed: { stroke: 'stroke-paper-mark-dismissed', fill: 'fill-paper-mark-dismissed' },
};

/** Μέγεθος του σήματος γωνίας σε pixels οθόνης. */
const GLYPH_PX = 14;

const GLYPH_PATH: Readonly<Record<Exclude<ReviewMarkGlyph, 'none'>, string>> = {
  check: 'M3.5 7.2 6 9.7l4.5-5',
  alert: 'M7 3.4v4.4M7 10.2v.4',
  cross: 'M4.6 4.6l4.8 4.8M9.4 4.6l-4.8 4.8',
};

const pct = (fraction: number): string => `${fraction * 100}%`;

/** Το σύμβολο γωνίας: λευκός δίσκος με περίγραμμα και σύμβολο στο χρώμα του τόνου. Κοινό με το υπόμνημα. */
export function ReviewMarkBadge({ tone }: { readonly tone: ReviewMarkTone }) {
  const { glyph } = IMPORT_REVIEW_MARKS.tones[tone];
  if (glyph === 'none') return null;
  return (
    <>
      <circle cx={GLYPH_PX / 2} cy={GLYPH_PX / 2} r={GLYPH_PX / 2 - 0.75} className={`fill-white ${TONE_CLASS[tone].stroke}`} strokeWidth={1.5} />
      <path d={GLYPH_PATH[glyph]} className={TONE_CLASS[tone].stroke} fill="none" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </>
  );
}

/** Το περίγραμμα ενός τόνου, με το μοτίβο και το πάχος του. Κοινό με το υπόμνημα. */
export function ReviewMarkOutline({ tone, x, y, width, height }: { readonly tone: ReviewMarkTone; readonly x: string | number; readonly y: string | number; readonly width: string | number; readonly height: string | number }) {
  const spec = IMPORT_REVIEW_MARKS.tones[tone];
  return (
    <rect x={x} y={y} width={width} height={height} className={`fill-transparent ${TONE_CLASS[tone].stroke}`} strokeWidth={spec.strokePx}
      strokeDasharray={spec.dash === 'none' ? undefined : spec.dash} vectorEffect="non-scaling-stroke" />
  );
}

/** «Παροχή αέρα H, 340, αντιστοιχίστηκε» (+ «και 3 ακόμη» όταν το πλαίσιο τροφοδοτεί πολλά). */
function useBoxLabel(box: ReviewBox): string {
  const { t } = useImportText();
  const labelOf = useTargetLabeler();
  const name = (entry: ReviewBoxTarget) => (entry.subject.kind === 'field' ? labelOf(entry.subject.field) : entry.subject.label);
  const [first] = box.targets;
  const head = t('review.overlay.boxLabel', { label: name(first), value: first.printed, state: t(REVIEW_TONE_KEYS[box.tone]) });
  return box.targets.length > 1 ? `${head} ${t('review.overlay.boxMore', { count: box.targets.length - 1 })}` : head;
}

interface BoxProps {
  readonly box: ReviewBox;
  readonly selected: boolean;
  readonly onSelect: (box: ReviewBox) => void;
}

function ReviewBoxMark({ box, selected, onSelect }: BoxProps) {
  const label = useBoxLabel(box);
  const keys = box.targets.map((entry) => entry.key);
  const hovered = useReviewHovered(keys);
  const hover = useReviewHoverHandlers(keys);
  const { region, tone } = box;
  const geometry = { x: pct(region.x), y: pct(region.y), width: pct(region.width), height: pct(region.height) };
  const activate = (event: KeyboardEvent<SVGGElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    onSelect(box);
  };
  const halo = selected ? 'stroke-paper-mark-selection/70' : hovered ? 'stroke-paper-mark-selection/40' : 'stroke-transparent group-focus-visible:stroke-paper-mark-selection';
  return (
    <g role="button" tabIndex={0} aria-label={label} aria-current={selected ? 'true' : undefined} className="group pointer-events-auto cursor-pointer outline-none"
      onClick={() => onSelect(box)} onKeyDown={activate} {...hover}>
      <rect {...geometry} className={`${selected ? 'fill-paper-mark-selection/20' : 'fill-transparent'} ${halo}`}
        strokeWidth={IMPORT_REVIEW_MARKS.tones[tone].strokePx + 4} vectorEffect="non-scaling-stroke" />
      <ReviewMarkOutline tone={tone} {...geometry} />
      <svg x={pct(region.x + region.width)} y={pct(region.y)} width={GLYPH_PX} height={GLYPH_PX} overflow="visible" aria-hidden="true">
        <g transform={`translate(${-GLYPH_PX / 2} ${-GLYPH_PX / 2})`}><ReviewMarkBadge tone={tone} /></g>
      </svg>
    </g>
  );
}

interface ImportReviewOverlayProps {
  /** Τα πλαίσια **της σελίδας που φαίνεται**, ήδη ταξινομημένα (`buildReviewBoxes`: περιέκτες πρώτα, σειρά ανάγνωσης). */
  readonly boxes: readonly ReviewBox[];
  readonly selectedKey: string | null;
  /** «Εμφάνιση πλαισίων» κλειστό ⇒ μένει **μόνο** το επιλεγμένο (ποτέ «επέλεξα και δεν βλέπω πού»). */
  readonly showAll: boolean;
  readonly onSelect: (box: ReviewBox) => void;
}

export function ImportReviewOverlay({ boxes, selectedKey, showAll, onSelect }: ImportReviewOverlayProps) {
  const { t } = useImportText();
  const isSelected = (box: ReviewBox) => selectedKey !== null && box.targets.some((entry) => entry.key === selectedKey);
  const visible = showAll ? boxes : boxes.filter(isSelected);
  if (visible.length === 0) return null;
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" role="group" aria-label={t('review.overlay.layer')}>
      {visible.map((box) => <ReviewBoxMark key={box.id} box={box} selected={isSelected(box)} onSelect={onSelect} />)}
    </svg>
  );
}
