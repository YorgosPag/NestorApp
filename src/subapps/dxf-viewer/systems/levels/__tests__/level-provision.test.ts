/**
 * ADR-914 — ο ΕΝΑΣ provisioner επιπέδων.
 *
 * Κλειδώνει: μοναδικό όνομα μέσα στην εμβέλεια του διακομιστή, ιδεμποτία ορόφου, και — το
 * κρίσιμο — ότι η δέσμευση γράφεται ΟΛΟΚΛΗΡΗ στο ένα αίτημα δημιουργίας (κανένα δεύτερο).
 */

import type { AddLevel, Level, LevelBirthBinding } from '../config';
import {
  isStoreyLevelOf,
  provisionLevelForBinding,
  uniqueLevelName,
  type LevelProvisioner,
} from '../level-provision';

function makeLevel(id: string, name: string, extra: Partial<Level> = {}): Level {
  return { id, name, order: 0, isDefault: false, visible: true, ...extra };
}

interface AddCall {
  readonly name: string;
  readonly floorId: string | undefined;
  readonly birth: LevelBirthBinding | undefined;
}

function makeProvisioner(initial: Level[] = []): LevelProvisioner & { calls: AddCall[] } {
  const calls: AddCall[] = [];
  const addLevel: AddLevel = async (name, _setAsDefault, floorId, birth) => {
    calls.push({ name, floorId, birth });
    return `lvl_${calls.length}`;
  };
  return { levels: initial, addLevel, calls };
}

describe('uniqueLevelName', () => {
  it('κρατά τη βάση όταν είναι ελεύθερη', () => {
    expect(uniqueLevelName('Γενική κάτοψη', [])).toBe('Γενική κάτοψη');
  });

  it('προσθέτει τον πρώτο ελεύθερο αριθμό, ξεκινώντας από 2', () => {
    const levels = [makeLevel('a', 'Γενική κάτοψη'), makeLevel('b', 'Γενική κάτοψη 2')];
    expect(uniqueLevelName('Γενική κάτοψη', levels)).toBe('Γενική κάτοψη 3');
  });

  it('συγκρίνει χωρίς διάκριση πεζών/κεφαλαίων, όπως η επικύρωση', () => {
    expect(uniqueLevelName('Πρόχειρο', [makeLevel('a', 'ΠΡΌΧΕΙΡΟ')])).toBe('Πρόχειρο 2');
  });

  it('`numbered` ⇒ αριθμεί πάντα, από το 1', () => {
    expect(uniqueLevelName('Πρόχειρο', [], null, true)).toBe('Πρόχειρο 1');
    expect(uniqueLevelName('Πρόχειρο', [makeLevel('a', 'Πρόχειρο 1')], null, true)).toBe('Πρόχειρο 2');
  });

  it('🔑 με κτήριο, το όνομα συγκρούεται ΜΟΝΟ μέσα στο κτήριο (ο κανόνας του διακομιστή)', () => {
    const levels = [makeLevel('a', 'Κάτοψη', { buildingId: 'b1' })];
    expect(uniqueLevelName('Κάτοψη', levels, 'b2')).toBe('Κάτοψη');
    expect(uniqueLevelName('Κάτοψη', levels, 'b1')).toBe('Κάτοψη 2');
  });

  it('χωρίς κτήριο, συγκρούεται με ΚΑΘΕ επίπεδο του μισθωτή', () => {
    const levels = [makeLevel('a', 'Κάτοψη', { buildingId: 'b1' })];
    expect(uniqueLevelName('Κάτοψη', levels)).toBe('Κάτοψη 2');
  });
});

describe('provisionLevelForBinding — όροφος', () => {
  it('🔑 όροφος, κτήριο, έργο, τύπος και ετικέτα σε ΕΝΑ αίτημα δημιουργίας', async () => {
    const p = makeProvisioner();
    const result = await provisionLevelForBinding(p, {
      kind: 'storey', floorId: 'f1', buildingId: 'b1', projectId: 'p1', label: '1ος Όροφος',
    });

    expect(result).toEqual({ levelId: 'lvl_1', created: true, name: '1ος Όροφος' });
    expect(p.calls).toEqual([{
      name: '1ος Όροφος',
      floorId: 'f1',
      birth: { buildingId: 'b1', projectId: 'p1', floorplanType: 'floor', entityLabel: '1ος Όροφος' },
    }]);
  });

  it('ιδεμποτία: όροφος με επίπεδο επιστρέφεται, δεν ξαναγεννιέται', async () => {
    const p = makeProvisioner([makeLevel('lvl_existing', 'Ισόγειο', { floorId: 'f1', buildingId: 'b1' })]);
    const result = await provisionLevelForBinding(p, {
      kind: 'storey', floorId: 'f1', buildingId: 'b1', label: 'Ισόγειο',
    });

    expect(result).toEqual({ levelId: 'lvl_existing', created: false, name: 'Ισόγειο' });
    expect(p.calls).toHaveLength(0);
  });

  it('ο όροφος κρατά ΑΥΤΟΥΣΙΟ το όνομά του — δεν αριθμείται', async () => {
    const p = makeProvisioner([makeLevel('x', 'Ισόγειο', { buildingId: 'b1' })]);
    await provisionLevelForBinding(p, { kind: 'storey', floorId: 'f9', buildingId: 'b1', label: 'Ισόγειο' });
    expect(p.calls[0].name).toBe('Ισόγειο');
  });

  it('`untyped` ⇒ ούτε τύπος ούτε ετικέτα (συμπεριφορά εισαγωγής / «όλοι οι όροφοι»)', async () => {
    const p = makeProvisioner();
    await provisionLevelForBinding(p, {
      kind: 'storey', floorId: 'f1', buildingId: 'b1', label: 'Ισόγειο', untyped: true,
    });
    expect(p.calls[0].birth).toEqual({ buildingId: 'b1', projectId: undefined });
  });
});

describe('provisionLevelForBinding — κτήριο / έργο / πρόχειρο', () => {
  it('κτήριο: χωρίς όροφο, με μοναδικό όνομα μέσα στο κτήριο', async () => {
    const p = makeProvisioner([makeLevel('a', 'Κτήριο Α', { buildingId: 'b1' })]);
    await provisionLevelForBinding(p, { kind: 'building', buildingId: 'b1', projectId: 'p1', label: 'Κτήριο Α' });

    expect(p.calls).toEqual([{
      name: 'Κτήριο Α 2',
      floorId: undefined,
      birth: { buildingId: 'b1', projectId: 'p1', floorplanType: 'building', entityLabel: 'Κτήριο Α' },
    }]);
  });

  it('έργο: ούτε όροφος ούτε κτήριο', async () => {
    const p = makeProvisioner();
    await provisionLevelForBinding(p, { kind: 'project', projectId: 'p1', label: 'Έργο Χ' });

    expect(p.calls).toEqual([{
      name: 'Έργο Χ',
      floorId: undefined,
      birth: { buildingId: null, projectId: 'p1', floorplanType: 'project', entityLabel: 'Έργο Χ' },
    }]);
  });

  it('πρόχειρο: αριθμημένο, ΧΩΡΙΣ καμία δέσμευση', async () => {
    const p = makeProvisioner([makeLevel('a', 'Πρόχειρο 1')]);
    const result = await provisionLevelForBinding(p, { kind: 'draft', label: 'Πρόχειρο' });

    expect(result.name).toBe('Πρόχειρο 2');
    expect(p.calls).toEqual([{ name: 'Πρόχειρο 2', floorId: undefined, birth: {} }]);
  });

  it('αποτυχία του γραφέα ⇒ `levelId: null`, τίποτα δεν θεωρείται γεννημένο', async () => {
    const p: LevelProvisioner = { levels: [], addLevel: async () => null };
    const result = await provisionLevelForBinding(p, { kind: 'draft', label: 'Πρόχειρο' });
    expect(result).toEqual({ levelId: null, created: false, name: null });
  });
});

describe('provisionLevelForBinding — ακίνητο (ADR-914 Φέτα Γ)', () => {
  const unit = {
    kind: 'property' as const, propertyId: 'prop_1', floorId: 'f1', buildingId: 'b1', projectId: 'p1', label: 'Α1',
  };

  it('🔑 ακίνητο, όροφος, κτήριο, έργο και τύπος `unit` σε ΕΝΑ αίτημα', async () => {
    const p = makeProvisioner();
    await provisionLevelForBinding(p, unit);

    expect(p.calls).toEqual([{
      name: 'Α1',
      floorId: 'f1',
      birth: { buildingId: 'b1', projectId: 'p1', propertyId: 'prop_1', floorplanType: 'unit', entityLabel: 'Α1' },
    }]);
  });

  it('ιδεμποτία ανά (ακίνητο, όροφος): το ίδιο ακίνητο δεν αποκτά δεύτερη κάτοψη στον ίδιο όροφο', async () => {
    const p = makeProvisioner([makeLevel('lvl_u', 'Α1', { propertyId: 'prop_1', floorId: 'f1', buildingId: 'b1' })]);
    const result = await provisionLevelForBinding(p, unit);

    expect(result).toMatchObject({ levelId: 'lvl_u', created: false });
    expect(p.calls).toHaveLength(0);
  });

  it('πολυεπίπεδη μονάδα: άλλος όροφος του ΙΔΙΟΥ ακινήτου ⇒ δικό του επίπεδο', async () => {
    const p = makeProvisioner([makeLevel('lvl_u', 'Α1', { propertyId: 'prop_1', floorId: 'f1', buildingId: 'b1' })]);
    const result = await provisionLevelForBinding(p, { ...unit, floorId: 'f2', label: 'Α1 — Πάνω' });

    expect(result.created).toBe(true);
    expect(p.calls[0].floorId).toBe('f2');
  });

  it('🔑 η κάτοψη ακινήτου ΔΕΝ είναι «το επίπεδο του ορόφου»: ο όροφος γεννά το δικό του', async () => {
    const unitLevel = makeLevel('lvl_u', 'Α1', { propertyId: 'prop_1', floorId: 'f1', buildingId: 'b1' });
    expect(isStoreyLevelOf(unitLevel, 'f1')).toBe(false);

    const p = makeProvisioner([unitLevel]);
    const result = await provisionLevelForBinding(p, {
      kind: 'storey', floorId: 'f1', buildingId: 'b1', label: '1ος Όροφος',
    });
    expect(result.created).toBe(true);
  });
});
