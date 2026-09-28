/**
 * ADR-884 Φ2στ-γ (§4.14 σημεία 1–2) — το πάτωμα του πανοράματος: βελάκια ξαπλωμένα με την προοπτική της κάμερας, κουκκίδα
 * κέρσορα, κλικ ⇒ πλησιέστερη συνδεδεμένη στάση. Κάθε `describe` ονομάζει την απόφαση που φυλάει.
 */

import { degToRad } from '@/lib/geometry/angle';
import { applyHomography, unitSquareToQuad, type PlanePoint } from '@/lib/geometry/css-homography';

import { yawPitchToDirection } from '../tour-cube-faces';
import {
  FLOOR_ARROW_FAR_M, FLOOR_ARROW_NEAR_M, FLOOR_CURSOR_FAR_M, TOUR_EYE_HEIGHT_M, floorArrowWidthPx, floorSpotAngles,
  floorSpotAt, floorSquareCorners, floorSquareMatrix, pickFloorTarget, placeFloorArrows, spreadAngles, type FloorProjector,
  type FloorViewport,
} from '../tour-floor-geometry';
import type { TourView } from '../tour-viewer-view';

const W = 1600;
const H = 900;
const FOV = degToRad(65);

/** Κάμερα με οπή, στο κέντρο, όπως η μηχανή: yaw δεξιόστροφα, κλίση πάνω θετική, οθόνη y προς τα κάτω. */
function pinhole(view: TourView, w: number = W, h: number = H): FloorProjector {
  const f = h / 2 / Math.tan(view.fov / 2);
  return (yaw, pitch) => {
    const d = yawPitchToDirection(yaw - view.yaw, pitch);
    // Κλίση της κάμερας γύρω από τον άξονα X (πάνω = +pitch).
    const cy = Math.cos(-view.pitch);
    const sy = Math.sin(-view.pitch);
    const y = d.y * cy - d.z * sy;
    const z = d.y * sy + d.z * cy;
    if (z >= 0) return null;
    return { x: w / 2 + (f * d.x) / -z, y: h / 2 - (f * y) / -z };
  };
}

const viewport = (view: Partial<TourView> = {}): FloorViewport => ({
  view: { yaw: 0, pitch: 0, fov: FOV, ...view }, aspect: W / H, heightPx: H,
});

describe('floorSpotAt — ένα σημείο της οθόνης κάτω από τον ορίζοντα ΕΙΝΑΙ σημείο του πατώματος', () => {
  it('κλίση −45° ⇒ απόσταση = ύψος ματιού', () => {
    expect(floorSpotAt(0.3, degToRad(-45))?.distance).toBeCloseTo(TOUR_EYE_HEIGHT_M, 9);
  });

  it('πάνω από τον ορίζοντα ή σχεδόν πάνω του ⇒ null (καμία κουκκίδα στον τοίχο/ουρανό)', () => {
    expect(floorSpotAt(0, degToRad(10))).toBeNull();
    expect(floorSpotAt(0, degToRad(-1))).toBeNull();
  });

  it('πιο μακριά από το όριο ⇒ null', () => {
    expect(floorSpotAt(0, -Math.atan2(TOUR_EYE_HEIGHT_M, FLOOR_CURSOR_FAR_M + 1))).toBeNull();
  });

  it('floorSpotAngles είναι το αντίστροφο', () => {
    const spot = floorSpotAt(-0.7, degToRad(-30));
    expect(spot).not.toBeNull();
    if (spot === null) return;
    expect(floorSpotAngles(spot).pitch).toBeCloseTo(degToRad(-30), 9);
  });
});

describe('floorSquareMatrix — η προοπτική βγαίνει από την ίδια την κάμερα', () => {
  const view = { yaw: 0, pitch: degToRad(-10), fov: FOV };
  const project = pinhole(view);
  const spot = { yaw: degToRad(12), distance: 2.4 };

  it('το ΚΕΝΤΡΟ του στοιχείου πέφτει στην προβολή του κέντρου του δίσκου (πάτωμα → οθόνη είναι ομογραφία)', () => {
    const corners = floorSquareCorners(spot, 0.4).map((c) => {
      const a = floorSpotAngles(c);
      return project(a.yaw, a.pitch) as PlanePoint;
    });
    const m = unitSquareToQuad([corners[0] as PlanePoint, corners[1] as PlanePoint, corners[2] as PlanePoint, corners[3] as PlanePoint]);
    const centre = floorSpotAngles(spot);
    const expected = project(centre.yaw, centre.pitch) as PlanePoint;
    expect(m).not.toBeNull();
    if (m === null) return;
    const got = applyHomography(m, 0.5, 0.5);
    expect(got.x).toBeCloseTo(expected.x, 6);
    expect(got.y).toBeCloseTo(expected.y, 6);
  });

  it('η μακρινή πλευρά είναι πιο στενή από την κοντινή (ξαπλωμένο, όχι όρθιο)', () => {
    const [fl, fr, nr, nl] = floorSquareCorners(spot, 0.4).map((c) => {
      const a = floorSpotAngles(c);
      return project(a.yaw, a.pitch) as PlanePoint;
    });
    expect(Math.hypot((fr?.x ?? 0) - (fl?.x ?? 0), (fr?.y ?? 0) - (fl?.y ?? 0)))
      .toBeLessThan(Math.hypot((nr?.x ?? 0) - (nl?.x ?? 0), (nr?.y ?? 0) - (nl?.y ?? 0)));
    expect(fl?.y ?? 0).toBeLessThan(nl?.y ?? 0);
  });

  it('γωνία πίσω από την κάμερα ⇒ null (το κρύβει ο καλών)', () => {
    expect(floorSquareMatrix(spot, 0.4, 100, () => null)).toBeNull();
    expect(floorSquareMatrix(spot, 0.4, 100, project)).toMatch(/^matrix3d\(/);
  });
});

describe('placeFloorArrows — όπως η Zillow: στη βάση, στη σωστή κατεύθυνση', () => {
  it('στόχος μέσα στο κάδρο ⇒ κάθεται ΣΤΗ διόπτευσή του, σεβρόν ίσια, στη ζώνη της βάσης', () => {
    const vp = viewport();
    const placed = placeFloorArrows([{ id: 'a', yaw: degToRad(20) }], vp).get('a');
    expect(placed?.spot.yaw).toBeCloseTo(degToRad(20), 9);
    expect(placed?.turn).toBeCloseTo(0, 9);
    expect(placed?.spot.distance ?? 0).toBeGreaterThanOrEqual(FLOOR_ARROW_NEAR_M);
    expect(placed?.spot.distance ?? 0).toBeLessThanOrEqual(FLOOR_ARROW_FAR_M);
    const angles = floorSpotAngles(placed?.spot ?? { yaw: 0, distance: 1 });
    const screen = pinhole(vp.view)(angles.yaw, angles.pitch);
    expect(screen?.y ?? 0).toBeGreaterThan(H * 0.7);
  });

  it('στόχος ΠΙΣΩ-αριστερά ⇒ στην αριστερή άκρη, σεβρόν στραμμένο προς τα πίσω-αριστερά (το «<» της Zillow)', () => {
    const placed = placeFloorArrows([{ id: 'a', yaw: degToRad(-150) }], viewport()).get('a');
    expect(placed?.spot.yaw ?? 0).toBeLessThan(0);
    expect(Math.abs(placed?.spot.yaw ?? 0)).toBeLessThan(degToRad(60));
    expect(placed?.turn ?? 0).toBeLessThan(degToRad(-90));
  });

  it('ΠΛΑΤΥ παράθυρο (2400×865, ζωντανά 2026-09-28): βελάκι της άκρης στο ΙΔΙΟ ύψος οθόνης με του κέντρου — όχι κομμένο από τη βάση', () => {
    const [w, h] = [2400, 865];
    const vp: FloorViewport = { view: { yaw: 0, pitch: 0, fov: FOV }, aspect: w / h, heightPx: h };
    const placed = placeFloorArrows([{ id: 'centre', yaw: 0 }, { id: 'edge', yaw: degToRad(-170) }], vp);
    const screenY = (id: string) => {
      const p = placed.get(id);
      const a = floorSpotAngles(p?.spot ?? { yaw: 0, distance: 1 });
      return pinhole(vp.view, w, h)(a.yaw, a.pitch)?.y ?? NaN;
    };
    expect(screenY('edge')).toBeCloseTo(screenY('centre'), 6);
    expect(screenY('edge')).toBeLessThan(h * 0.9);
  });

  it('βλέμμα ψηλά (το πάτωμα δεν φαίνεται) ⇒ κανένα βελάκι', () => {
    expect(placeFloorArrows([{ id: 'a', yaw: 0 }], viewport({ pitch: degToRad(45) })).size).toBe(0);
  });

  it('δύο στόχοι στην ίδια διόπτευση ⇒ απλώνονται, δεν επικαλύπτονται', () => {
    const placed = placeFloorArrows([{ id: 'a', yaw: 0.1 }, { id: 'b', yaw: 0.1 }], viewport());
    const a = placed.get('a');
    const b = placed.get('b');
    const gap = Math.abs((a?.spot.yaw ?? 0) - (b?.spot.yaw ?? 0)) * (a?.spot.distance ?? 0);
    expect(gap).toBeGreaterThanOrEqual(2 * (a?.radiusM ?? 0));
  });

  it('το πλάτος οθόνης του δίσκου μένει μέσα στα όρια, όποιο κι αν είναι το ζουμ', () => {
    for (const fov of [degToRad(35), degToRad(65), degToRad(90)]) {
      const vp = viewport({ fov });
      const placed = placeFloorArrows([{ id: 'a', yaw: 0 }], vp).get('a');
      if (placed === undefined) continue;
      const project = pinhole(vp.view);
      // Η μέση γραμμή του δίσκου: ±ακτίνα εγκάρσια, στο βάθος του κέντρου (στόχος στο κέντρο ⇒ yaw 0).
      const side = (s: number) => {
        const ang = floorSpotAngles({ yaw: Math.atan2(s * placed.radiusM, placed.spot.distance), distance: Math.hypot(placed.radiusM, placed.spot.distance) });
        return project(ang.yaw, ang.pitch) as PlanePoint;
      };
      const width = Math.abs(side(1).x - side(-1).x);
      expect(width).toBeCloseTo(floorArrowWidthPx(vp), 6);
    }
  });
});

describe('spreadAngles', () => {
  it('ομάδα που ξεπερνά το δεξί όριο ξαναχωρά μέσα', () => {
    const out = spreadAngles([0.9, 0.9, 0.9], 0.2, 1);
    expect(out[2]).toBeCloseTo(1, 9);
    expect((out[2] ?? 0) - (out[1] ?? 0)).toBeCloseTo(0.2, 9);
  });
});

describe('pickFloorTarget — κλικ στο πάτωμα ⇒ η πλησιέστερη ΣΥΝΔΕΔΕΜΕΝΗ στάση, ποτέ τηλεμεταφορά', () => {
  const candidates = [
    { nodeId: 'near', yaw: degToRad(10), distance: 2 },
    { nodeId: 'far', yaw: degToRad(12), distance: 6 },
    { nodeId: 'side', yaw: degToRad(80), distance: 2 },
  ];

  it('κλικ κοντά ⇒ η κοντινή· κλικ μακριά ⇒ η μακρινή', () => {
    expect(pickFloorTarget({ yaw: degToRad(11), distance: 2.2 }, candidates)).toBe('near');
    expect(pickFloorTarget({ yaw: degToRad(11), distance: 5.5 }, candidates)).toBe('far');
  });

  it('έξω από τον κώνο κάθε στάσης ⇒ null', () => {
    expect(pickFloorTarget({ yaw: degToRad(-120), distance: 2 }, candidates)).toBeNull();
  });

  it('χωρίς γνωστή απόσταση κρίνει η γωνία', () => {
    const blind = [{ nodeId: 'a', yaw: degToRad(5), distance: null }, { nodeId: 'b', yaw: degToRad(30), distance: null }];
    expect(pickFloorTarget({ yaw: degToRad(25), distance: 3 }, blind)).toBe('b');
  });
});
