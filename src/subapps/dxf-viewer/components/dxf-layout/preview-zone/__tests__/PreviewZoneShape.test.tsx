/**
 * @jest-environment jsdom
 *
 * ADR-911 Φ3β — το κοινό primitive ζώνης προεπισκόπησης.
 *
 * Τρεις ισχυρισμοί που κανένας τύπος δεν φυλάει:
 *   1. Οι τόνοι ξεχωρίζουν ΚΑΙ χωρίς χρώμα (μοτίβο γραμμής ανά δύο διαφορετικό) — WCAG 1.4.1.
 *   2. Το μοτίβο φτάνει όντως ως το τελικό SVG (έλεγχος ραφής, όχι λογικής).
 *   3. Πολλά κομμάτια = ΜΙΑ ετικέτα, στο μεγαλύτερο.
 */

import React from 'react';
import { render } from '@testing-library/react';
import { PreviewZoneShape } from '../PreviewZoneShape';
import { pointsCentroid, screenPointsToSvgPath, worldRingToSvgPath } from '../world-ring-path';
import {
  PREVIEW_ZONE_PAINT_ORDER,
  PREVIEW_ZONE_STYLE,
  type PreviewZoneTone,
} from '../../../../systems/region-preview/preview-zone-style';
import { CoordinateTransforms } from '../../../../rendering/core/CoordinateTransforms';
import type { Point2D, ViewTransform, Viewport } from '../../../../rendering/types/Types';

const transform: ViewTransform = { scale: 0.1, offsetX: 40, offsetY: 25 };
const viewport = { width: 800, height: 600 } as unknown as Viewport;

const TONES = Object.keys(PREVIEW_ZONE_STYLE) as PreviewZoneTone[];

function rect(x: number, y: number, w: number, h: number): Point2D[] {
  return [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }];
}

function renderZone(props: Partial<React.ComponentProps<typeof PreviewZoneShape>> = {}) {
  return render(
    <svg>
      <PreviewZoneShape
        pieces={[rect(0, 0, 1000, 200)]}
        tone="accept"
        transform={transform}
        viewport={viewport}
        {...props}
      />
    </svg>,
  );
}

describe('preview-zone-style — οι τόνοι ξεχωρίζουν χωρίς χρώμα', () => {
  it('κάθε ζεύγος τόνων έχει διαφορετικό μοτίβο γραμμής', () => {
    const dashes = TONES.map((tone) => PREVIEW_ZONE_STYLE[tone].dash ?? 'solid');
    expect(new Set(dashes).size).toBe(TONES.length);
  });

  it('κάθε ζεύγος τόνων έχει και διαφορετικό χρώμα', () => {
    expect(new Set(TONES.map((tone) => PREVIEW_ZONE_STYLE[tone].stroke)).size).toBe(TONES.length);
  });

  it('η σειρά ζωγραφικής περιέχει κάθε τόνο ακριβώς μία φορά', () => {
    expect([...PREVIEW_ZONE_PAINT_ORDER].sort()).toEqual([...TONES].sort());
  });

  it('ό,τι θέλει προσοχή ζωγραφίζεται τελευταίο: «υπάρχει» πρώτο, «απορρίφθηκε» από πάνω', () => {
    expect(PREVIEW_ZONE_PAINT_ORDER[0]).toBe('existing');
    expect(PREVIEW_ZONE_PAINT_ORDER[PREVIEW_ZONE_PAINT_ORDER.length - 1]).toBe('reject');
  });

  it('γέμισμα έχουν ΜΟΝΟ οι τόνοι που αποφασίζουν τι θα γραφτεί· το «υπάρχει» είναι το λεπτότερο', () => {
    // Απόλυτοι ισχυρισμοί: το it.each παρακάτω συγκρίνει το SVG με τον ΙΔΙΟ τον πίνακα, άρα
    // δεν βλέπει αλλαγή ΜΕΣΑ στον πίνακα.
    const filled = TONES.filter((tone) => PREVIEW_ZONE_STYLE[tone].fillOpacity > 0);
    expect([...filled].sort()).toEqual(['accept', 'reject']);
    const otherWidths = TONES.filter((tone) => tone !== 'existing').map((tone) => PREVIEW_ZONE_STYLE[tone].strokeWidth);
    expect(PREVIEW_ZONE_STYLE.existing.strokeWidth).toBeLessThan(Math.min(...otherWidths));
  });
});

describe('PreviewZoneShape — το λεξιλόγιο φτάνει στο SVG', () => {
  it.each(TONES)('τόνος «%s»: χρώμα, πάχος, μοτίβο και γέμισμα από το SSoT', (tone) => {
    const { container } = renderZone({ tone });
    const path = container.querySelector('path');
    const style = PREVIEW_ZONE_STYLE[tone];
    expect(path?.getAttribute('stroke')).toBe(style.stroke);
    expect(path?.getAttribute('stroke-width')).toBe(String(style.strokeWidth));
    expect(path?.getAttribute('stroke-dasharray')).toBe(style.dash);
    expect(path?.getAttribute('fill')).toBe(style.fillOpacity > 0 ? style.stroke : 'none');
    expect(container.querySelector('g')?.getAttribute('data-tone')).toBe(tone);
  });

  it('η εστίαση παχαίνει τη γραμμή χωρίς να αλλάζει τόνο', () => {
    const plain = renderZone({ tone: 'decide' }).container.querySelector('path');
    const focused = renderZone({ tone: 'decide', focused: true }).container.querySelector('path');
    expect(Number(focused?.getAttribute('stroke-width'))).toBeGreaterThan(Number(plain?.getAttribute('stroke-width')));
    expect(focused?.getAttribute('stroke')).toBe(plain?.getAttribute('stroke'));
    expect(focused?.getAttribute('stroke-dasharray')).toBe(plain?.getAttribute('stroke-dasharray'));
  });

  it('το path είναι η προβολή του SSoT μετασχηματισμού, κλειστό', () => {
    const ring = rect(100, 200, 1000, 200);
    const { container } = renderZone({ pieces: [ring] });
    const first = CoordinateTransforms.worldToScreen(ring[0], transform, viewport);
    const d = container.querySelector('path')?.getAttribute('d') ?? '';
    expect(d.startsWith(`M${first.x.toFixed(1)},${first.y.toFixed(1)}`)).toBe(true);
    expect(d.endsWith(' Z')).toBe(true);
    expect(d).toBe(worldRingToSvgPath(ring, transform, viewport));
  });
});

describe('PreviewZoneShape — κομμάτια ανά τοίχο', () => {
  const small = rect(0, 0, 300, 200);
  const large = rect(700, 0, 2000, 200);

  it('δύο κομμάτια = δύο paths και ΜΙΑ ετικέτα, στο μεγαλύτερο', () => {
    const { container } = renderZone({ pieces: [small, large], label: '3.00 × 0.20 m' });
    expect(container.querySelectorAll('path')).toHaveLength(2);
    const texts = container.querySelectorAll('text');
    expect(texts).toHaveLength(1);
    const anchor = pointsCentroid(large.map((p) => CoordinateTransforms.worldToScreen(p, transform, viewport)));
    expect(Number(texts[0].getAttribute('x'))).toBeCloseTo(anchor.x, 6);
    expect(Number(texts[0].getAttribute('y'))).toBeCloseTo(anchor.y, 6);
    expect(texts[0].textContent).toBe('3.00 × 0.20 m');
  });

  it('η σειρά των κομματιών δεν μετακινεί την ετικέτα', () => {
    const a = renderZone({ pieces: [small, large], label: 'x' }).container.querySelector('text');
    const b = renderZone({ pieces: [large, small], label: 'x' }).container.querySelector('text');
    expect(a?.getAttribute('x')).toBe(b?.getAttribute('x'));
  });

  it('κενή ετικέτα ⇒ κανένα <text>· ο λόγος γίνεται <title> σε κάθε κομμάτι', () => {
    const { container } = renderZone({ pieces: [small, large], tone: 'reject', title: 'Πολύ κοντός' });
    expect(container.querySelectorAll('text')).toHaveLength(0);
    expect([...container.querySelectorAll('title')].map((n) => n.textContent)).toEqual(['Πολύ κοντός', 'Πολύ κοντός']);
  });

  it('εκφυλισμένα κομμάτια αγνοούνται· κανένα ζωγραφίσιμο ⇒ τίποτα', () => {
    const degenerate: Point2D[] = [{ x: 0, y: 0 }, { x: 1, y: 1 }];
    expect(renderZone({ pieces: [degenerate, large] }).container.querySelectorAll('path')).toHaveLength(1);
    expect(renderZone({ pieces: [degenerate] }).container.querySelector('g')).toBeNull();
  });
});

describe('world-ring-path', () => {
  it('ανοιχτό path δεν κλείνει με Z', () => {
    expect(screenPointsToSvgPath([{ x: 0, y: 0 }, { x: 10, y: 5.26 }], false)).toBe('M0.0,0.0 L10.0,5.3');
  });

  it('κέντρο βάρους κενής εισόδου = αρχή των αξόνων (όχι NaN)', () => {
    expect(pointsCentroid([])).toEqual({ x: 0, y: 0 });
  });
});
