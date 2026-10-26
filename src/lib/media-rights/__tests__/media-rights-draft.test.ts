/**
 * @jest-environment node
 *
 * @fileoverview **Πρόχειρο δήλωσης δικαιωμάτων ⇄ `MediaRights`** (ADR-884 Φ0.14 · ADR-923 §5.10.4).
 */

import { mediaRightsSchemaFor } from '../media-rights-schema';
import {
  draftTermKindsIn,
  emptyMediaRightsDraft,
  mediaLicensePurposesIn,
  mediaRightsDraftIssues,
  mediaRightsDraftOf,
  mediaRightsOf,
} from '../media-rights-draft';
import type { MediaRights } from '@/types/media-rights';

const SELF = { uid: 'u1', name: 'Νίκος Παπαδόπουλος' };

describe('πλαίσια', () => {
  it('Π1 — ο κατάλογος βλέπει μόνο τους δικούς του σκοπούς και διάρκειες (όχι εντολή)', () => {
    expect(mediaLicensePurposesIn('catalog')).toEqual(['catalog-publication', 'reseller-reuse', 'unrestricted']);
    expect(mediaLicensePurposesIn('listing')).toEqual(['listing-marketing', 'owner-reuse', 'unrestricted']);
    expect(draftTermKindsIn('catalog')).toEqual(['perpetual', 'date']);
  });

  it('Π2 — νέα δήλωση: ο συνδεδεμένος δημιουργός, ο πρώτος σκοπός του πλαισίου', () => {
    expect(emptyMediaRightsDraft('catalog', SELF)).toMatchObject({ creatorName: SELF.name, purpose: 'catalog-publication', termKind: 'perpetual' });
  });
});

describe('πρόχειρο ⇒ δικαιώματα', () => {
  it('Δ1 — ο εαυτός δένεται στον λογαριασμό· άλλο όνομα ⇒ userId null', () => {
    const self = mediaRightsOf(emptyMediaRightsDraft('catalog', SELF), SELF, 2026);
    expect(self.creator).toEqual({ name: SELF.name, userId: 'u1', url: null });
    expect(self.copyrightNotice).toBe(`© 2026 ${SELF.name}`);
    const other = mediaRightsOf({ ...emptyMediaRightsDraft('catalog', SELF), creatorName: 'Studio X' }, SELF, 2026);
    expect(other.creator.userId).toBeNull();
  });

  it('Δ2 — το αποτέλεσμα περνά το σχήμα του διακομιστή για το πλαίσιο', () => {
    const until = new Date('2030-01-01T00:00:00.000Z');
    const rights = mediaRightsOf({ ...emptyMediaRightsDraft('catalog', SELF), termKind: 'date', termUntil: until }, SELF, 2026);
    expect(mediaRightsSchemaFor('catalog').safeParse(rights).success).toBe(true);
    expect(rights.license.term).toEqual({ kind: 'date', until: until.toISOString() });
  });

  it('Δ3 — επεξεργασία: κρατιούνται αδειοδότες, όροι web και ο λογαριασμός του δημιουργού', () => {
    const base: MediaRights = {
      creator: { name: 'Studio X', userId: null, url: 'https://studio.example' },
      licensors: [{ name: 'Supplier SA', userId: null, url: null }],
      copyrightNotice: '© 2024 Studio X',
      webStatementOfRights: 'https://studio.example/terms',
      license: { purpose: 'reseller-reuse', term: { kind: 'perpetual' } },
    };
    const draft = mediaRightsDraftOf('catalog', base);
    const again = mediaRightsOf(draft, SELF, 2026, base);
    expect(again).toEqual(base);
  });

  it('Δ4 — «έως ημερομηνία» χωρίς ημερομηνία ⇒ εύρημα (αλλιώς θα γινόταν σιωπηλά «χωρίς λήξη»)', () => {
    const draft = { ...emptyMediaRightsDraft('catalog', SELF), termKind: 'date' as const };
    expect(mediaRightsDraftIssues(draft)).toEqual(['termDateRequired']);
    expect(mediaRightsDraftIssues({ ...draft, creatorName: '  ', termKind: 'perpetual' })).toEqual(['creatorRequired']);
  });

  it('Δ5 — σκοπός εκτός πλαισίου στην επεξεργασία ⇒ ο πρώτος του πλαισίου (ορατά)', () => {
    const listing: MediaRights = {
      creator: { name: 'A', userId: null, url: null }, licensors: [], copyrightNotice: '© A', webStatementOfRights: null,
      license: { purpose: 'listing-marketing', term: { kind: 'perpetual' } },
    };
    expect(mediaRightsDraftOf('catalog', listing).purpose).toBe('catalog-publication');
  });
});
