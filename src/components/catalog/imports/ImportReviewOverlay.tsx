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
 *    Το `aria-label` λέει και την **αιτία** του προβλήματος, με το ίδιο μήνυμα που γράφει η λίστα.
 * 🔑 §5.5.2 Β8 βήμα Β: σε hover **και** εστίαση κάθε πλαίσιο ανοίγει το ΕΝΑ popover της πηγής (`ReviewBoxPopover`: γιατί · τι κάνεις ·
 *    κουμπί) — `aria-haspopup="dialog"` + `aria-expanded`. Το `aria-label` μένει ως έχει, από την ίδια πηγή κειμένου.
 * 🔑 Και **χειριστήριο της σελίδας** (`PDF_PAGE_CONTROL_ATTRIBUTE`): το «χέρι» του viewer δεν πιάνει το ποντίκι πάνω του,
 *    αλλιώς το κλικ πήγαινε στο δοχείο και το πλαίσιο δεν επιλεγόταν (μετρημένο live 2026-11-10).
 * 🔑 §5.5.2 Β8 βήμα Γ: η **ίδια** στρώση ζωγραφίζει και το φάντασμα (`review-ghost-store`) — «από ποιο κελί έρχεται αυτή η τιμή;»
 *    όσο ο δείκτης ή η εστίαση είναι σε «Κράτα «…»». Πάνω από τα πλαίσια, `aria-hidden` (το κουμπί λέει ήδη την τιμή), και **δεν**
 *    πιάνει το ποντίκι: δεν κρύβει ποτέ το πλαίσιο από κάτω.
 */

import React, { useEffect, useRef, type FocusEvent, type KeyboardEvent, type PointerEvent, type SyntheticEvent } from 'react';

import { PDF_PAGE_CONTROL_ATTRIBUTE } from '@/components/file-manager/pdf-viewport-gestures';
import { IMPORT_REVIEW_MARKS, type ReviewMarkGlyph, type ReviewMarkTone } from '@/subapps/catalog/import/review-marks';
import { REVIEW_TONE_KEYS, useImportText } from './import-text';
import { REVIEW_BOX_ATTRIBUTE, useBoxPreviewOpen, type BoxPreviewController } from './review-box-preview';
import { useReviewGhostRegions } from './review-ghost-store';
import { useReviewHoverHandlers, useReviewHovered } from './review-hover-store';
import type { ReviewBox } from './review-overlay-model';
import { useReviewReasonText, useReviewTargetName } from './review-reason-text';

/** Κλάσεις ανά τόνο — κυριολεκτικές, ώστε το Tailwind να τις βρει (το χρώμα ζει στο token, το σχήμα στο `IMPORT_REVIEW_MARKS`). */
const TONE_CLASS: Readonly<Record<ReviewMarkTone, { readonly stroke: string; readonly fill: string }>> = {
  pending: { stroke: 'stroke-paper-mark-pending', fill: 'fill-paper-mark-pending' },
  accepted: { stroke: 'stroke-paper-mark-accepted', fill: 'fill-paper-mark-accepted' },
  problem: { stroke: 'stroke-paper-mark-problem', fill: 'fill-paper-mark-problem' },
  unmapped: { stroke: 'stroke-paper-mark-unmapped', fill: 'fill-paper-mark-unmapped' },
  dismissed: { stroke: 'stroke-paper-mark-dismissed', fill: 'fill-paper-mark-dismissed' },
};

/** Μέγεθος του σήματος γωνίας σε pixels οθόνης. */
const GLYPH_PX = 14;

const GLYPH_PATH: Readonly<Record<Exclude<ReviewMarkGlyph, 'none'>, string>> = {
  check: 'M3.5 7.2 6 9.7l4.5-5',
  alert: 'M7 3.4v4.4M7 10.2v.4',
  cross: 'M4.6 4.6l4.8 4.8M9.4 4.6l-4.8 4.8',
  question: 'M5.2 5.4a1.9 1.9 0 1 1 2.6 1.8c-.5.2-.8.6-.8 1.1v.4M7 10.3v.3',
};

const pct = (fraction: number): string => `${fraction * 100}%`;

/** Δηλώνει το πλαίσιο χειριστήριο της σελίδας — το κλικ του είναι επιλογή, όχι σύρσιμο-χέρι — και πλαίσιο αναθεώρησης για το popover. */
const PAGE_CONTROL = { [PDF_PAGE_CONTROL_ATTRIBUTE]: '', [REVIEW_BOX_ATTRIBUTE]: '' } as const;

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

/**
 * «Κωδικός, MFP-34K1M-Q1AA1, Πρόβλημα: η πηγή δίνει και άλλη τιμή…» (+ «και 3 ακόμη» όταν το πλαίσιο τροφοδοτεί πολλά).
 * Ονομάζει τον **πρώτο** στόχο, δηλαδή αυτόν που έβαψε το πλαίσιο (`buildReviewBoxes` τους ταξινομεί κατά τόνο). Τα λόγια από το
 * **ίδιο** σημείο με το popover και τη λίστα (`review-reason-text`, §5.5.2 Β8 βήμα Β).
 */
function useBoxLabel(box: ReviewBox): string {
  const { t } = useImportText();
  const nameOf = useReviewTargetName();
  const [first] = box.targets;
  const reason = useReviewReasonText(first.reason);
  const parts = { label: nameOf(first), value: first.printed, state: t(REVIEW_TONE_KEYS[box.tone]) };
  const head = reason === null ? t('review.overlay.boxLabel', parts) : t('review.overlay.boxLabelReason', { ...parts, reason });
  return box.targets.length > 1 ? `${head} ${t('review.overlay.boxMore', { count: box.targets.length - 1 })}` : head;
}

interface BoxProps {
  readonly box: ReviewBox;
  readonly selected: boolean;
  readonly onSelect: (box: ReviewBox) => void;
  /** §5.5.2 Β8 βήμα Β: ο ελεγκτής του ΕΝΟΣ popover — `null` = στρώση χωρίς popover (π.χ. σε test). */
  readonly preview: BoxPreviewController | null;
}

/**
 * Τα χειριστήρια του popover σε ένα πλαίσιο: ποντίκι (με καθυστέρηση) · εστίαση (αμέσως) · αφή (ταπ = επιλογή **και** popover,
 * toggletip — η αφή δεν έχει hover) · Tab ⇒ μέσα στο popover. Το hover λίστα ↔ PDF μένει ως είχε.
 */
function useBoxPreviewHandlers(box: ReviewBox, preview: BoxPreviewController | null, keys: readonly string[], onSelect: (box: ReviewBox) => void) {
  const hover = useReviewHoverHandlers(keys);
  const pointerType = useRef<string>('mouse');
  const own = (event: SyntheticEvent<SVGGElement>) => ({ boxId: box.id, element: event.currentTarget });
  useEffect(() => () => preview?.release(box.id), [preview, box.id]);
  return {
    onMouseEnter: hover.onMouseEnter,
    onMouseLeave: hover.onMouseLeave,
    onPointerDown: (event: PointerEvent<SVGGElement>) => { pointerType.current = event.pointerType; },
    onPointerEnter: (event: PointerEvent<SVGGElement>) => { if (event.pointerType === 'mouse') preview?.pointerEnter(own(event)); },
    onPointerLeave: (event: PointerEvent<SVGGElement>) => { if (event.pointerType === 'mouse') preview?.pointerLeave(); },
    onFocus: (event: FocusEvent<SVGGElement>) => { hover.onFocus(); preview?.focusBox(own(event)); },
    onBlur: (event: FocusEvent<SVGGElement>) => { hover.onBlur(); if (!preview?.contains(event.relatedTarget)) preview?.blur(); },
    onClick: (event: React.MouseEvent<SVGGElement>) => {
      onSelect(box);
      if (pointerType.current !== 'mouse') preview?.tap(own(event));
    },
    onKeyDown: (event: KeyboardEvent<SVGGElement>) => {
      if (event.key === 'Tab' && !event.shiftKey && preview?.get()?.boxId === box.id && preview.enterContent()) event.preventDefault();
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      onSelect(box);
    },
  };
}

function ReviewBoxMark({ box, selected, onSelect, preview }: BoxProps) {
  const label = useBoxLabel(box);
  const keys = box.targets.map((entry) => entry.key);
  const hovered = useReviewHovered(keys);
  const handlers = useBoxPreviewHandlers(box, preview, keys, onSelect);
  const expanded = useBoxPreviewOpen(preview, box.id);
  const { region, tone } = box;
  const geometry = { x: pct(region.x), y: pct(region.y), width: pct(region.width), height: pct(region.height) };
  const halo = selected ? 'stroke-paper-mark-selection/70' : hovered ? 'stroke-paper-mark-selection/40' : 'stroke-transparent group-focus-visible:stroke-paper-mark-selection';
  return (
    <g role="button" tabIndex={0} aria-label={label} aria-current={selected ? 'true' : undefined} aria-haspopup="dialog" aria-expanded={preview ? expanded : undefined}
      {...PAGE_CONTROL} className="group pointer-events-auto cursor-pointer outline-none" {...handlers}>
      <rect {...geometry} className={`${selected ? 'fill-paper-mark-selection/20' : 'fill-transparent'} ${halo}`}
        strokeWidth={IMPORT_REVIEW_MARKS.tones[tone].strokePx + 4} vectorEffect="non-scaling-stroke" />
      <ReviewMarkOutline tone={tone} {...geometry} />
      <svg x={pct(region.x + region.width)} y={pct(region.y)} width={GLYPH_PX} height={GLYPH_PX} overflow="visible" aria-hidden="true">
        <g transform={`translate(${-GLYPH_PX / 2} ${-GLYPH_PX / 2})`}><ReviewMarkBadge tone={tone} /></g>
      </svg>
    </g>
  );
}

/** Το φάντασμα **αυτής** της σελίδας: διακεκομμένο περίγραμμα στο χρώμα της επιλογής, ένα ανά περιοχή της άγκυρας. */
function ReviewGhostMarks({ page }: { readonly page: number }) {
  const regions = useReviewGhostRegions(page);
  if (regions === null) return null;
  const { dash, strokePx } = IMPORT_REVIEW_MARKS.ghost;
  return (
    <g aria-hidden="true" className="pointer-events-none">
      {regions.map((region) => (
        <rect key={`${region.x}:${region.y}:${region.width}:${region.height}`} x={pct(region.x)} y={pct(region.y)} width={pct(region.width)} height={pct(region.height)}
          className="fill-paper-mark-selection/10 stroke-paper-mark-selection" strokeWidth={strokePx} strokeDasharray={dash} vectorEffect="non-scaling-stroke" />
      ))}
    </g>
  );
}

interface ImportReviewOverlayProps {
  /** Η σελίδα που φαίνεται — για το φάντασμα, που μπορεί να δείχνει σε άλλη. */
  readonly page: number;
  /** Τα πλαίσια **της σελίδας που φαίνεται**, ήδη ταξινομημένα (`buildReviewBoxes`: περιέκτες πρώτα, σειρά ανάγνωσης). */
  readonly boxes: readonly ReviewBox[];
  readonly selectedKey: string | null;
  /** «Εμφάνιση πλαισίων» κλειστό ⇒ μένει **μόνο** το επιλεγμένο (ποτέ «επέλεξα και δεν βλέπω πού»). */
  readonly showAll: boolean;
  readonly onSelect: (box: ReviewBox) => void;
  /** §5.5.2 Β8 βήμα Β: ο ελεγκτής του ΕΝΟΣ popover της πηγής (`ReviewBoxPopover`, στο `ImportSourcePane`). */
  readonly preview?: BoxPreviewController | null;
}

export function ImportReviewOverlay({ page, boxes, selectedKey, showAll, onSelect, preview = null }: ImportReviewOverlayProps) {
  const { t } = useImportText();
  const isSelected = (box: ReviewBox) => selectedKey !== null && box.targets.some((entry) => entry.key === selectedKey);
  const visible = showAll ? boxes : boxes.filter(isSelected);
  // Η στρώση μένει και χωρίς ορατά πλαίσια («Πλαίσια» κλειστό): το φάντασμα δείχνει την πηγή και τότε.
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" role="group" aria-label={t('review.overlay.layer')}>
      {visible.map((box) => <ReviewBoxMark key={box.id} box={box} selected={isSelected(box)} onSelect={onSelect} preview={preview} />)}
      <ReviewGhostMarks page={page} />
    </svg>
  );
}
