/**
 * ADR-886 — το όνομα της ζήτησης: δικό του ή αυτόματο, πάντα από τα **πραγματικά** locales.
 *
 * 🔑 Ο μεταφραστής διαβάζει τα **αληθινά** JSON (el + en): ένα κλειδί που λείπει θα εμφανιζόταν εδώ ως
 * ωμό κλειδί μέσα στο όνομα — το ίδιο που θα έβλεπε ο άνθρωπος.
 */

// ADR-887 — ο ΕΝΑΣ μεταφραστής πάνω σε locale JSON (ήταν τοπικό τρίτο αντίγραφο).
import { createBundleTranslate } from '@/i18n/bundle-translate';
import type { PriceLabelT } from '@/lib/listings/listing-price-label';
import elMarket from '@/i18n/locales/el/property-market.json';
import elEnums from '@/i18n/locales/el/properties-enums.json';
import elCommon from '@/i18n/locales/el/common.json';
import enMarket from '@/i18n/locales/en/property-market.json';
import enEnums from '@/i18n/locales/en/properties-enums.json';
import enCommon from '@/i18n/locales/en/common.json';
import { exchangeSeek, shortStaySeek, NO_AMOUNT_RANGE, NO_NIGHTS_RANGE } from '@/types/property-demand';
import { demandAutoName, demandDisplayName } from '../demand-display-name';
import { demand, seek } from './demand-fixtures';

jest.mock('@/lib/intl-formatting', () => ({
  formatCurrency: (amount: number) => `${amount} €`,
}));

const tEl: PriceLabelT = createBundleTranslate({ 'property-market': elMarket, 'properties-enums': elEnums, common: elCommon }, 'property-market');
const tEn: PriceLabelT = createBundleTranslate({ 'property-market': enMarket, 'properties-enums': enEnums, common: enCommon }, 'property-market');

describe('demandAutoName — όνομα από τα κριτήρια, ποτέ αποθηκευμένο', () => {
  it('συναλλαγή · τόπος · είδος · υπνοδωμάτια · ταβάνι — με τη σειρά', () => {
    const name = demandAutoName(
      demand({
        seeks: [seek('sell', { max: 200000 })],
        place: { kind: 'near', center: { lat: 40.67, lng: 22.9 }, radiusKm: 3 },
        placeLabel: 'Κορδελιό, Θεσσαλονίκη 563 34',
        features: { types: ['apartment'], areaMin: null, areaMax: null, bedroomsMin: 2, floorMin: null, floorMax: null },
      }),
      tEl,
    );
    expect(name).toBe(
      `Αγορά · Κορδελιό · ${tEl('properties-enums:types.apartment')} · 2+ υπν. · έως 200000 €`,
    );
  });

  it('🔑 πολλά είδη συναλλαγής: σταθερή σειρά λεξιλογίου, ανεξάρτητα από τη σειρά εισαγωγής', () => {
    const a = demandAutoName(demand({ seeks: [seek('leaseOut'), seek('sell')] }), tEl);
    const b = demandAutoName(demand({ seeks: [seek('sell'), seek('leaseOut')] }), tEl);
    expect(a).toBe(b);
    expect(a).toBe('Αγορά / Ενοικίαση');
  });

  it('«οπουδήποτε» και «κάθε είδος» ΔΕΝ λέγονται σε όνομα', () => {
    expect(demandAutoName(demand(), tEl)).toBe('Αγορά');
  });

  it('`near` χωρίς ετικέτα ⇒ ακτίνα, όχι κενό', () => {
    const name = demandAutoName(
      demand({ place: { kind: 'near', center: { lat: 40, lng: 22 }, radiusKm: 5 } }),
      tEl,
    );
    expect(name).toBe('Αγορά · 5 χλμ. γύρω από σημείο');
  });

  it.each([
    [{ kind: 'area', shapes: [[{ lat: 0, lng: 0 }, { lat: 0, lng: 1 }, { lat: 1, lng: 1 }]] }, 'Σχεδιασμένη περιοχή'],
    [{ kind: 'place', landId: 'land_1', buildingId: null }, 'Συγκεκριμένο ακίνητο'],
    [{ kind: 'frontage', streetName: 'Εγνατία', axis: [{ lat: 0, lng: 0 }, { lat: 0, lng: 1 }], side: 'both', depthMetres: 40 }, 'Οδός Εγνατία'],
    [{ kind: 'frontage', streetName: null, axis: [{ lat: 0, lng: 0 }, { lat: 0, lng: 1 }], side: 'left', depthMetres: 40 }, 'Πρόσοψη σε δρόμο'],
  ] as const)('τόπος %#', (place, expected) => {
    expect(demandAutoName(demand({ place }), tEl)).toBe(`Αγορά · ${expected}`);
  });

  it('🔴 ετικέτα τόπου ΔΕΝ λέγεται όταν ο τόπος δεν είναι `near` (θα ψευδόταν)', () => {
    const name = demandAutoName(
      demand({
        place: { kind: 'area', shapes: [[{ lat: 0, lng: 0 }, { lat: 0, lng: 1 }, { lat: 1, lng: 1 }]] },
        placeLabel: 'Καλαμαριά',
      }),
      tEl,
    );
    expect(name).not.toContain('Καλαμαριά');
  });

  it('πολλά είδη ακινήτου ⇒ «πρώτο +N»', () => {
    const name = demandAutoName(
      demand({ features: { ...demand().features, types: ['apartment', 'studio', 'maisonette'] } }),
      tEl,
    );
    expect(name).toBe(`Αγορά · ${tEl('properties-enums:types.apartment')} +2`);
  });

  it('`bedroomsMin: 0` (δεκτό και studio) δεν είναι περιορισμός ⇒ δεν λέγεται', () => {
    const name = demandAutoName(demand({ features: { ...demand().features, bedroomsMin: 0 } }), tEl);
    expect(name).toBe('Αγορά');
  });

  it('αντιπαροχή και διαμονή χωρίς ποσό ⇒ κανένα ταβάνι στο όνομα', () => {
    const name = demandAutoName(
      demand({ seeks: [exchangeSeek(40), shortStaySeek(NO_AMOUNT_RANGE, NO_NIGHTS_RANGE, null)] }),
      tEl,
    );
    expect(name).toBe('Αντιπαροχή / Διαμονή'); // σειρά `OFFER_KINDS`
  });

  it('η τιμή ακολουθεί τη μονάδα του ρόλου (ενοίκιο ανά μήνα)', () => {
    const name = demandAutoName(demand({ seeks: [seek('leaseOut', { max: 900 })] }), tEl);
    expect(name).toBe(`Ενοικίαση · έως ${tEl('common:priceAmount.rent', { price: '900 €' })}`);
  });

  it('και στα αγγλικά — κανένα ωμό κλειδί', () => {
    const name = demandAutoName(
      demand({
        seeks: [seek('sell', { max: 200000 })],
        place: { kind: 'near', center: { lat: 40, lng: 22 }, radiusKm: 5 },
        features: { ...demand().features, bedroomsMin: 3 },
      }),
      tEn,
    );
    expect(name).not.toMatch(/property-market:|properties-enums:|common:/);
    expect(name).toContain('5 km around a point');
    expect(name).toContain('3+ bd');
  });
});

describe('demandDisplayName — ό,τι έγραψε ο άνθρωπος κερδίζει', () => {
  it('δικό του όνομα ⇒ αυτό', () => {
    expect(demandDisplayName(demand({ title: 'Για τη Μαρία' }), tEl)).toBe('Για τη Μαρία');
  });

  it.each([null, '', '   ', '\u0007\u0000'])('κενό/μόνο-κενά (%p) ⇒ το αυτόματο', (title) => {
    expect(demandDisplayName(demand({ title }), tEl)).toBe('Αγορά');
  });
});
