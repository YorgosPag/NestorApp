/**
 * ADR-914 §2.10 / §2.11 — **ποιο επίπεδο μιλά για τον όροφο, και τι ξέρει ο διακομιστής.**
 *
 * Τρεις ερωτήσεις που άνοιξε το `propertyId` του επιπέδου:
 *  1. πέντε aggregators έπαιρναν «το πρώτο επίπεδο ανά όροφο» — και μια κάτοψη ακινήτου που
 *     προηγείται στη σειρά έπαιρνε τη θέση ολόκληρου του ορόφου·
 *  2. η διαγραφή της κάτοψης ενός ορόφου καθάριζε και τις κατόψεις ακινήτων του·
 *  3. σε συνεδρία στενεμένη σε κτήριο, ο provisioner ονόμαζε και έψαχνε σε λίστα που δεν
 *     περιείχε την εμβέλεια της δέσμευσης.
 */

import type { AddLevel, Level } from '../config';
import { floorRepresentativeLevels } from '../level-floor-representative';
import { didLevelLoseItsFloorplan } from '../level-floorplan-loss';
import { provisionLevelForBinding, type LevelProvisioner } from '../level-provision';
import { levelFromServerDocument } from '../utils';

const level = (id: string, over: Partial<Level> = {}): Level => ({
  id, name: id, order: 0, isDefault: false, visible: true, buildingId: 'b1', ...over,
});

const unitA1 = level('lvl_unit_a1', { floorId: 'f1', propertyId: 'prop_a1' });
const storey1 = level('lvl_storey_1', { floorId: 'f1' });
const storey2 = level('lvl_storey_2', { floorId: 'f2' });

describe('floorRepresentativeLevels — ένα επίπεδο ανά όροφο', () => {
  it('🔑 το επίπεδο του ορόφου κερδίζει την κάτοψη ακινήτου ΑΚΟΜΗ ΚΙ ΑΝ εκείνη προηγείται', () => {
    const reps = floorRepresentativeLevels([unitA1, storey1, storey2], 'b1');
    expect(reps.map((l) => l.id)).toEqual(['lvl_storey_1', 'lvl_storey_2']);
  });

  it('όροφος που έχει ΜΟΝΟ κάτοψη ακινήτου δεν χάνεται — τον εκπροσωπεί εκείνη', () => {
    expect(floorRepresentativeLevels([unitA1, storey2], 'b1').map((l) => l.id)).toEqual([
      'lvl_unit_a1', 'lvl_storey_2',
    ]);
  });

  it('το ΑΝΟΙΧΤΟ επίπεδο μιλά πάντα για τον όροφό του — εκεί είναι η ζωντανή σκηνή', () => {
    const reps = floorRepresentativeLevels([storey1, unitA1, storey2], 'b1', 'lvl_unit_a1');
    expect(reps.map((l) => l.id)).toEqual(['lvl_unit_a1', 'lvl_storey_2']);
  });

  it('αγνοεί άλλα κτήρια και επίπεδα χωρίς όροφο', () => {
    const elsewhere = level('lvl_other', { floorId: 'f9', buildingId: 'b2' });
    const draft = level('lvl_draft', { buildingId: undefined });
    const buildingPlan = level('lvl_building_plan');

    expect(floorRepresentativeLevels([elsewhere, draft, buildingPlan, storey1], 'b1')).toEqual([storey1]);
  });

  it('δύο επίπεδα ορόφου στον ίδιο όροφο: μένει το πρώτο, όπως πριν', () => {
    const twin = level('lvl_storey_1_twin', { floorId: 'f1' });
    expect(floorRepresentativeLevels([storey1, twin], 'b1')).toEqual([storey1]);
  });
});

describe('didLevelLoseItsFloorplan — η κάτοψη ακινήτου δεν είναι η κάτοψη του ορόφου', () => {
  const floorFileTrashed = { fileId: 'file_floor', entityType: 'floor', entityId: 'f1' };

  it('το επίπεδο του ορόφου χάνει την κάτοψή του', () => {
    expect(didLevelLoseItsFloorplan(storey1, floorFileTrashed)).toBe(true);
  });

  it('🔑 η κάτοψη ακινήτου στον ίδιο όροφο ΔΕΝ καθαρίζεται', () => {
    expect(didLevelLoseItsFloorplan(unitA1, floorFileTrashed)).toBe(false);
  });

  it('η κάτοψη ακινήτου χάνεται μόνο όταν σβηστεί το ΔΙΚΟ της αρχείο', () => {
    const unitWithFile = { ...unitA1, sceneFileId: 'file_unit' };
    expect(didLevelLoseItsFloorplan(unitWithFile, { fileId: 'file_unit', entityType: 'property', entityId: 'prop_a1' }))
      .toBe(true);
  });
});

describe('provisionLevelForBinding — η εμβέλεια του ΔΙΑΚΟΜΙΣΤΗ, όχι η στενεμένη λίστα', () => {
  /** Συνεδρία στενεμένη στο κτήριο b1: η φορτωμένη λίστα δεν περιέχει ό,τι ζει έξω από αυτό. */
  function scopedProvisioner(serverLevels: Level[]) {
    const created: string[] = [];
    const adopted: Level[] = [];
    const asked: Array<string | null> = [];
    const addLevel: AddLevel = async (name) => {
      created.push(name);
      return 'lvl_new';
    };
    const provisioner: LevelProvisioner = {
      levels: [storey1],
      addLevel,
      adoptLevel: (l) => adopted.push(l),
      loadScopeLevels: async (buildingId) => {
        asked.push(buildingId);
        return serverLevels.filter((l) => !buildingId || l.buildingId === buildingId);
      },
    };
    return { provisioner, created, adopted, asked };
  }

  it('🔑 το πρόχειρο παίρνει τον πρώτο αριθμό που είναι ελεύθερος ΣΤΟΝ ΜΙΣΘΩΤΗ', async () => {
    const serverDrafts = [
      level('d1', { name: 'Πρόχειρο 1', buildingId: undefined }),
      level('d2', { name: 'Πρόχειρο 2', buildingId: undefined }),
    ];
    const { provisioner, created, asked } = scopedProvisioner(serverDrafts);

    const result = await provisionLevelForBinding(provisioner, { kind: 'draft', label: 'Πρόχειρο' });

    expect(asked).toEqual([null]);
    expect(created).toEqual(['Πρόχειρο 3']);
    expect(result).toMatchObject({ created: true, name: 'Πρόχειρο 3' });
  });

  it('κάτοψη ΑΛΛΟΥ κτηρίου: το όνομα κρίνεται μέσα σε εκείνο το κτήριο', async () => {
    const inB2 = level('b2_plan', { name: 'Γενική κάτοψη', buildingId: 'b2' });
    const { provisioner, created, asked } = scopedProvisioner([inB2]);

    await provisionLevelForBinding(provisioner, { kind: 'building', buildingId: 'b2', label: 'Γενική κάτοψη' });

    expect(asked).toEqual(['b2']);
    expect(created).toEqual(['Γενική κάτοψη 2']);
  });

  it('🔑 όροφος άλλου κτηρίου που ΕΧΕΙ ήδη επίπεδο: το υιοθετεί, δεν γεννά δεύτερο', async () => {
    const existing = level('lvl_b2_ground', { name: 'Ισόγειο', floorId: 'f_b2', buildingId: 'b2' });
    const { provisioner, created, adopted } = scopedProvisioner([existing]);

    const result = await provisionLevelForBinding(provisioner, {
      kind: 'storey', floorId: 'f_b2', buildingId: 'b2', label: 'Ισόγειο',
    });

    expect(result).toEqual({ levelId: 'lvl_b2_ground', created: false, name: 'Ισόγειο' });
    expect(adopted).toEqual([existing]);
    expect(created).toEqual([]);
  });

  it('ό,τι είναι ήδη στη φορτωμένη λίστα βρίσκεται ΧΩΡΙΣ ερώτηση στον διακομιστή', async () => {
    const { provisioner, asked } = scopedProvisioner([]);

    const result = await provisionLevelForBinding(provisioner, {
      kind: 'storey', floorId: 'f1', buildingId: 'b1', label: '1ος',
    });

    expect(result.levelId).toBe('lvl_storey_1');
    expect(asked).toEqual([]);
  });

  it('αν ο διακομιστής δεν απαντήσει, η δημιουργία προχωρά με ό,τι υπάρχει', async () => {
    const { provisioner, created } = scopedProvisioner([]);
    const failing: LevelProvisioner = { ...provisioner, loadScopeLevels: async () => { throw new Error('offline'); } };

    await provisionLevelForBinding(failing, { kind: 'draft', label: 'Πρόχειρο' });

    expect(created).toEqual(['Πρόχειρο 1']);
  });
});

describe('levelFromServerDocument', () => {
  it('το `null` του διακομιστή γίνεται απουσία· η δέσμευση περνά αυτούσια', () => {
    const fromServer = levelFromServerDocument({
      id: 'lvl_1', name: 'Α1', order: 3, isDefault: false, visible: true, companyId: 'comp_1',
      floorId: 'f1', buildingId: 'b1', projectId: null, propertyId: 'prop_a1',
      sceneFileId: null, sceneFileName: null, floorplanType: 'unit', entityLabel: null,
    });

    expect(fromServer).toMatchObject({
      id: 'lvl_1', name: 'Α1', order: 3, floorId: 'f1', buildingId: 'b1', propertyId: 'prop_a1', floorplanType: 'unit',
    });
    expect(fromServer.projectId).toBeUndefined();
    expect(fromServer.sceneFileId).toBeUndefined();
  });

  it('άγνωστος τύπος κάτοψης δεν περνά ως τύπος', () => {
    const fromServer = levelFromServerDocument({ id: 'x', name: 'x', order: 0, floorplanType: 'elevation' });
    expect(fromServer.floorplanType).toBeUndefined();
  });
});
