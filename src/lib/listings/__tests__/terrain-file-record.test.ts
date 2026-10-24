/**
 * @fileoverview Άγκυρα του κατασκευαστή της πηγής εδάφους — δύο σπίτια, ένα έγγραφο (ADR-920 Β4.3).
 * @related lib/listings/terrain-file-record · components/property-dossier/property-dossier-media
 *
 * | Μετάλλαξη | Κοκκινίζει |
 * |---|---|
 * | ο φάκελος γεννιέται με `companyId` / ως `PROPERTY` | «φάκελος» |
 * | το εταιρικό χάνει τον μισθωτή | «εταιρεία» |
 * | τα δύο σπίτια αποκλίνουν σε ταυτότητα/κατηγορία/διαβάθμιση | «ίδιο έγγραφο» |
 * | η πηγή αποκτά σκοπό που ταιριάζει σε καρτέλα του φακέλου | «καμία καρτέλα» |
 *
 * 🔑 «Καμία καρτέλα» ρωτά τις **πραγματικές** εμβέλειες του φακέλου (`propertyDossierFileTabOf`), χωρίς mock: η πηγή
 * είναι κανονικό JSON του διακομιστή, όχι έγγραφο του ανθρώπου — αν εμφανιζόταν στα «Έγγραφα», θα μπορούσε να
 * μετονομαστεί ή να μεταφερθεί σαν οποιοδήποτε αρχείο, και η επαναπροβολή δεν θα το μάθαινε.
 */

import { ENTITY_TYPES, FILE_CATEGORIES, FILE_CLASSIFICATIONS } from '@/config/domain-constants';
import { propertyDossierFileTabOf } from '@/components/property-dossier/property-dossier-media';
import type { PropertyDossierFileTab } from '@/config/upload-entry-points/entries-property-dossier';
import type { PropertyDossier } from '@/types/property-dossier';
import {
  TERRAIN_PUBLICATION_IDENTITY,
  buildPublishedTerrainFileRecord,
} from '../terrain-file-record';

const REVISIONS = [{ fileId: 'file_scene', revision: 3 }];

const company = () => buildPublishedTerrainFileRecord({
  home: { companyId: 'comp_a', propertyId: 'prop_1' }, createdBy: 'user_1', sourceRevisions: REVISIONS,
}).recordBase as unknown as Record<string, unknown>;

const personal = () => buildPublishedTerrainFileRecord({
  home: { userId: 'user_9', dossierId: 'pdos_a' }, createdBy: 'user_9', sourceRevisions: [],
}).recordBase as unknown as Record<string, unknown>;

const ALL_TABS: readonly PropertyDossierFileTab[] = ['floorplan', 'documents', 'photos', 'videos'];

describe('buildPublishedTerrainFileRecord — δύο σπίτια', () => {
  it('εταιρεία: αρχείο του μισθωτή, στο ακίνητο', () => {
    expect(company()).toMatchObject({ companyId: 'comp_a', entityType: ENTITY_TYPES.PROPERTY, entityId: 'prop_1' });
    expect(company()).not.toHaveProperty('userId');
  });

  it('φάκελος: αρχείο του ανθρώπου, στον φάκελο — ποτέ μισθωτής', () => {
    const record = personal();
    expect(record).toMatchObject({ userId: 'user_9', entityType: ENTITY_TYPES.PROPERTY_DOSSIER, entityId: 'pdos_a' });
    expect(record).not.toHaveProperty('companyId');
    expect(String(record.storagePath)).toContain('pdos_a');
  });

  it('ίδιο έγγραφο: ταυτότητα, κατηγορία, διαβάθμιση, τύπος — μόνο ο κάτοχος αλλάζει', () => {
    const pick = (record: Record<string, unknown>) => ({
      publicationIdentity: record.publicationIdentity, category: record.category, domain: record.domain,
      classification: record.classification, contentType: record.contentType, originalFilename: record.originalFilename,
    });
    expect(pick(personal())).toStrictEqual(pick(company()));
    expect(pick(personal())).toMatchObject({
      publicationIdentity: TERRAIN_PUBLICATION_IDENTITY,
      category: FILE_CATEGORIES.DRAWINGS,
      classification: FILE_CLASSIFICATIONS.PUBLIC,
    });
  });

  it.each(['plot', 'detached_house'] as const)('καμία καρτέλα του φακέλου (%s) δεν δείχνει την πηγή', (type) => {
    const dossier: Pick<PropertyDossier, 'id' | 'label' | 'userId' | 'type'> =
      { id: 'pdos_a', label: 'Οικόπεδο', userId: 'user_9', type };
    const record = personal();
    const file = { domain: record.domain, category: record.category, purpose: record.purpose } as
      Parameters<typeof propertyDossierFileTabOf>[1];
    expect(propertyDossierFileTabOf(dossier, file, ALL_TABS)).toBeNull();
  });
});
