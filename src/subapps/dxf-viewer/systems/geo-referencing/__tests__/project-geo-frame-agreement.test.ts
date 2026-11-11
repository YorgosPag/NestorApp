/**
 * ADR-937 §3.1 — άγκυρα: το `lib/geo/project-geo-frame` λέει ΟΤΙ ΚΑΙ ο μετασχηματισμός που βλέπει ο χρήστης.
 *
 * Το φύλλο είναι η ΜΙΑ ερμηνεία του `Project.northRotation` για όσους ζουν έξω από τον σχεδιαστή (εξαγωγέας
 * IFC). Αυτό το test ζει **μέσα** στο subapp, ώστε η σύγκριση με το `forwardRigidMap` να μη χρειάζεται εισαγωγή
 * που περνά το σύνορο (CHECK 3.62). Αν κάποιος αλλάξει τη σύμβαση στη μία πλευρά μόνο, κοκκινίζει εδώ.
 */

import { forwardRigidMap, inverseRigidMap, mapX, mapY } from '../geo-transform';
import { geoReferenceFromProject } from '../geo-reference-schema';
import { projectGeoFrame, projectXAxisInWorld, trueNorthInProject } from '@/lib/geo/project-geo-frame';

const ROTATIONS = [0, 12, 45, 90, 180, -30, 270];

describe('ADR-937 §3.1 · project-geo-frame ≡ geo-transform', () => {
  it.each(ROTATIONS)('r = %p°: ο άξονας +X του έργου στον κόσμο', (r) => {
    const m = forwardRigidMap({ originWorld: { x: 0, y: 0 }, rotationDeg: r });
    const [ex, ey] = projectXAxisInWorld(r);
    expect(mapX(m, 1, 0)).toBeCloseTo(ex, 12);
    expect(mapY(m, 1, 0)).toBeCloseTo(ey, 12);
  });

  it.each(ROTATIONS)('r = %p°: ο αληθινός Βορράς στο έργο', (r) => {
    const m = inverseRigidMap({ originWorld: { x: 0, y: 0 }, rotationDeg: r });
    const [ex, ey] = trueNorthInProject(r);
    expect(mapX(m, 0, 1)).toBeCloseTo(ex, 12);
    expect(mapY(m, 0, 1)).toBeCloseTo(ey, 12);
  });

  it('η ανάγνωση των πεδίων είναι ΜΙΑ: το geoReferenceFromProject είναι το φύλλο σε mm', () => {
    const fields = { basePoint: { x: 384_500, y: 4_201_200, z: 2 }, northRotation: 15 };
    const frame = projectGeoFrame(fields)!;
    expect(geoReferenceFromProject(fields)).toEqual({
      originWorld: { x: frame.eastingM * 1000, y: frame.northingM * 1000 },
      rotationDeg: frame.northRotationDeg,
    });
    expect(projectGeoFrame({ basePoint: { z: 2 }, northRotation: 15 })).toBeNull();
    expect(geoReferenceFromProject({ basePoint: { z: 2 }, northRotation: 15 })).toBeNull();
  });
});
