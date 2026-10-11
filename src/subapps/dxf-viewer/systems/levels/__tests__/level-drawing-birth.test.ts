/**
 * ADR-913 — στόχος γέννησης επιπέδου χωρίς αρχείο + η απόφαση του loader.
 *
 * Εκτελεί τους ΠΡΑΓΜΑΤΙΚΟΥΣ builders (`buildStoragePath`, `generateDeterministicFileId`,
 * `deriveScenePath`) — κανένα mock: ό,τι ελέγχεται εδώ είναι το path που θα γραφτεί.
 */

import { parseStoragePath } from '@/services/upload/utils/storage-path';
import { ownedSaveContext } from '../../../hooks/scene/scene-save-ticket';
import type { DxfSaveContext } from '../../../services/dxf-firestore.types';
import {
  levelDrawingFileId,
  resolveLevelDrawingBirthTarget,
  type DrawingBearingLevel,
} from '../level-drawing-birth';
import { openFileLessLevelTarget, type FileTargetPort } from '../level-file-less-target';

const COMPANY = 'comp_9c7c1a50';

const level = (overrides: Partial<DrawingBearingLevel> = {}): DrawingBearingLevel => ({
  id: 'lvl_blank',
  name: '3ος Όροφος',
  ...overrides,
});

describe('resolveLevelDrawingBirthTarget — ταυτότητα', () => {
  it('ίδιο επίπεδο ⇒ ίδιο αρχείο, σε κάθε κλήση (δύο συνεδρίες συγκλίνουν)', () => {
    const a = resolveLevelDrawingBirthTarget(level({ floorId: 'flr_1' }), COMPANY);
    const b = resolveLevelDrawingBirthTarget(level({ floorId: 'flr_1' }), COMPANY);
    expect(a).toEqual(b);
    expect(a?.fileId).toBe(levelDrawingFileId('lvl_blank'));
  });

  it('διαφορετικό επίπεδο ⇒ διαφορετικό αρχείο, ακόμη και στον ΙΔΙΟ όροφο', () => {
    const a = resolveLevelDrawingBirthTarget(level({ id: 'lvl_a', floorId: 'flr_1' }), COMPANY);
    const b = resolveLevelDrawingBirthTarget(level({ id: 'lvl_b', floorId: 'flr_1' }), COMPANY);
    expect(a?.fileId).not.toBe(b?.fileId);
    expect(a?.saveContext.canonicalScenePath).not.toBe(b?.saveContext.canonicalScenePath);
  });

  it('το context ΑΝΗΚΕΙ στο αρχείο του — το δέχεται ο φρουρός του ticket', () => {
    const target = resolveLevelDrawingBirthTarget(level({ floorId: 'flr_1' }), COMPANY)!;
    expect(ownedSaveContext(target.saveContext, target.fileId)).toBe(target.saveContext);
    expect(target.saveContext.canonicalScenePath).toMatch(new RegExp(`/${target.fileId}\\.scene\\.json$`));
  });

  it('χωρίς εταιρεία δεν υπάρχει κάτοχος ⇒ κανένας στόχος', () => {
    expect(resolveLevelDrawingBirthTarget(level(), null)).toBeNull();
    expect(resolveLevelDrawingBirthTarget(level(), '')).toBeNull();
  });
});

describe('resolveLevelDrawingBirthTarget — η πιο συγκεκριμένη δέσμευση', () => {
  /** Το path όπως το διαβάζει ο ανεκτικός αναγνώστης του συστήματος αρχείων (ADR-709). */
  const parsed = (target: { saveContext: DxfSaveContext } | null) =>
    parseStoragePath(target!.saveContext.canonicalScenePath!.replace(/\.scene\.json$/, '.dxf'));

  it('όροφος: κάτοψη ΟΡΟΦΟΥ, στον φάκελο του ορόφου', () => {
    const target = resolveLevelDrawingBirthTarget(
      level({ floorId: 'flr_1', buildingId: 'bldg_1', projectId: 'proj_1' }),
      COMPANY,
    );
    expect(target?.saveContext).toMatchObject({
      entityType: 'floor', floorId: 'flr_1', buildingId: 'bldg_1', projectId: 'proj_1',
      filesCategory: 'floorplans', purpose: 'floor-floorplan',
    });
    expect(parsed(target)).toMatchObject({
      companyId: COMPANY, entityType: 'floor', entityId: 'flr_1', category: 'floorplans',
    });
  });

  it('κτήριο χωρίς όροφο: κάτοψη ΚΤΗΡΙΟΥ', () => {
    const target = resolveLevelDrawingBirthTarget(level({ buildingId: 'bldg_1' }), COMPANY);
    expect(target?.saveContext).toMatchObject({ entityType: 'building', purpose: 'building-floorplan' });
    expect(parsed(target)).toMatchObject({ entityType: 'building', entityId: 'bldg_1' });
  });

  it('μόνο έργο: κάτοψη ΕΡΓΟΥ', () => {
    const target = resolveLevelDrawingBirthTarget(level({ projectId: 'proj_1' }), COMPANY);
    expect(target?.saveContext).toMatchObject({ entityType: 'project', purpose: 'project-floorplan' });
    expect(parsed(target)).toMatchObject({ entityType: 'project', entityId: 'proj_1' });
  });

  it('αδέσμευτο πρόχειρο: ανήκει στον χώρο εργασίας, ΟΧΙ στις κατόψεις κάποιου ορόφου', () => {
    const target = resolveLevelDrawingBirthTarget(level(), COMPANY);
    expect(target?.saveContext.entityType).toBeUndefined();
    expect(target?.saveContext.filesCategory).toBe('drawings');
    expect(parsed(target)).toMatchObject({ entityType: 'company', entityId: COMPANY, category: 'drawings' });
  });

  it('🔑 επίπεδο ΑΚΙΝΗΤΟΥ με `propertyId` (ADR-914): κάτοψη ΑΚΙΝΗΤΟΥ, στον φάκελο του ακινήτου', () => {
    const target = resolveLevelDrawingBirthTarget(
      level({
        floorplanType: 'unit', propertyId: 'prop_1',
        floorId: 'flr_1', buildingId: 'bldg_1', projectId: 'proj_1',
      }),
      COMPANY,
    );
    // Ο όροφος μένει στο context (κλειδί εμβέλειας BIM) — αλλά ΚΑΤΟΧΟΣ είναι το ακίνητο.
    expect(target?.saveContext).toMatchObject({
      entityType: 'property', floorId: 'flr_1', buildingId: 'bldg_1', projectId: 'proj_1',
      filesCategory: 'floorplans', purpose: 'property-floorplan',
    });
    expect(parsed(target)).toMatchObject({
      companyId: COMPANY, entityType: 'property', entityId: 'prop_1', category: 'floorplans',
    });
  });

  it('επίπεδο ΑΚΙΝΗΤΟΥ χωρίς `propertyId`: κανένας στόχος — ο όροφός του θα το έκανε «κάτοψη ορόφου»', () => {
    expect(
      resolveLevelDrawingBirthTarget(level({ floorplanType: 'unit', floorId: 'flr_1' }), COMPANY),
    ).toBeNull();
  });
});

describe('openFileLessLevelTarget — η απόφαση του loader', () => {
  const port = (overrides: Partial<FileTargetPort> = {}) => {
    const state = { fileRecordId: null as string | null, saveContext: null as DxfSaveContext | null };
    const base: FileTargetPort = {
      get fileRecordId() { return state.fileRecordId; },
      get saveContext() { return state.saveContext; },
      getPendingLevelFileTarget: jest.fn(() => null),
      isFileTargetOrphaned: jest.fn(() => false),
      markFileTargetUnborn: jest.fn(),
      setSaveContext: jest.fn((ctx) => { state.saveContext = ctx; }),
      setCurrentFileName: jest.fn(),
      setFileRecordId: jest.fn((id) => { state.fileRecordId = id; }),
    };
    return Object.assign(base, overrides);
  };

  it('ανοίγει τον στόχο γέννησης ΤΟΥ ΙΔΙΟΥ του επιπέδου', () => {
    const p = port();
    const lvl = level({ floorId: 'flr_1' });
    const birth = resolveLevelDrawingBirthTarget(lvl, COMPANY)!;

    expect(openFileLessLevelTarget(p, lvl, COMPANY)).toBe('keep');
    expect(p.markFileTargetUnborn).toHaveBeenCalledWith(birth.fileId, birth.saveContext);
    expect(p.setCurrentFileName).toHaveBeenCalledWith('3ος Όροφος.dxf');
    expect(p.fileRecordId).toBe(birth.fileId);
  });

  it('ADR-399: αλλαγή επιπέδου ΔΕΝ κληρονομεί τον στόχο του προηγούμενου', () => {
    const p = port();
    const first = level({ id: 'lvl_a', floorId: 'flr_1' });
    const second = level({ id: 'lvl_b', floorId: 'flr_2' });
    openFileLessLevelTarget(p, first, COMPANY);
    const firstFileId = p.fileRecordId;

    openFileLessLevelTarget(p, second, COMPANY);

    expect(p.fileRecordId).not.toBe(firstFileId);
    expect(p.fileRecordId).toBe(levelDrawingFileId('lvl_b'));
    expect(p.saveContext?.floorId).toBe('flr_2');
  });

  it('ίδιος στόχος ήδη ανοιχτός ⇒ καμία επανεγγραφή (όχι churn ανά snapshot)', () => {
    const p = port();
    const lvl = level({ floorId: 'flr_1' });
    openFileLessLevelTarget(p, lvl, COMPANY);
    (p.setFileRecordId as jest.Mock).mockClear();

    expect(openFileLessLevelTarget(p, lvl, COMPANY)).toBe('keep');
    expect(p.setFileRecordId).not.toHaveBeenCalled();
  });

  it('εισαγωγή που περιμένει link: ο στόχος της ΔΕΝ σκεπάζεται από στόχο γέννησης', () => {
    const p = port({ getPendingLevelFileTarget: jest.fn(() => 'file_wizard') });
    p.setFileRecordId('file_wizard');
    (p.setFileRecordId as jest.Mock).mockClear();

    expect(openFileLessLevelTarget(p, level({ floorId: 'flr_1' }), COMPANY)).toBe('keep');
    expect(p.setFileRecordId).not.toHaveBeenCalled();
    expect(p.markFileTargetUnborn).not.toHaveBeenCalled();
  });

  it('εισαγωγή σε εκκρεμότητα αλλά ο στόχος της δεν είναι πια ανοιχτός ⇒ κλείσιμο, όχι γέννηση', () => {
    const p = port({ getPendingLevelFileTarget: jest.fn(() => 'file_wizard') });
    expect(openFileLessLevelTarget(p, level({ floorId: 'flr_1' }), COMPANY)).toBe('reset');
    expect(p.markFileTargetUnborn).not.toHaveBeenCalled();
  });

  it('στόχος γέννησης που κρίθηκε ορφανός/αποσυρμένος μένει κλειστός (ADR-469)', () => {
    const p = port({ isFileTargetOrphaned: jest.fn(() => true) });
    expect(openFileLessLevelTarget(p, level(), COMPANY)).toBe('reset');
    expect(p.setFileRecordId).not.toHaveBeenCalled();
  });

  it('χωρίς επίπεδο ή χωρίς κάτοχο ⇒ κλειστός, όπως πριν', () => {
    expect(openFileLessLevelTarget(port(), undefined, COMPANY)).toBe('reset');
    expect(openFileLessLevelTarget(port(), level(), null)).toBe('reset');
    expect(openFileLessLevelTarget(port(), level({ floorplanType: 'unit' }), COMPANY)).toBe('reset');
  });
});
