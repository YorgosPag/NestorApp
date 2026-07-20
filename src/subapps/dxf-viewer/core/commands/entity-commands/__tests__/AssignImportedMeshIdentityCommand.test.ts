/**
 * ADR-683 Φ3.1β — AssignImportedMeshIdentityCommand: ανάθεση / αφαίρεση / undo / redo.
 *
 * Το ρίσκο που καρφώνεται εδώ είναι **ασύμμετρο**: η ανάθεση είναι ορατή (εμφανίζεται γραμμή στην
 * προμέτρηση), η **αφαίρεση όχι** — αν αποτύχει σιωπηλά, ο χρήστης βλέπει «ξε-ανατέθηκε» στην οθόνη
 * ενώ η γραμμή κόστους ζει για πάντα. Γι' αυτό τα tests της αφαίρεσης/undo είναι τα περισσότερα.
 */

import type { SceneEntity } from '../../interfaces';
import type {
  ImportedMeshBoqIdentity,
  ImportedMeshParams,
} from '../../../../bim/entities/imported-mesh/imported-mesh-types';
import { createMockSceneManager } from '../../__tests__/mock-scene-manager';
import { AssignImportedMeshIdentityCommand } from '../AssignImportedMeshIdentityCommand';

const IDENTITY: ImportedMeshBoqIdentity = {
  categoryCode: 'OIK-12.1',
  unit: 'm',
  titleEL: 'Κάγκελα μπαλκονιού',
};

const BASE_PARAMS: ImportedMeshParams = {
  kind: 'imported',
  uploadId: 'imesh_upload',
  nodeName: 'Rail_01',
  storagePath: 'projects/p1/imported-meshes/imesh_upload.glb',
  sourceFileName: 'Ισόγειο.glb',
  position: { x: 0, y: 0, z: 0 },
  rotationDeg: 0,
  measuredWidthMm: 2000,
  measuredDepthMm: 100,
  measuredHeightMm: 1000,
  measuredSurfaceAreaM2: 4,
  measuredVolumeM3: null,
  mountingElevationMm: 0,
};

type MeshEntity = SceneEntity & { params: ImportedMeshParams };

function seed(identity?: ImportedMeshBoqIdentity): MeshEntity {
  const params = identity ? { ...BASE_PARAMS, importedMeshIdentity: identity } : BASE_PARAMS;
  return { id: 'mesh-1', type: 'imported-mesh', params } as unknown as MeshEntity;
}

function paramsOf(sm: ReturnType<typeof createMockSceneManager>): ImportedMeshParams | undefined {
  return (sm.store.get('mesh-1') as MeshEntity | undefined)?.params;
}

describe('AssignImportedMeshIdentityCommand — ανάθεση', () => {
  it('γράφει την ταυτότητα στο execute', () => {
    const sm = createMockSceneManager([seed()]);
    new AssignImportedMeshIdentityCommand('mesh-1', IDENTITY, sm).execute();
    expect(paramsOf(sm)?.importedMeshIdentity).toEqual(IDENTITY);
  });

  it('ΔΕΝ αγγίζει τα μετρημένα μεγέθη — η ταυτότητα δεν είναι γεωμετρία (§10.4)', () => {
    const sm = createMockSceneManager([seed()]);
    new AssignImportedMeshIdentityCommand('mesh-1', IDENTITY, sm).execute();
    const params = paramsOf(sm);
    expect(params?.measuredSurfaceAreaM2).toBe(4);
    expect(params?.measuredVolumeM3).toBeNull();
    expect(params?.nodeName).toBe('Rail_01');
  });

  it('undo επαναφέρει το ανανάθετο — και ΣΒΗΝΕΙ το κλειδί, δεν το αφήνει undefined', () => {
    const sm = createMockSceneManager([seed()]);
    const cmd = new AssignImportedMeshIdentityCommand('mesh-1', IDENTITY, sm);
    cmd.execute();
    cmd.undo();
    expect('importedMeshIdentity' in (paramsOf(sm) ?? {})).toBe(false);
  });

  it('redo ξαναγράφει μετά το undo', () => {
    const sm = createMockSceneManager([seed()]);
    const cmd = new AssignImportedMeshIdentityCommand('mesh-1', IDENTITY, sm);
    cmd.execute();
    cmd.undo();
    cmd.redo();
    expect(paramsOf(sm)?.importedMeshIdentity).toEqual(IDENTITY);
  });

  it('επανανάθεση αντικαθιστά — δεν συγχωνεύει δύο ταυτότητες', () => {
    const sm = createMockSceneManager([seed(IDENTITY)]);
    const next: ImportedMeshBoqIdentity = { categoryCode: 'OIK-12.2', unit: 'm', titleEL: 'Κάγκελα σκάλας' };
    new AssignImportedMeshIdentityCommand('mesh-1', next, sm).execute();
    expect(paramsOf(sm)?.importedMeshIdentity).toEqual(next);
  });
});

describe('AssignImportedMeshIdentityCommand — αφαίρεση (η σιωπηλή περίπτωση)', () => {
  it('undefined ΣΒΗΝΕΙ την ταυτότητα → ο lifecycle διαγράφει τη γραμμή BOQ', () => {
    const sm = createMockSceneManager([seed(IDENTITY)]);
    new AssignImportedMeshIdentityCommand('mesh-1', undefined, sm).execute();
    expect('importedMeshIdentity' in (paramsOf(sm) ?? {})).toBe(false);
  });

  it('undo της αφαίρεσης ΕΠΑΝΑΦΕΡΕΙ την ταυτότητα', () => {
    // Χωρίς αυτό, το «κατά λάθος ξε-ανάθεσα» δεν αναιρείται και ο χρήστης ξαναχτίζει τη γραμμή.
    const sm = createMockSceneManager([seed(IDENTITY)]);
    const cmd = new AssignImportedMeshIdentityCommand('mesh-1', undefined, sm);
    cmd.execute();
    cmd.undo();
    expect(paramsOf(sm)?.importedMeshIdentity).toEqual(IDENTITY);
  });

  it('αφαίρεση σε ήδη ανανάθετο = no-op χωρίς εγγραφή στο ιστορικό', () => {
    const sm = createMockSceneManager([seed()]);
    const cmd = new AssignImportedMeshIdentityCommand('mesh-1', undefined, sm);
    cmd.execute();
    cmd.undo();
    expect(paramsOf(sm)).toEqual(BASE_PARAMS);
  });
});

describe('AssignImportedMeshIdentityCommand — φρουρές', () => {
  it('ίδια ταυτότητα = no-op (δεν γεμίζει το undo stack, δεν ξαναγράφει τη γραμμή BOQ)', () => {
    const sm = createMockSceneManager([seed(IDENTITY)]);
    const before = paramsOf(sm);
    new AssignImportedMeshIdentityCommand('mesh-1', { ...IDENTITY }, sm).execute();
    expect(paramsOf(sm)).toBe(before);
  });

  it('ανύπαρκτη οντότητα → αδρανές, χωρίς σφάλμα', () => {
    const sm = createMockSceneManager([seed()]);
    const cmd = new AssignImportedMeshIdentityCommand('λείπει', IDENTITY, sm);
    expect(() => { cmd.execute(); cmd.undo(); }).not.toThrow();
  });

  it('validate απορρίπτει ταυτότητα χωρίς άρθρο ή χωρίς τίτλο', () => {
    const sm = createMockSceneManager([seed()]);
    const noCode = { ...IDENTITY, categoryCode: '' };
    const noTitle = { ...IDENTITY, titleEL: '' };
    expect(new AssignImportedMeshIdentityCommand('mesh-1', noCode, sm).validate()).not.toBeNull();
    expect(new AssignImportedMeshIdentityCommand('mesh-1', noTitle, sm).validate()).not.toBeNull();
    expect(new AssignImportedMeshIdentityCommand('mesh-1', IDENTITY, sm).validate()).toBeNull();
  });

  it('η αφαίρεση περνά το validate — `undefined` είναι έγκυρη εντολή, όχι ελλιπής', () => {
    const sm = createMockSceneManager([seed(IDENTITY)]);
    expect(new AssignImportedMeshIdentityCommand('mesh-1', undefined, sm).validate()).toBeNull();
  });

  it('getAffectedEntityIds αναφέρει το πλέγμα (ώστε να τρέξει το persistence του)', () => {
    const sm = createMockSceneManager([seed()]);
    expect(new AssignImportedMeshIdentityCommand('mesh-1', IDENTITY, sm).getAffectedEntityIds())
      .toEqual(['mesh-1']);
  });
});
