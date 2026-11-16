/**
 * ⚓ ADR-929 §6.22 — η μετρική της σύντηξης ανά διεύθυνση (`fusion-metric.ts`) και ο λύτης πάνω σε **ανισοτροπική**
 * βαθμονόμηση.
 *
 * 🔴 Το περιστατικό: η βαθμονόμηση λύνει χωριστή κλίμακα X/Y και τοποθετεί την εικόνα σωστά· η σύντηξη τη συνέπτυσσε σε
 * γεωμετρικό μέσο και ο λύτης **ξαναμετακινούσε** τις παρειές (ΤΕΣΤ2: 2,05000 → 2,05048 · 4,12000 → 4,11903 μετά το
 * «Κράτησε»). Η άγκυρα: εικόνα τεντωμένη κατά X, βαθμονόμηση που το ξέρει ⇒ **καμία** παρειά δεν κινείται και κάθε
 * διάσταση βγαίνει **ακριβώς** η γραμμένη.
 */

import { describe, expect, it } from '@jest/globals';
import { IDENTITY_AFFINE, type Affine2x3 } from '@/lib/geometry/affine-2x3';
import { applyHomography, homographyJacobian, homographyLocalScale, quadToQuad, rectQuad } from '@/lib/geometry/homography';
import { familyNormal } from '../fusion-frame';
import { familyPxPerMm, isotropicMetric, metricFromOriginal, pxPerMmAcross, scaledMetric } from '../fusion-metric';
import { fusePlan } from '../plan-fusion';
import type { RasterSegment } from '../../plan-recognition-types';
import { KNOWN_SCALE, ORIGIN_PX, fusionInput, houseDimensions, houseSegments, reading } from './fusion-fixture';

const read = (r: ReturnType<typeof reading>) => ({ status: 'read' as const, reading: r });
const frameWith = (j: Affine2x3) => ({ alignedToOriginalJacobian: j });
const HORIZONTAL = familyNormal({ id: 0, angleRad: 0 }); // ευθείες οριζόντιες ⇒ μετρούν κατά Y
const VERTICAL = familyNormal({ id: 1, angleRad: Math.PI / 2 }); // ευθείες κατακόρυφες ⇒ μετρούν κατά X

/** Ωμή απόσταση στον κόσμο δύο παράλληλων ευθειών `n·p = c₁, c₂` υπό τον τελεστή `A` (χωρίς τη δυϊκή νόρμα). */
function worldGapMm(a: Affine2x3, angleRad: number, c1: number, c2: number): number {
  const n = { x: -Math.sin(angleRad), y: Math.cos(angleRad) };
  const u = { x: Math.cos(angleRad), y: Math.sin(angleRad) };
  const map = (p: { x: number; y: number }) => ({ x: a.a * p.x + a.c * p.y, y: a.b * p.x + a.d * p.y });
  const d = map({ x: n.x * (c2 - c1), y: n.y * (c2 - c1) });
  const along = map(u);
  return Math.abs(d.x * along.y - d.y * along.x) / Math.hypot(along.x, along.y);
}

describe('homographyJacobian — ο ΕΝΑΣ υπολογισμός της Ιακωβιανής', () => {
  const h = quadToQuad(rectQuad(100, 80), [{ x: 3, y: 5 }, { x: 110, y: -4 }, { x: 96, y: 91 }, { x: -6, y: 77 }]);

  it('√|det J| ≡ homographyLocalScale (η κλίμακα είναι σύνοψη της Ιακωβιανής, όχι δεύτερη παραγώγιση)', () => {
    if (h === null) throw new Error('fixture');
    const j = homographyJacobian(h, 40, 30);
    expect(j).not.toBeNull();
    if (j === null) return;
    expect(Math.sqrt(Math.abs(j.a * j.d - j.b * j.c))).toBeCloseTo(homographyLocalScale(h, 40, 30) ?? 0, 12);
  });

  it('συμφωνεί με κεντρικές διαφορές (στήλες = ∂/∂u, ∂/∂v, σημασιολογία ctx.transform)', () => {
    if (h === null) throw new Error('fixture');
    const j = homographyJacobian(h, 40, 30);
    const e = 1e-4;
    const du = [applyHomography(h, 40 + e, 30), applyHomography(h, 40 - e, 30)];
    const dv = [applyHomography(h, 40, 30 + e), applyHomography(h, 40, 30 - e)];
    expect(j?.a).toBeCloseTo((du[0].x - du[1].x) / (2 * e), 6);
    expect(j?.b).toBeCloseTo((du[0].y - du[1].y) / (2 * e), 6);
    expect(j?.c).toBeCloseTo((dv[0].x - dv[1].x) / (2 * e), 6);
    expect(j?.d).toBeCloseTo((dv[0].y - dv[1].y) / (2 * e), 6);
  });
});

describe('fusion-metric — px/mm ανά διεύθυνση', () => {
  it('ισοτροπική πηγή ⇒ ίδια τιμή σε κάθε διεύθυνση (η παλιά συμπεριφορά ως ειδική περίπτωση)', () => {
    const m = isotropicMetric(20);
    for (const angle of [0, 0.3, Math.PI / 2, 2.1]) {
      expect(pxPerMmAcross(m, familyNormal({ id: 9, angleRad: angle }))).toBeCloseTo(1 / 20, 12);
    }
  });

  it('ανισοτροπική βαθμονόμηση: οι οριζόντιες ευθείες μετρούν με το Y, οι κατακόρυφες με το X', () => {
    const m = metricFromOriginal(8.836207, 8.831726, frameWith(IDENTITY_AFFINE));
    expect(pxPerMmAcross(m, HORIZONTAL)).toBeCloseTo(1 / 8.831726, 12);
    expect(pxPerMmAcross(m, VERTICAL)).toBeCloseTo(1 / 8.836207, 12);
    // Η βαθμωτή σύνοψη μένει ο γεωμετρικός μέσος — ίδια τιμή με πριν για εμβαδά και έλεγχο συνέπειας.
    expect(m.mmPerAlignedPx).toBeCloseTo(Math.sqrt(8.836207 * 8.831726), 12);
  });

  it('λοξή οικογένεια + μη ομοιότητα Ιακωβιανή ⇒ η δυϊκή νόρμα |A⁻ᵀn| δίνει την ωμή απόσταση στον κόσμο', () => {
    const shearRot: Affine2x3 = { a: 0.97, b: 0.21, c: -0.15, d: 1.04, e: 0, f: 0 };
    const m = metricFromOriginal(9, 7.5, frameWith(shearRot));
    for (const angle of [0, Math.PI / 2, 0.52, 2.4]) {
      const n = familyNormal({ id: 9, angleRad: angle });
      expect(37 / pxPerMmAcross(m, n)).toBeCloseTo(worldGapMm(m.linear, angle, 12, 49), 9);
    }
  });

  it('scaledMetric αλλάζει μόνο το μέγεθος: ο λόγος X/Y μένει', () => {
    const m = metricFromOriginal(9, 7.5, frameWith(IDENTITY_AFFINE));
    const s = scaledMetric(m, 4);
    expect(s.mmPerAlignedPx).toBeCloseTo(4, 12);
    expect(pxPerMmAcross(s, VERTICAL) / pxPerMmAcross(s, HORIZONTAL)).toBeCloseTo(7.5 / 9, 12);
  });

  it('familyPxPerMm ρωτά τις οικογένειες του πλαισίου', () => {
    const m = metricFromOriginal(10, 8, frameWith(IDENTITY_AFFINE));
    const of = familyPxPerMm(m, { families: [{ id: 0, angleRad: 0 }, { id: 1, angleRad: Math.PI / 2 }] });
    expect(of(0)).toBeCloseTo(1 / 8, 12);
    expect(of(1)).toBeCloseTo(1 / 10, 12);
  });
});

describe('🔴 plan-fusion — ανισοτροπική βαθμονόμηση: ο λύτης ΔΕΝ ξαναχαλά ό,τι διόρθωσε η βαθμονόμηση', () => {
  /**
   * Σαρωτής που τεντώνει την εικόνα κατά X, γύρω από την αρχή του δείγματος: 0,05 % — η ανισοτροπία που **μετρήθηκε** στο
   * ΤΕΣΤ2 (0,0507 %). Ο παλιός λύτης θα έδινε ±1,6 mm στα 6,25 m και θα μετακινούσε παρειές ~0,08 px: ≫ των ορίων εδώ.
   */
  const SX = 1.0005;
  const stretchX = (x: number): number => ORIGIN_PX + (x - ORIGIN_PX) * SX;
  const stretchSegment = (s: RasterSegment): RasterSegment => ({
    ...s, start: { x: stretchX(s.start.x), y: s.start.y }, end: { x: stretchX(s.end.x), y: s.end.y },
  });

  function stretchedHouse() {
    const { texts, dimensions } = houseDimensions();
    const stretchedTexts = texts.map((t) => ({ ...t, rect: { ...t.rect, minX: stretchX(t.rect.minX), maxX: stretchX(t.rect.maxX) } }));
    // Η βαθμονόμηση ξέρει το τέντωμα: λιγότερα μέτρα ανά pixel κατά X (`calibration-solve`, `per-axis`).
    const knownScale = { ...KNOWN_SCALE, metresPerPixelX: KNOWN_SCALE.metresPerPixelX / SX };
    return fusePlan(fusionInput({
      segments: houseSegments().map(stretchSegment), reading: read(reading({ texts: stretchedTexts, dimensions })), knownScale,
    }));
  }

  it('κάθε διάσταση: μετρημένη και συνορθωμένη = η γραμμένη (≪ 0,1 mm), όλες συνεπείς', () => {
    const r = stretchedHouse();
    expect(r.scale?.chosen).toBe('known-calibration');
    expect(r.dimensions.map((d) => d.status)).toEqual(['consistent', 'consistent', 'consistent', 'consistent', 'consistent']);
    for (const d of r.dimensions) {
      expect(Math.abs((d.measuredMm ?? Infinity) - d.valueMm)).toBeLessThan(1e-3);
      expect(Math.abs((d.adjustedMm ?? Infinity) - d.valueMm)).toBeLessThan(1e-3);
    }
  });

  it('καμία παρειά δεν μετακινείται: η συνορθωμένη θέση = η παρατηρημένη («Κράτησε» = ό,τι έδειξε η βαθμονόμηση)', () => {
    const r = stretchedHouse();
    expect(r.adjustedOffsetPx.size).toBeGreaterThan(0);
    for (const line of r.faceLines) {
      const adjusted = r.adjustedOffsetPx.get(line.id);
      if (adjusted !== undefined) expect(Math.abs(adjusted - line.offsetPx)).toBeLessThan(1e-6);
    }
    expect(r.questions.map((q) => q.kind)).not.toContain('face-displaced');
  });
});
