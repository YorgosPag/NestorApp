/**
 * ADR-884 Φ1 — η σύμβαση των έξι όψεων, το GLSL δίδυμό της, και η κάτοψη βόρεια-πάνω.
 *
 * 🔑 Ο shader **δεν** εκτελείται σε jsdom· γι' αυτό η άγκυρα διαβάζει τους **έξι κλάδους** του κειμένου GLSL και απαιτεί να
 * είναι λέξη προς λέξη οι κλάδοι του `directionToCubeFace`. Ένα πρόσημο που αλλάζει μόνο στο ένα ⇒ κόκκινο.
 */

import { degToRad } from '@/lib/geometry/angle';
import {
  TOUR_FACE_UNIFORM, TOUR_PANORAMA_FRAGMENT_SHADER,
} from '@/components/spatial-tour/viewer/tour-panorama-shader';

import {
  TOUR_CUBE_FACES, cubeFaceUvToDirection, directionToCubeFace, directionToYawPitch, yawPitchToDirection,
} from '../tour-cube-faces';
import { PLAN_CONE_RADIUS_M, PLAN_MIN_SPAN_M, conePath, planFrame, toPlanSvg } from '../tour-viewer-plan';

const round = (n: number) => Math.round(n * 1e6) / 1e6;

describe('όψεις κύβου — η αντιστροφή κλείνει', () => {
  it.each(TOUR_CUBE_FACES)('%s: uv → κατεύθυνση → uv', (face) => {
    for (const [u, v] of [[0.5, 0.5], [0.1, 0.8], [0.9, 0.2]]) {
      const back = directionToCubeFace(cubeFaceUvToDirection(face, u, v));
      expect([back.face, round(back.u), round(back.v)]).toEqual([face, u, v]);
    }
  });

  it('yaw 0 = κέντρο της front· yaw +90° = κέντρο της right (δεξιόστροφα)· πάνω = up', () => {
    const at = (yaw: number, pitch = 0) => {
      const hit = directionToCubeFace(yawPitchToDirection(degToRad(yaw), degToRad(pitch)));
      return [hit.face, round(hit.u), round(hit.v)];
    };
    expect(at(0)).toEqual(['front', 0.5, 0.5]);
    expect(at(90)).toEqual(['right', 0.5, 0.5]);
    expect(at(180)).toEqual(['back', 0.5, 0.5]);
    expect(at(-90)).toEqual(['left', 0.5, 0.5]);
    expect(at(0, 90)[0]).toBe('up');
  });

  it('συνέχεια στις ραφές: λίγο αριστερά από yaw 45° ⇒ δεξιά άκρη της front, λίγο δεξιά ⇒ αριστερή άκρη της right', () => {
    const before = directionToCubeFace(yawPitchToDirection(degToRad(44.9), 0));
    const after = directionToCubeFace(yawPitchToDirection(degToRad(45.1), 0));
    expect([before.face, before.u > 0.99]).toEqual(['front', true]);
    expect([after.face, after.u < 0.01]).toEqual(['right', true]);
  });
});

describe('GLSL δίδυμο — οι έξι κλάδοι είναι οι ίδιοι με το directionToCubeFace', () => {
  const branches = [...TOUR_PANORAMA_FRAGMENT_SHADER.matchAll(/texture2D\((face\w+), toUv\(([^)]*)\)\)/g)]
    .map((m) => [m[1], m[2].replace(/\s+/g, '')]);

  it('κάθε όψη έχει ακριβώς έναν κλάδο με τα ορίσματα της αυθεντίας', () => {
    expect(Object.fromEntries(branches)).toEqual({
      [TOUR_FACE_UNIFORM.right]: 'd.z,d.y,m.x',
      [TOUR_FACE_UNIFORM.left]: '-d.z,d.y,m.x',
      [TOUR_FACE_UNIFORM.up]: 'd.x,d.z,m.y',
      [TOUR_FACE_UNIFORM.down]: 'd.x,-d.z,m.y',
      [TOUR_FACE_UNIFORM.front]: 'd.x,d.y,m.z',
      [TOUR_FACE_UNIFORM.back]: '-d.x,d.y,m.z',
    });
  });

  it('ο κλάδος κάθε όψης δίνει ΤΟ ΙΔΙΟ uv με την αυθεντία (εκτελεσμένο σε JS)', () => {
    const glslUv = (args: string, d: { x: number; y: number; z: number }) => {
      const m = { x: Math.abs(d.x), y: Math.abs(d.y), z: Math.abs(d.z) };
      const [a, b, s] = args.split(',').map((expr) => {
        const neg = expr.startsWith('-');
        const [obj, key] = expr.replace('-', '').split('.') as ['d' | 'm', 'x' | 'y' | 'z'];
        return (neg ? -1 : 1) * (obj === 'd' ? d : m)[key];
      });
      return [round((a / s + 1) / 2), round((b / s + 1) / 2)];
    };
    for (const face of TOUR_CUBE_FACES) {
      const d = cubeFaceUvToDirection(face, 0.2, 0.7);
      const args = branches.find(([uniform]) => uniform === TOUR_FACE_UNIFORM[face])?.[1] ?? '';
      expect(glslUv(args, d)).toEqual([0.2, 0.7]);
    }
  });
});

describe('κάτοψη — βόρεια-πάνω, κώνος προς τα πάνω πριν την περιστροφή', () => {
  it('βορράς = −y στο SVG, ανατολή = +x', () => {
    expect(toPlanSvg({ x: 2, y: 3, z: 0 })).toEqual({ x: 2, y: -3 });
  });

  it('κάδρο: χωρά όλους με περιθώριο· ελάχιστη πλευρά· κενό ⇒ null', () => {
    const f = planFrame([{ x: 0, y: 0, z: 0 }, { x: 10, y: 4, z: 0 }]);
    expect(f !== null && f.minX < 0 && f.minX + f.width > 10 && f.minY < -4 && f.minY + f.height > 0).toBe(true);
    expect(planFrame([{ x: 1, y: 1, z: 0 }])?.width).toBe(PLAN_MIN_SPAN_M);
    expect(planFrame([])).toBeNull();
  });

  it('ο κώνος χωρά ΟΛΟΚΛΗΡΟΣ γύρω από κάθε κόμβο, και στη γωνία (ζωντανή παρατήρηση 2026-09-27: κοβόταν)', () => {
    const points = [{ x: 0, y: 0, z: 0 }, { x: 4, y: 0, z: 0 }, { x: 4, y: 3, z: 0 }, { x: 0, y: 3, z: 0 }];
    const f = planFrame(points);
    for (const p of points.map(toPlanSvg)) {
      expect(f !== null && p.x - PLAN_CONE_RADIUS_M >= f.minX && p.x + PLAN_CONE_RADIUS_M <= f.minX + f.width).toBe(true);
      expect(f !== null && p.y - PLAN_CONE_RADIUS_M >= f.minY && p.y + PLAN_CONE_RADIUS_M <= f.minY + f.height).toBe(true);
    }
  });

  it('ο κώνος ανοίγει προς −y (πάνω) — το rotate(διόπτευση) του SVG τον στρέφει δεξιόστροφα', () => {
    const [, , , , leftX, leftY] = conePath(degToRad(45), 1).split(' ');
    expect(Number(leftY)).toBeLessThan(0);
    expect(Number(leftX)).toBeLessThan(0);
  });
});

describe('yaw/κλίση ⇄ κατεύθυνση — το σύρσιμο βελακιού (Φ2δ · §4.10)', () => {
  it.each([[0, 0], [90, 0], [-90, 10], [179, -20], [-135, 45], [30, -85]])('yaw %d° κλίση %d° ⇒ επιστρέφει ίδιο', (yaw, pitch) => {
    const back = directionToYawPitch(yawPitchToDirection(degToRad(yaw), degToRad(pitch)));
    expect(round(back.yaw)).toBe(round(degToRad(yaw)));
    expect(round(back.pitch)).toBe(round(degToRad(pitch)));
  });

  it('δεξιά = θετικό yaw (+X), μήκος αδιάφορο — η ακτίνα της κάμερας δεν είναι μοναδιαία', () => {
    expect(round(directionToYawPitch({ x: 5, y: 0, z: 0 }).yaw)).toBe(round(Math.PI / 2));
    expect(round(directionToYawPitch({ x: 0, y: 0, z: -7 }).yaw)).toBe(0);
  });
});
