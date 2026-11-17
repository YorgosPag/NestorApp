/**
 * @fileoverview ADR-916 Φ-Ε1 — άγκυρες της **ΜΙΑΣ** κρίσης εύρους (`dossierFileReach`): «φτάνει αυτό το αρχείο σε αυτή
 * τη συμμετοχή;».
 *
 * 🔑 **Κανένα mock**: η καρτέλα κρίνεται από τον **πραγματικό** κριτή της σελίδας (`propertyDossierFileTabOf`). Τα σχήματα
 *    αρχείων είναι όσα μετρήθηκαν στην παραγωγή (βλ. `dossier-media-publication.test.ts`).
 *
 * | Μετάλλαξη | Κοκκινίζει |
 * |---|---|
 * | κανόνας «κατηγορία ⇒ καρτέλα» αντί του κριτή της σελίδας | Ε1 (τοπογραφικό) · Ε2 (καταφύγιο) |
 * | εξαίρεση αγνοείται | Ε3 |
 * | αρχείο στον κάδο / μη-έτοιμο φτάνει | Ε4 |
 * | αρχείο ξένου κατόχου ή άλλου φακέλου φτάνει | Ε5 |
 */

import { dossierFileReach, type DossierReachFile, type DossierReachOwner } from '../dossier-share-reach';
import type { DossierShareReach } from '@/types/engagement';

const LAND: DossierReachOwner = { id: 'pdos_a', label: 'Οικόπεδο', userId: 'user-1', type: 'land' };

function file(id: string, over: Partial<DossierReachFile> = {}): DossierReachFile {
  return {
    id,
    userId: LAND.userId,
    entityType: 'property_dossier',
    entityId: LAND.id,
    status: 'ready',
    isDeleted: false,
    domain: 'sales',
    category: 'photos',
    purpose: 'view',
    ...over,
  };
}

const PHOTO = file('file_view');
const TOPOGRAPHIC = file('file_topo', { domain: 'admin', category: 'documents', purpose: 'study-topographic' });
const TITLE_DEED = file('file_deed', { domain: 'admin', category: 'documents', purpose: 'study-title-deed' });
/** Κανένας τύπος καρτέλας δεν το διεκδικεί ⇒ καταφύγιο «Έγγραφα» (ADR-916 Φ-Γ3). */
const UNCLAIMED = file('file_model', { domain: 'construction', category: 'drawings', purpose: 'model-3d' });

const reach = (tabs: DossierShareReach['tabs'], excludedFileIds: readonly string[] = []): DossierShareReach =>
  ({ tabs, excludedFileIds });

describe('ADR-916 Φ-Ε1 — `dossierFileReach`', () => {
  it('Ε1 — το τοπογραφικό φτάνει ως «κάτοψη/τοπογραφικό», ΟΧΙ ως «έγγραφο» (ίδια απάντηση με τη σελίδα)', () => {
    expect(dossierFileReach(LAND, TOPOGRAPHIC, reach(['floorplan']))).toBe('floorplan');
    expect(dossierFileReach(LAND, TOPOGRAPHIC, reach(['documents']))).toBeNull();
  });

  it('Ε1 — κάθε αρχείο φτάνει μόνο όταν η καρτέλα του ανήκει στο εύρος', () => {
    expect(dossierFileReach(LAND, PHOTO, reach(['photos']))).toBe('photos');
    expect(dossierFileReach(LAND, PHOTO, reach(['documents', 'floorplan']))).toBeNull();
    expect(dossierFileReach(LAND, TITLE_DEED, reach(['documents']))).toBe('documents');
    expect(dossierFileReach(LAND, PHOTO, reach([]))).toBeNull();
  });

  it('Ε2 — αρχείο που δεν διεκδικεί καμία καρτέλα φτάνει ως «Έγγραφα» (καταφύγιο), όπως το βλέπει ο κάτοχος', () => {
    expect(dossierFileReach(LAND, UNCLAIMED, reach(['documents']))).toBe('documents');
    expect(dossierFileReach(LAND, UNCLAIMED, reach(['floorplan', 'photos', 'videos']))).toBeNull();
  });

  it('Ε3 — εξαιρεμένο αρχείο ΔΕΝ φτάνει, ακόμη κι αν η καρτέλα του είναι στο εύρος', () => {
    expect(dossierFileReach(LAND, TITLE_DEED, reach(['documents'], ['file_deed']))).toBeNull();
    expect(dossierFileReach(LAND, PHOTO, reach(['photos'], ['file_deed']))).toBe('photos');
  });

  it('Ε4 — στον κάδο ή μη-έτοιμο ⇒ δεν φτάνει', () => {
    expect(dossierFileReach(LAND, { ...PHOTO, isDeleted: true }, reach(['photos']))).toBeNull();
    expect(dossierFileReach(LAND, { ...PHOTO, status: 'pending' }, reach(['photos']))).toBeNull();
  });

  it('Ε5 — αρχείο ξένου κατόχου ή άλλου φακέλου ≡ ανύπαρκτο', () => {
    expect(dossierFileReach(LAND, { ...PHOTO, userId: 'user-2' }, reach(['photos']))).toBeNull();
    expect(dossierFileReach(LAND, { ...PHOTO, entityId: 'pdos_b' }, reach(['photos']))).toBeNull();
    expect(dossierFileReach(LAND, { ...PHOTO, entityType: 'property' }, reach(['photos']))).toBeNull();
    // Ο φάκελος άλλαξε χέρια: τα αρχεία του παλιού κατόχου δεν φτάνουν μέσω του νέου.
    expect(dossierFileReach({ ...LAND, userId: 'user-2' }, PHOTO, reach(['photos']))).toBeNull();
  });
});
