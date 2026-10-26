/**
 * ⚓ ADR-923 §5.10.3 — **ένα λεξιλόγιο αδειών, πολλά πλαίσια**: ό,τι επιτρέπεται στο μέσο αγγελίας δεν επιτρέπεται
 * κατ' ανάγκη στο μέσο καταλόγου, και αντίστροφα.
 *
 * Μεταλλάξεις που πρέπει να πιάσει:
 * - Ν1: το σχήμα `listing` (συμβόλαιο της εφαρμογής κινητού) δέχεται σκοπό καταλόγου · το `catalog` δέχεται «εντολή».
 * - Ν2: η ένωση διαρκειών ενός πλαισίου αποκλίνει από τις διάρκειες του λεξιλογίου του πλαισίου.
 * - Ν3: ο αναγνώστης `readMediaRights` αγνοεί το πλαίσιο.
 * - Ν4: σκοπός της ρίζας που δεν ανήκει σε κανένα πλαίσιο (κανείς δεν μπορεί να τον επιλέξει — νεκρή τιμή).
 */

import {
  MEDIA_LICENSE_CONTEXTS,
  MEDIA_LICENSE_PURPOSES,
  MEDIA_LICENSE_TERM_KINDS,
  type MediaLicenseContext,
} from '@/constants/media-rights-vocabulary';
import type { MediaRights } from '@/types/media-rights';

import { readMediaRights } from '../media-rights-read';
import { mediaLicenseTermSchemaFor, mediaRightsSchemaFor } from '../media-rights-schema';

const CONTEXTS = Object.keys(MEDIA_LICENSE_CONTEXTS) as MediaLicenseContext[];

const rights = (purpose: string, term: Record<string, unknown>) => ({
  creator: { name: 'Aries', userId: null, url: null },
  licensors: [],
  copyrightNotice: '© Aries',
  webStatementOfRights: null,
  license: { purpose, term },
});

const PERPETUAL = { kind: 'perpetual' };
const MANDATE = { kind: 'mandate', mandateId: 'mand_1' };

describe('mediaRightsSchemaFor', () => {
  it('🔴 Ν1 listing: δέχεται μάρκετινγκ αγγελίας με εντολή · απορρίπτει σκοπούς καταλόγου', () => {
    const listing = mediaRightsSchemaFor('listing');
    expect(listing.safeParse(rights('listing-marketing', MANDATE)).success).toBe(true);
    expect(listing.safeParse(rights('catalog-publication', PERPETUAL)).success).toBe(false);
    expect(listing.safeParse(rights('reseller-reuse', PERPETUAL)).success).toBe(false);
  });

  it('🔴 Ν1 catalog: δέχεται δημοσίευση/μεταπώληση · απορρίπτει μάρκετινγκ αγγελίας και «όσο ισχύει η εντολή»', () => {
    const catalog = mediaRightsSchemaFor('catalog');
    expect(catalog.safeParse(rights('catalog-publication', PERPETUAL)).success).toBe(true);
    expect(catalog.safeParse(rights('reseller-reuse', { kind: 'date', until: '2030-01-01T00:00:00.000Z' })).success).toBe(true);
    expect(catalog.safeParse(rights('listing-marketing', PERPETUAL)).success).toBe(false);
    expect(catalog.safeParse(rights('catalog-publication', MANDATE)).success).toBe(false);
  });

  it('🔴 Ν2 κάθε ένωση διαρκειών έχει ΑΚΡΙΒΩΣ τις διάρκειες του πλαισίου της', () => {
    for (const context of CONTEXTS) {
      const kinds = mediaLicenseTermSchemaFor(context).options.map((option) => option.shape.kind.value);
      expect([...kinds].sort()).toEqual([...MEDIA_LICENSE_CONTEXTS[context].termKinds].sort());
    }
  });

  it('το στιγμιότυπο είναι ΕΝΑ ανά πλαίσιο (ο γεννήτορας του OpenAPI ονομάζει σχήματα από την ταυτότητα)', () => {
    expect(mediaRightsSchemaFor('listing')).toBe(mediaRightsSchemaFor('listing'));
    expect(mediaRightsSchemaFor('listing').shape.license).not.toBe(mediaRightsSchemaFor('catalog').shape.license);
  });
});

describe('readMediaRights — ανά πλαίσιο', () => {
  it('🔴 Ν3 ο αναγνώστης κρίνει με το πλαίσιο του μέσου', () => {
    const reseller = rights('reseller-reuse', PERPETUAL) as MediaRights;
    expect(readMediaRights(reseller, 'listing')).toBeNull();
    expect(readMediaRights(reseller, 'catalog')).toEqual(reseller);
    expect(readMediaRights(rights('catalog-publication', MANDATE), 'catalog')).toBeNull();
  });
});

describe('το λεξιλόγιο', () => {
  it('🔴 Ν4 κάθε σκοπός και κάθε διάρκεια της ρίζας ανήκει σε τουλάχιστον ένα πλαίσιο', () => {
    const purposes = new Set(CONTEXTS.flatMap((context) => MEDIA_LICENSE_CONTEXTS[context].purposes));
    const terms = new Set(CONTEXTS.flatMap((context) => MEDIA_LICENSE_CONTEXTS[context].termKinds));
    expect([...purposes].sort()).toEqual([...MEDIA_LICENSE_PURPOSES].sort());
    expect([...terms].sort()).toEqual([...MEDIA_LICENSE_TERM_KINDS].sort());
  });
});
