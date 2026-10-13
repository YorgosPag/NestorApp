/**
 * ADR-914 §2.20 — η ρύθμιση ανεβάσματος δένει την κάτοψη στον όροφο που ΑΠΕΙΚΟΝΙΖΕΙ.
 *
 * Το περιστατικό (παραγωγή, 2026-10-13): κάτοψη για το επίπεδο «2ος Όροφος» μιας μεζονέτας
 * γράφτηκε με `linkedTo: floor:<1ος Όροφος>` — τον όροφο του βήματος 4 του οδηγού, δηλαδή τον
 * ΚΥΡΙΟ όροφο του ακινήτου, όχι τον όροφο του επιπέδου που διάλεξε ο άνθρωπος.
 */

import { buildFloorplanUploadConfig } from '../floorplan-upload-config';
import { INITIAL_SELECTION, type FloorplanImportSelection } from '../../hooks/floorplan-import-types';
import { fileLinkTag } from '@/lib/files/file-link-tag';
import { ENTITY_TYPES } from '@/config/domain-constants';

const actor = { uid: 'usr_test', companyId: 'co_test' };

const base: FloorplanImportSelection = {
  ...INITIAL_SELECTION,
  companyId: 'co_test',
  projectId: 'proj_1',
  buildingId: 'bldg_1',
  floorId: 'flr_primary',
  floorName: '1ος Όροφος',
};

const maisonette: FloorplanImportSelection = {
  ...base,
  floorplanType: 'property',
  propertyId: 'prop_maisonette',
  propertyName: 'Μεζονέτα',
};

describe('buildFloorplanUploadConfig — ο όροφος της όψης', () => {
  it('ΤΟ ΠΕΡΙΣΤΑΤΙΚΟ: επίπεδο πολυεπίπεδης μονάδας ⇒ δένεται στον όροφο του ΕΠΙΠΕΔΟΥ, όχι του βήματος 4', () => {
    const config = buildFloorplanUploadConfig(
      { ...maisonette, levelFloorId: 'flr_upper', levelName: '2ος Όροφος' },
      actor,
    );

    expect(config?.levelFloorId).toBe('flr_upper');
    expect(config?.linkedTo).toEqual([
      fileLinkTag(ENTITY_TYPES.FLOOR, 'flr_upper'),
      fileLinkTag(ENTITY_TYPES.BUILDING, 'bldg_1'),
    ]);
    expect(config?.entityLabel).toBe('Μεζονέτα — 2ος Όροφος');
  });

  it('μονοεπίπεδο ακίνητο ⇒ δένεται στον όροφο του βήματος 4, χωρίς `levelFloorId`', () => {
    const config = buildFloorplanUploadConfig(maisonette, actor);

    expect(config).not.toHaveProperty('levelFloorId');
    expect(config?.linkedTo).toEqual([
      fileLinkTag(ENTITY_TYPES.FLOOR, 'flr_primary'),
      fileLinkTag(ENTITY_TYPES.BUILDING, 'bldg_1'),
    ]);
  });

  it('όροφος ⇒ κάτοχος ο όροφος, δεμένος μόνο στο κτίριο', () => {
    const config = buildFloorplanUploadConfig({ ...base, floorplanType: 'floor' }, actor);

    expect(config?.entityType).toBe(ENTITY_TYPES.FLOOR);
    expect(config?.entityId).toBe('flr_primary');
    expect(config?.linkedTo).toEqual([fileLinkTag(ENTITY_TYPES.BUILDING, 'bldg_1')]);
  });

  it('χωρίς στόχο ή χωρίς χρήστη ⇒ null', () => {
    expect(buildFloorplanUploadConfig({ ...base, floorplanType: 'property' }, actor)).toBeNull();
    expect(buildFloorplanUploadConfig(maisonette, null)).toBeNull();
  });
});
