/**
 * @fileoverview Άγκυρα του κατασκευαστή του σχεδίου του τοπογράφου στον φάκελο (ADR-920 §14.11 Ζ3 · Π3).
 * @related lib/listings/topographic-drawing-file-record · lib/property-dossier/property-dossier-media
 *
 * | Μετάλλαξη | Κοκκινίζει |
 * |---|---|
 * | το σχέδιο γεννιέται δημόσιο | «ιδιωτικό» |
 * | χάνει την ταυτότητα (δεν διαδέχεται, δεν φέρει κηδεμονία) | «ταυτότητα» |
 * | domain/category/purpose αποκλίνουν από την είσοδο «Τοπογραφικό Διάγραμμα» | «καρτέλα» |
 *
 * 🔑 «Καρτέλα» ρωτά τις **πραγματικές** εμβέλειες του φακέλου (`propertyDossierFileTabOf`), χωρίς mock: το σχέδιο είναι
 * έγγραφο του ανθρώπου και πρέπει να φαίνεται εκεί που ζει κάθε τοπογραφικό — στην πρώτη καρτέλα, ποτέ στα «Έγγραφα».
 */

import { ENTITY_TYPES } from '@/config/domain-constants';
import { PROPERTY_DOSSIER_FILE_TABS } from '@/config/upload-entry-points/entries-property-dossier';
import { propertyDossierFileTabOf } from '@/lib/property-dossier/property-dossier-media';
import type { PropertyDossier } from '@/types/property-dossier';

import { TOPOGRAPHIC_DRAWING_IDENTITY, buildTopographicDrawingFileRecord } from '../topographic-drawing-file-record';

const build = (kind: 'dxf' | 'pdf') => buildTopographicDrawingFileRecord({
  home: { userId: 'user_9', dossierId: 'pdos_1' },
  createdBy: 'user_9',
  kind,
  originalFilename: `diagramma.${kind}`,
});

const LAND_DOSSIER: Pick<PropertyDossier, 'id' | 'label' | 'userId' | 'type'> = {
  id: 'pdos_1', label: 'Οικόπεδο', userId: 'user_9', type: 'plot',
};

describe('ADR-920 §14.11 Ζ3 — το σχέδιο του τοπογράφου στον φάκελο', () => {
  it('γεννιέται στον φάκελο του ανθρώπου, ιδιωτικό, με ταυτότητα', () => {
    const { recordBase } = build('dxf');
    expect(recordBase).toMatchObject({
      userId: 'user_9',
      entityType: ENTITY_TYPES.PROPERTY_DOSSIER,
      entityId: 'pdos_1',
      publicationIdentity: TOPOGRAPHIC_DRAWING_IDENTITY,
      contentType: 'image/vnd.dxf',
    });
    expect(recordBase).not.toHaveProperty('classification');
    expect(recordBase).not.toHaveProperty('companyId');
    expect(build('pdf').recordBase.contentType).toBe('application/pdf');
  });

  it.each(['plot', 'detached_house'] as const)('φαίνεται στην πρώτη καρτέλα (%s) — ποτέ στα «Έγγραφα»', (type) => {
    const { recordBase } = build('pdf');
    const file = {
      domain: recordBase.domain, category: recordBase.category, purpose: recordBase.purpose,
      publicationIdentity: recordBase.publicationIdentity,
    };
    expect(propertyDossierFileTabOf({ ...LAND_DOSSIER, type }, file, PROPERTY_DOSSIER_FILE_TABS)).toBe('floorplan');
  });
});
