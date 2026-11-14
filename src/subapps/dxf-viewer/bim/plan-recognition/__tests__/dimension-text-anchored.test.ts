/**
 * ADR-929 §6.19 — **αγκυρωμένη** διακοπή από κείμενο: δύο κοντά κομμάτια στην ίδια ευθεία, ο αριθμός στη μέση ενός κενού
 * πολύ μεγαλύτερου από 8 ύψη (κάλυψη < 40%), και ισχυρή απόληξη στα **εξωτερικά** άκρα. Το στυλ του ΤΕΣΤ2 (κενό 341 px,
 * ύψος κειμένου 27 px, κάλυψη 23%), που ο κανόνας της κάλυψης απέρριπτε. Καθαρό: ευθυγραμμισμένα px, χωρίς εικόνα.
 */

import { describe, expect, it } from '@jest/globals';
import { IDENTITY_HOMOGRAPHY } from '@/lib/geometry/homography';
import type { Glyph } from '@/lib/geometry/raster/text-graphics';
import { textEvidence, type TextScale } from '../classify/dimension-text';
import { framedSegments } from '../classify/segment-frame';
import type { RasterSegment } from '../plan-recognition-types';

const seg = (id: string, x0: number, x1: number, y = 100): RasterSegment => ({
  id, start: { x: x0, y }, end: { x: x1, y }, style: 'stroke', strokeWidthPx: 3, confidence: { score: 1, factors: { geometry: 1 } },
});

/** «2.05» στη μέση του κενού, πάνω στην ευθεία: τρεις γλύφοι 27 px. */
const VALUE: Glyph[] = [1120, 1140, 1165].map((cx) => ({ cx, cy: 100, width: 16, height: 27, area: 200 }));
const LEFT = seg('L', 898, 970);
const RIGHT = seg('R', 1311, 1382);

const scale = (strong: ReadonlySet<string>): TextScale => ({
  textPx: 27, strokePx: 3, endZonePx: 30, strongEnd: (id, which) => strong.has(`${id}:${which}`),
});

const evidence = (segments: readonly RasterSegment[], strong: ReadonlySet<string>) =>
  textEvidence(framedSegments(segments, IDENTITY_HOMOGRAPHY), VALUE, scale(strong));

describe('textEvidence — αγκυρωμένη διακοπή (§6.19)', () => {
  it('ΤΟ ΣΕΝΑΡΙΟ: βέλη στα δύο εξωτερικά άκρα ⇒ τα δύο κομμάτια διακόπτονται από τον αριθμό', () => {
    const ev = evidence([LEFT, RIGHT], new Set(['L:start', 'R:end']));
    expect([...ev.interrupted].sort()).toEqual(['L', 'R']);
  });

  it('χωρίς απολήξεις ⇒ τίποτα: το μεγάλο, αραιά καλυμμένο κενό μένει άνοιγμα (π.χ. πόρτα)', () => {
    expect(evidence([LEFT, RIGHT], new Set()).interrupted.size).toBe(0);
  });

  it('απόληξη στα ΕΣΩΤΕΡΙΚΑ άκρα μόνο ⇒ τίποτα (η άγκυρα είναι το έξω άκρο)', () => {
    expect(evidence([LEFT, RIGHT], new Set(['L:end', 'R:start'])).interrupted.size).toBe(0);
  });

  it('το δεξί κομμάτι ανάποδα σχεδιασμένο: το εξωτερικό του άκρο είναι το `start`', () => {
    const reversed = seg('R', 1382, 1311);
    const ev = evidence([LEFT, reversed], new Set(['L:start', 'R:start']));
    expect([...ev.interrupted].sort()).toEqual(['L', 'R']);
  });

  it('σχεδιαστικό τμήμα ανάμεσα ⇒ ΟΧΙ: δένει μόνο ο πρώτος γείτονας (όχι διαστάσεις αλυσίδας μεταξύ τους)', () => {
    const between = seg('M', 1000, 1080);
    const ev = evidence([LEFT, between, RIGHT], new Set(['L:start', 'R:end']));
    expect(ev.links.some((l) => l.a === 'L' && l.b === 'R')).toBe(false);
  });
});
