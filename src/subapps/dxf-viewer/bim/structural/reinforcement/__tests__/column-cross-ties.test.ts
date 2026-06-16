/**
 * ADR-456 Slice 2 — column CROSS-TIES geometry SSoT tests: hybrid strategy
 * (διαμάντι για 1-ανά-πλευρά, ευθύγραμμα ties για πολλαπλές ενδιάμεσες), hooks,
 * centerline length, degenerate guards.
 */

import {
  buildColumnCrossTies,
  crossTieCenterlineLengthMm,
} from '../column-cross-ties';
import { computeColumnRebarLayout } from '../column-rebar-layout';
import type { ColumnReinforcement } from '../column-reinforcement-types';

function reinforcement(count: number): ColumnReinforcement {
  return {
    longitudinal: { diameterMm: 16, count },
    stirrups: { diameterMm: 8, spacingMm: 200, spacingCriticalMm: 100 },
    coverMm: 30,
  };
}

/**
 * Ράβδοι (local mm) για διατομή width×depth και **ακριβές** πλήθος — περνάμε huge
 * maxBarSpacing ώστε να ΜΗΝ ενεργοποιηθεί το code-driven densification (ADR-460 f7),
 * για να ελέγχουμε τη λογική των cross-ties με ελεγχόμενη διάταξη (4/8/16 ράβδοι).
 */
function bars(count: number, w = 600, d = 600) {
  return computeColumnRebarLayout(reinforcement(count), w, d, Number.MAX_SAFE_INTEGER)!.longitudinalBarsMm;
}

describe('buildColumnCrossTies — hybrid strategy', () => {
  it('≤4 ράβδοι (μόνο γωνίες) → κανένα cross-tie', () => {
    expect(buildColumnCrossTies(bars(4), 8, 16)).toHaveLength(0);
  });

  it('8 ράβδοι (1 ενδιάμεση ανά πλευρά) → ΕΝΑ κλειστό διαμάντι', () => {
    const ties = buildColumnCrossTies(bars(8), 8, 16);
    expect(ties).toHaveLength(1);
    expect(ties[0].closed).toBe(true);
    // Στρογγυλεμένο διαμάντι → περισσότερα σημεία από τις 4 κορυφές.
    expect(ties[0].pathMm.length).toBeGreaterThan(4);
    expect(ties[0].hookEndsMm).toHaveLength(2);
  });

  it('πολλές ενδιάμεσες ανά πλευρά → S ανοιχτά ties (ΕΝΑ συνεχές polyline)', () => {
    const ties = buildColumnCrossTies(bars(16), 8, 16);
    expect(ties.length).toBeGreaterThan(1);
    expect(ties.every((t) => !t.closed)).toBe(true);
    for (const t of ties) {
      expect(t.pathMm.length).toBeGreaterThan(4); // τόξα τυλίγματος + σώμα + ουρές, όλα μαζί
      expect(t.hookEndsMm).toHaveLength(0); // ενσωματωμένα στο path
    }
  });

  it('degenerate dbw → κανένα cross-tie', () => {
    expect(buildColumnCrossTies(bars(8), 0, 16)).toHaveLength(0);
  });
});

/** Το tie με το μεγαλύτερο εύρος σε άξονα `axis` (κατακόρυφο=y / οριζόντιο=x). */
function widestTie(ties: ReturnType<typeof buildColumnCrossTies>, axis: 'x' | 'y') {
  const span = (t: (typeof ties)[number]) => {
    const v = t.pathMm.map((p) => p[axis]);
    return Math.max(...v) - Math.min(...v);
  };
  return ties.reduce((best, t) => (span(t) > span(best) ? t : best));
}

describe('S cross-tie — σχήμα, αγκάλιασμα ράβδων, ουρές προς τα μέσα (EC8)', () => {
  it('κατακόρυφο S: φτάνει στις δύο παρειές, σώμα με κλίση, ουρές προς τα μέσα', () => {
    const b = bars(16, 600, 600);
    const halfDb = Math.max(...b.map((p) => Math.abs(p.y)));
    const vert = widestTie(buildColumnCrossTies(b, 8, 16, 'grid'), 'y');
    const ys = vert.pathMm.map((p) => p.y);
    const xs = vert.pathMm.map((p) => p.x);
    expect(Math.min(...ys)).toBeLessThan(-halfDb * 0.8); // αγκαλιάζει κάτω σίδερο
    expect(Math.max(...ys)).toBeGreaterThan(halfDb * 0.8); // αγκαλιάζει πάνω σίδερο
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(0); // σώμα με κλίση (διασχίζει)
    // Άκρα (ουρές) ΜΕΣΑ στο σώμα της κολώνας, όχι στην παρειά → προς τα μέσα.
    expect(Math.abs(vert.pathMm[0].y)).toBeLessThan(halfDb);
    expect(Math.abs(vert.pathMm[vert.pathMm.length - 1].y)).toBeLessThan(halfDb);
  });

  it('το S έχει σημείο καμπής → οι δύο γάντζοι αντίθετης φοράς (δεξιό/αριστερόστροφος)', () => {
    const vert = widestTie(buildColumnCrossTies(bars(16, 800, 800), 8, 16, 'grid'), 'y');
    const p = vert.pathMm;
    const signs = new Set<number>();
    for (let i = 1; i < p.length - 1; i++) {
      const u = { x: p[i].x - p[i - 1].x, y: p[i].y - p[i - 1].y };
      const v = { x: p[i + 1].x - p[i].x, y: p[i + 1].y - p[i].y };
      const c = u.x * v.y - u.y * v.x;
      if (Math.abs(c) > 1e-9) signs.add(Math.sign(c));
    }
    expect(signs.size).toBe(2); // και θετική και αρνητική στροφή → καμπή «S»
  });
});

describe('buildColumnCrossTies — manual pattern override', () => {
  it("'grid' εξαναγκάζει ευθύγραμμα ties ακόμα και σε 8 ράβδους (auto θα έδινε διαμάντι)", () => {
    const auto = buildColumnCrossTies(bars(8), 8, 16, 'auto');
    const grid = buildColumnCrossTies(bars(8), 8, 16, 'grid');
    expect(auto[0].closed).toBe(true); // auto → διαμάντι
    expect(grid.every((t) => !t.closed)).toBe(true); // grid → ευθύγραμμα
    expect(grid.length).toBeGreaterThan(0);
  });

  it("'diamond' εξαναγκάζει κλειστό διαμάντι σε πολλές ενδιάμεσες (auto θα έδινε πλέγμα)", () => {
    const auto = buildColumnCrossTies(bars(16), 8, 16, 'auto');
    const diamond = buildColumnCrossTies(bars(16), 8, 16, 'diamond');
    expect(auto.every((t) => !t.closed)).toBe(true); // auto → πλέγμα
    expect(diamond).toHaveLength(1);
    expect(diamond[0].closed).toBe(true); // diamond → ένα κλειστό στεφάνι
  });

  it("'auto' (default) = υβριδικό: διαμάντι για 8, πλέγμα για 16", () => {
    expect(buildColumnCrossTies(bars(8), 8, 16, 'auto')[0].closed).toBe(true);
    expect(buildColumnCrossTies(bars(16), 8, 16, 'auto').every((t) => !t.closed)).toBe(true);
  });
});

describe('crossTieCenterlineLengthMm', () => {
  it('ανοιχτό S tie: μήκος > ευθεία απόσταση άκρων (περιλαμβάνει τόξα+ουρές)', () => {
    const s = buildColumnCrossTies(bars(12, 800, 400), 8, 16).find((t) => !t.closed)!;
    const endToEnd = Math.hypot(
      s.pathMm[0].x - s.pathMm[s.pathMm.length - 1].x,
      s.pathMm[0].y - s.pathMm[s.pathMm.length - 1].y,
    );
    expect(crossTieCenterlineLengthMm(s)).toBeGreaterThan(endToEnd);
  });

  it('κλειστό διαμάντι: μήκος > 0 (path + γάντζοι κλεισίματος)', () => {
    const ties = buildColumnCrossTies(bars(8), 8, 16);
    expect(crossTieCenterlineLengthMm(ties[0])).toBeGreaterThan(0);
  });
});
