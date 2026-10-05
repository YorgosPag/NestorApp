/**
 * ADR-898 §21.6 Ε6 — **σε ποιο κτίριο επιτρέπεται να πάει ένας χώρος**. Ο επιλογέας της θέσης έδειχνε εννέα κτίρια όλων
 * των έργων, έξι από αυτά αδιάκριτα «Κτήριο Α». Το κατηγόρημα εδώ είναι το ΙΔΙΟ που επιβάλλει ο φρουρός του server.
 */

import {
  buildingOptionsForSpace,
  isBuildingInSpaceProject,
  resolveSpaceProjectId,
  type ScopedBuilding,
} from '../space-building-scope';

const BUILDINGS: ScopedBuilding[] = [
  { id: 'a1', name: 'Κτήριο Α', projectId: 'prj_1' },
  { id: 'a2', name: 'Κτήριο Α', projectId: 'prj_2' },
  { id: 'b1', name: 'Κτήριο Β', projectId: 'prj_1' },
  { id: 'a3', name: 'Κτήριο Α', projectId: 'prj_3' },
  { id: 'x', name: 'Αποθήκη αυλής', projectId: null },
];

const NAMES = new Map([['prj_1', 'ΕΡΓΟ Α'], ['prj_2', 'ΕΡΓΟ Β']]);

function options(space: { projectId?: string | null; buildingId?: string | null }) {
  return buildingOptionsForSpace({ space, buildings: BUILDINGS, projectNames: NAMES, noProjectGroup: 'Χωρίς έργο', locale: 'el' });
}

describe('isBuildingInSpaceProject — ο κανόνας', () => {
  it('χώρος έργου ⇒ μόνο κτίριο του ΙΔΙΟΥ έργου· κτίριο άλλου έργου ή χωρίς έργο ⇒ όχι', () => {
    expect(isBuildingInSpaceProject('prj_1', 'prj_1')).toBe(true);
    expect(isBuildingInSpaceProject('prj_1', 'prj_2')).toBe(false);
    expect(isBuildingInSpaceProject('prj_1', null)).toBe(false);
  });

  it('χώρος χωρίς έργο (και κενό κείμενο) ⇒ ανάθεση, όχι μετακίνηση: κάθε κτίριο', () => {
    expect(isBuildingInSpaceProject(null, 'prj_2')).toBe(true);
    expect(isBuildingInSpaceProject('  ', 'prj_2')).toBe(true);
    expect(isBuildingInSpaceProject(null, null)).toBe(true);
  });
});

describe('resolveSpaceProjectId', () => {
  it('το δικό του έργο· αλλιώς του κτιρίου του· αλλιώς κανένα', () => {
    expect(resolveSpaceProjectId({ projectId: 'prj_2', buildingId: 'a1' }, BUILDINGS)).toBe('prj_2');
    expect(resolveSpaceProjectId({ buildingId: 'b1' }, BUILDINGS)).toBe('prj_1');
    expect(resolveSpaceProjectId({ buildingId: 'x' }, BUILDINGS)).toBeNull();
    expect(resolveSpaceProjectId({}, BUILDINGS)).toBeNull();
  });
});

describe('buildingOptionsForSpace', () => {
  it('θέση έργου ⇒ ΜΟΝΟ τα κτίρια του έργου της, χωρίς ομάδες — τα «Κτήριο Α» των άλλων έργων δεν προσφέρονται', () => {
    expect(options({ projectId: 'prj_1', buildingId: 'b1' })).toEqual([
      { id: 'a1', name: 'Κτήριο Α' },
      { id: 'b1', name: 'Κτήριο Β' },
    ]);
  });

  it('θέση χωρίς δικό της `projectId` ⇒ το έργο του κτιρίου της ορίζει το εύρος', () => {
    expect(options({ buildingId: 'a2' }).map((option) => option.id)).toEqual(['a2']);
  });

  it('το ΤΡΕΧΟΝ κτίριο μένει στη λίστα ακόμη κι αν είναι εκτός έργου — ο επιλογέας δεν δείχνει «τίποτα» για χώρο με κτίριο', () => {
    expect(options({ projectId: 'prj_1', buildingId: 'a3' }).map((option) => option.id)).toEqual(['a1', 'a3', 'b1']);
  });

  it('χώρος χωρίς έργο ⇒ ΟΛΑ, ομαδοποιημένα ανά έργο· άγνωστο όνομα έργου ⇒ το id· «Χωρίς έργο» τελευταίο', () => {
    expect(options({})).toEqual([
      { id: 'a1', name: 'Κτήριο Α', group: 'ΕΡΓΟ Α' },
      { id: 'b1', name: 'Κτήριο Β', group: 'ΕΡΓΟ Α' },
      { id: 'a2', name: 'Κτήριο Α', group: 'ΕΡΓΟ Β' },
      { id: 'a3', name: 'Κτήριο Α', group: 'prj_3' },
      { id: 'x', name: 'Αποθήκη αυλής', group: 'Χωρίς έργο' },
    ]);
  });

  it('κάθε επιλογή χώρου με έργο περνά το κατηγόρημα του server (εκτός από το τρέχον κτίριο)', () => {
    const offered = options({ projectId: 'prj_1', buildingId: 'b1' });
    for (const option of offered) {
      const building = BUILDINGS.find((candidate) => candidate.id === option.id);
      expect(isBuildingInSpaceProject('prj_1', building?.projectId ?? null)).toBe(true);
    }
  });
});
