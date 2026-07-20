/**
 * ADR-683 Φ3.1γ — `groupImportedMeshesByUpload` / `totalUnassigned`.
 *
 * Καρφώνει τα δύο πράγματα που το πάνελ **υπόσχεται** και που ένα screenshot δεν αποδεικνύει:
 * ότι η εκκρεμότητα ανεβαίνει στην κορυφή, και ότι το πλήθος του badge είναι το πραγματικό.
 */

import {
  groupImportedMeshesByUpload,
  totalUnassigned,
  type ImportedMeshListEntityLike,
} from '../imported-mesh-panel-rows';
import type { ImportedMeshBoqIdentity, ImportedMeshParams } from '../imported-mesh-types';

const IDENTITY: ImportedMeshBoqIdentity = {
  categoryCode: 'OIK-12.1',
  unit: 'm',
  titleEL: 'Κάγκελο αλουμινίου',
};

function mesh(
  id: string,
  nodeName: string,
  uploadId: string,
  sourceFileName: string,
  identity?: ImportedMeshBoqIdentity,
): ImportedMeshListEntityLike {
  const params: Partial<ImportedMeshParams> = {
    kind: 'imported',
    uploadId,
    nodeName,
    sourceFileName,
    importedMeshIdentity: identity,
  };
  return { id, type: 'imported-mesh', params };
}

describe('groupImportedMeshesByUpload', () => {
  it('ομαδοποιεί ανά uploadId και κρατά το όνομα αρχείου', () => {
    const groups = groupImportedMeshesByUpload([
      mesh('e1', 'Rail_01', 'imesh_A', 'kagkela.glb'),
      mesh('e2', 'Rail_02', 'imesh_A', 'kagkela.glb'),
      mesh('e3', 'Sofa_01', 'imesh_B', 'epipla.glb'),
    ]);

    expect(groups).toHaveLength(2);
    expect(groups.map((g) => g.uploadId).sort()).toEqual(['imesh_A', 'imesh_B']);
    expect(groups.find((g) => g.uploadId === 'imesh_A')?.sourceFileName).toBe('kagkela.glb');
  });

  it('βάζει τα ανανάθετα πρώτα μέσα στην ομάδα', () => {
    const [group] = groupImportedMeshesByUpload([
      mesh('e1', 'A_assigned', 'imesh_A', 'x.glb', IDENTITY),
      mesh('e2', 'Z_pending', 'imesh_A', 'x.glb'),
    ]);

    expect(group.rows.map((r) => r.nodeName)).toEqual(['Z_pending', 'A_assigned']);
  });

  it('βάζει τις ομάδες με εκκρεμότητες πρώτες', () => {
    const groups = groupImportedMeshesByUpload([
      mesh('e1', 'n1', 'imesh_A', 'a-clean.glb', IDENTITY),
      mesh('e2', 'n2', 'imesh_B', 'z-pending.glb'),
    ]);

    expect(groups.map((g) => g.sourceFileName)).toEqual(['z-pending.glb', 'a-clean.glb']);
  });

  it('μεταφέρει τα πεδία ανάθεσης, και null όταν λείπει η ταυτότητα', () => {
    const [group] = groupImportedMeshesByUpload([
      mesh('e1', 'assigned', 'imesh_A', 'x.glb', IDENTITY),
      mesh('e2', 'pending', 'imesh_A', 'x.glb'),
    ]);
    const pending = group.rows.find((r) => r.nodeName === 'pending');
    const assigned = group.rows.find((r) => r.nodeName === 'assigned');

    expect(pending).toMatchObject({ assigned: false, categoryCode: null, unit: null, titleEL: null });
    expect(assigned).toMatchObject({
      assigned: true,
      categoryCode: 'OIK-12.1',
      unit: 'm',
      titleEL: 'Κάγκελο αλουμινίου',
      entityId: 'e1',
    });
  });

  it('αγνοεί οντότητες άλλου τύπου και εισαγόμενα χωρίς params', () => {
    const groups = groupImportedMeshesByUpload([
      { id: 'w1', type: 'wall', params: { kind: 'exterior' } },
      { id: 'e0', type: 'imported-mesh' },
      mesh('e1', 'Rail_01', 'imesh_A', 'x.glb'),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].rows).toHaveLength(1);
  });

  it('επιστρέφει κενό για κενή σκηνή', () => {
    expect(groupImportedMeshesByUpload([])).toEqual([]);
  });

  // Το ίδιο .glb εισαγμένο δύο φορές — επιβεβαιωμένο στην οθόνη (Giorgio, 2026-07-20). Μέχρι τη
  // Φ4 καμία εισαγωγή δεν αντικαθιστά, οπότε οι διπλές κεφαλίδες είναι κανονική κατάσταση.
  it('αριθμεί ομάδες που μοιράζονται όνομα αρχείου', () => {
    const groups = groupImportedMeshesByUpload([
      mesh('e1', 'node_id5', 'imesh_A', 'Ισόγειο-2.glb'),
      mesh('e2', 'node_id5', 'imesh_B', 'Ισόγειο-2.glb'),
    ]);

    expect(groups.map((g) => g.duplicateIndex)).toEqual([1, 2]);
  });

  it('δεν αριθμεί όταν το όνομα αρχείου είναι μοναδικό', () => {
    const groups = groupImportedMeshesByUpload([
      mesh('e1', 'n1', 'imesh_A', 'a.glb'),
      mesh('e2', 'n2', 'imesh_B', 'b.glb'),
    ]);

    expect(groups.every((g) => g.duplicateIndex === null)).toBe(true);
  });
});

describe('totalUnassigned', () => {
  it('αθροίζει τις εκκρεμότητες όλων των ομάδων', () => {
    const groups = groupImportedMeshesByUpload([
      mesh('e1', 'n1', 'imesh_A', 'a.glb'),
      mesh('e2', 'n2', 'imesh_A', 'a.glb'),
      mesh('e3', 'n3', 'imesh_B', 'b.glb'),
      mesh('e4', 'n4', 'imesh_B', 'b.glb', IDENTITY),
    ]);

    expect(groups.find((g) => g.uploadId === 'imesh_A')?.unassignedCount).toBe(2);
    expect(groups.find((g) => g.uploadId === 'imesh_B')?.unassignedCount).toBe(1);
    expect(totalUnassigned(groups)).toBe(3);
  });

  it('είναι 0 όταν όλα είναι ανατεθειμένα', () => {
    const groups = groupImportedMeshesByUpload([mesh('e1', 'n1', 'imesh_A', 'a.glb', IDENTITY)]);
    expect(totalUnassigned(groups)).toBe(0);
  });
});
