/**
 * ADR-913 §2 — άδεια σκηνή ≠ ορφανό αρχείο.
 *
 * ΤΟ ΣΕΝΑΡΙΟ ΤΗΣ ΖΗΜΙΑΣ (2026-11-15): όροφος «ΔΟΚΙΜΗ Κτήριο Β · 2ος», `file_2b45ad70` με `entities: []` ⇒ latch
 * «ορφανό» ⇒ στόχος auto-save κλειστός όλη τη συνεδρία ⇒ καμία νέα γραμμή δεν σωζόταν, άρα το αρχείο έμενε άδειο.
 * Εδώ κλειδώνεται ο πίνακας αποφάσεων (fail-closed) και η εφαρμογή του πάνω στη θύρα του auto-save manager.
 */

import {
  classifyMissingLevelScene,
  settleMissingLevelScene,
  type MissingSceneContext,
  type MissingSceneTargetPort,
} from '../level-missing-scene';
import type { StorageSceneLoad, StoredSceneFile } from '../../../services/dxf-scene-storage-load';
import type { Timestamp } from 'firebase/firestore';

const SCENE_FILE = 'file_2b45ad70';
const FLOOR = 'flr_681579ae';
const SOURCE = `companies/c/entities/floor/${FLOOR}/domains/construction/categories/floorplans/files/${SCENE_FILE}.dxf`;

const file = (extra: Partial<StoredSceneFile> = {}): StoredSceneFile => ({
  id: SCENE_FILE,
  fileName: '2ος Όροφος.dxf',
  lastModified: {} as Timestamp,
  version: 3,
  storagePath: SOURCE,
  companyId: 'comp_1',
  entityType: 'floor',
  entityId: FLOOR,
  retired: false,
  ...extra,
});

const empty = (extra: Partial<StoredSceneFile> = {}): StorageSceneLoad => ({
  kind: 'absent',
  reason: 'empty',
  file: file(extra),
});

describe('classifyMissingLevelScene — μόνο αποδεδειγμένα άδειο αρχείο του ορόφου ανοίγει', () => {
  it('υπαρκτό, άδειο, του ορόφου ⇒ open-empty', () => {
    expect(classifyMissingLevelScene(empty(), FLOOR)).toBe('open-empty');
  });

  it.each<[string, StorageSceneLoad]>([
    ['λείπει το FileRecord', { kind: 'absent', reason: 'no-record' }],
    ['χωρίς πηγή σκηνής', { kind: 'absent', reason: 'no-source' }],
    ['αδιάβαστο (δίκτυο/άκυρο)', { kind: 'absent', reason: 'unreadable', file: file() }],
    ['άδειο αλλά αποσυρμένο', empty({ retired: true })],
    ['άδειο αλλά χωρίς storagePath', empty({ storagePath: undefined })],
    ['άδειο αλλά άλλου ορόφου', empty({ entityId: 'flr_other' })],
    ['empty χωρίς FileRecord', { kind: 'absent', reason: 'empty' }],
  ])('%s ⇒ orphaned (ADR-469 όπως πριν)', (_label, load) => {
    expect(classifyMissingLevelScene(load, FLOOR)).toBe('orphaned');
  });

  it('άγνωστος όροφος επιπέδου ⇒ ο cross-floor κριτής δεν αποφαίνεται ⇒ open-empty', () => {
    expect(classifyMissingLevelScene(empty(), null)).toBe('open-empty');
  });
});

function harness() {
  const port: Required<MissingSceneTargetPort> = {
    markFileTargetOrphaned: jest.fn(),
    setFileRecordId: jest.fn(),
    setCurrentFileName: jest.fn(),
    setSaveContext: jest.fn(),
    setPersistedDxfBaseline: jest.fn(),
  };
  const ctx: MissingSceneContext = {
    sceneFileId: SCENE_FILE,
    levelFloorId: FLOOR,
    levelFileName: 'από-το-επίπεδο.dxf',
    resetTarget: jest.fn(),
    setEmptyScene: jest.fn(),
    markLevelLoaded: jest.fn(),
  };
  return { port, ctx };
}

describe('settleMissingLevelScene — εφαρμογή', () => {
  beforeEach(() => jest.spyOn(console, 'warn').mockImplementation(() => undefined));
  afterEach(() => jest.restoreAllMocks());

  it('άδειο αρχείο ⇒ στόχος ΑΝΟΙΧΤΟΣ: καμία latch, κανένα reset, baseline 0, όνομα + context του αρχείου', () => {
    const { port, ctx } = harness();
    expect(settleMissingLevelScene(empty(), port, ctx)).toBe('open-empty');
    expect(port.markFileTargetOrphaned).not.toHaveBeenCalled();
    expect(ctx.resetTarget).not.toHaveBeenCalled();
    expect(port.setPersistedDxfBaseline).toHaveBeenCalledWith(SCENE_FILE, 0);
    expect(port.setFileRecordId).toHaveBeenCalledWith(SCENE_FILE);
    expect(port.setCurrentFileName).toHaveBeenCalledWith('2ος Όροφος.dxf');
    expect(port.setSaveContext).toHaveBeenCalledWith(
      expect.objectContaining({ fileRecordId: SCENE_FILE, floorId: FLOOR, companyId: 'comp_1' }),
    );
    expect(ctx.setEmptyScene).toHaveBeenCalledTimes(1);
    expect(ctx.markLevelLoaded).toHaveBeenCalledTimes(1);
  });

  it('άδειο αρχείο χωρίς όνομα ⇒ εφεδρεία στο sceneFileName του επιπέδου', () => {
    const { port, ctx } = harness();
    settleMissingLevelScene(empty({ fileName: '' }), port, ctx);
    expect(port.setCurrentFileName).toHaveBeenCalledWith('από-το-επίπεδο.dxf');
  });

  it('ορφανό ⇒ latch + reset + άδεια σκηνή, ΚΑΝΕΝΑ άνοιγμα στόχου', () => {
    const { port, ctx } = harness();
    expect(settleMissingLevelScene({ kind: 'absent', reason: 'no-record' }, port, ctx)).toBe('orphaned');
    expect(port.markFileTargetOrphaned).toHaveBeenCalledWith(SCENE_FILE);
    expect(ctx.resetTarget).toHaveBeenCalledTimes(1);
    expect(ctx.setEmptyScene).toHaveBeenCalledTimes(1);
    expect(port.setFileRecordId).not.toHaveBeenCalled();
    expect(port.setPersistedDxfBaseline).not.toHaveBeenCalled();
    expect(ctx.markLevelLoaded).not.toHaveBeenCalled();
  });

  it('αδιάβαστο (σφάλμα δικτύου) ⇒ latch — ποτέ baseline 0 πάνω από γεωμετρία που δεν κατέβηκε', () => {
    const { port, ctx } = harness();
    settleMissingLevelScene({ kind: 'absent', reason: 'unreadable', file: file() }, port, ctx);
    expect(port.markFileTargetOrphaned).toHaveBeenCalledWith(SCENE_FILE);
    expect(port.setPersistedDxfBaseline).not.toHaveBeenCalled();
  });
});
