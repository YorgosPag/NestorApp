/**
 * `projectPointOnAxis` — SSoT along/perp προβολή σημείου σε άξονα (ADR-493· canonical
 * core του entity wrapper `projectColumnCenterOnAxis`).
 */

import { projectPointOnAxis, projectPolygonOnAxis } from '../polygon-utils';

describe('projectPointOnAxis', () => {
  it('σημείο πάνω στον άξονα → perp=0, along=απόσταση', () => {
    const p = projectPointOnAxis(300, 0, 0, 0, 1, 0); // άξονας +X από origin
    expect(p.along).toBeCloseTo(300, 9);
    expect(p.perp).toBeCloseTo(0, 9);
  });

  it('κάθετη μετατόπιση → perp>0 (απόλυτη), along=διαμήκης', () => {
    const p = projectPointOnAxis(200, 125, 0, 0, 1, 0);
    expect(p.along).toBeCloseTo(200, 9);
    expect(p.perp).toBeCloseTo(125, 9); // |κάθετη| ανεξάρτητα πρόσημου
  });

  it('αντίθετη διεύθυνση άξονα → ίδιο |perp|, αντίθετο along', () => {
    const fwd = projectPointOnAxis(200, 125, 0, 0, 1, 0);
    const rev = projectPointOnAxis(200, 125, 0, 0, -1, 0);
    expect(rev.along).toBeCloseTo(-fwd.along, 9);
    expect(rev.perp).toBeCloseTo(fwd.perp, 9);
  });

  it('λοξός άξονας (45°) → προβολή με μοναδιαίο διάνυσμα', () => {
    const u = Math.SQRT1_2; // (1,1)/√2
    const p = projectPointOnAxis(10, 0, 0, 0, u, u);
    expect(p.along).toBeCloseTo(10 * u, 9);
    expect(p.perp).toBeCloseTo(10 * u, 9);
  });
});

describe('projectPolygonOnAxis (ADR-494 SSoT — polygon-on-axis έκταση)', () => {
  // Τετράγωνο που ΔΕΝ τέμνει τον άξονα +X (όλο πάνω από y=100).
  const above = [
    { x: 0, y: 100 }, { x: 200, y: 100 }, { x: 200, y: 300 }, { x: 0, y: 300 },
  ];
  // Τετράγωνο που ΤΕΜΝΕΙ τον άξονα +X (κορυφές εκατέρωθεν y=0).
  const straddling = [
    { x: 0, y: -100 }, { x: 200, y: -100 }, { x: 200, y: 100 }, { x: 0, y: 100 },
  ];

  it('διαμήκης έκταση [alongMin, alongMax] = προβολή κορυφών στον άξονα', () => {
    const r = projectPolygonOnAxis(above, 0, 0, 1, 0);
    expect(r.alongMin).toBeCloseTo(0, 9);
    expect(r.alongMax).toBeCloseTo(200, 9);
  });

  it('πολύγωνο εξ ολοκλήρου από τη μία πλευρά → perpMin/perpMax ομόσημα (δεν τέμνει)', () => {
    // Σύμβαση cross: signedPerp = (v−a)×u· για άξονα +X → −y. Το `above` (y∈[100,300]) → [−300,−100].
    const r = projectPolygonOnAxis(above, 0, 0, 1, 0);
    expect(r.perpMin).toBeCloseTo(-300, 9);
    expect(r.perpMax).toBeCloseTo(-100, 9);
    expect(r.perpMin < 0 && r.perpMax < 0).toBe(true); // ομόσημα → καμία τομή
    expect(Math.min(Math.abs(r.perpMin), Math.abs(r.perpMax))).toBeCloseTo(100, 9); // απόσταση από ευθεία
  });

  it('πολύγωνο εκατέρωθεν → perpMin<0<perpMax (τέμνει την ευθεία)', () => {
    const r = projectPolygonOnAxis(straddling, 0, 0, 1, 0);
    expect(r.perpMin).toBeCloseTo(-100, 9);
    expect(r.perpMax).toBeCloseTo(100, 9);
    expect(r.perpMin < 0 && r.perpMax > 0).toBe(true); // straddle
  });

  it('άδειο polygon → όλα 0 (μηδέν crash)', () => {
    expect(projectPolygonOnAxis([], 0, 0, 1, 0)).toEqual({ alongMin: 0, alongMax: 0, perpMin: 0, perpMax: 0 });
  });
});
