/**
 * ADR-841 §7 Α21.17 — η βιτρίνα όπως τη διαβάζει η μηχανή αναζήτησης.
 *
 *   • Κ1 — 🔴 κανένα κανάλι (τηλέφωνο/email/επαφή) σε κανέναν κόμβο, σε κανένα βάθος
 *   • Κ2 — 🔴 «μόνο περιοχή» ⇒ ΚΑΝΕΝΑΣ κόμβος καταστήματος, καμία διεύθυνση
 *   • Κ3 — ο τύπος ακολουθεί τον ΙΔΙΟ κριτή με τη σελίδα (μεσίτης ⇒ RealEstateAgent)
 *   • Κ4 — σπαστό ωράριο: ομαδοποίηση ημερών, κλειστή ημέρα απούσα
 *   • Κ5 — λογότυπο ⇒ `logo` · πορτρέτο ⇒ `image`, ποτέ ανάποδα
 *   • Κ8 — ⚖️ κλειστή στο ΓΕΜΗ (Α23 Φ4) ⇒ ΜΟΝΟ ο οργανισμός· θετικός μάρτυρας: η ΙΔΙΑ βιτρίνα ενεργή
 */

import { legalIdentityFixture, showcaseFixture } from '@/lib/agency/__fixtures__/showcase-fixture';
import type { WeeklyHours } from '@/lib/calendar/weekly-hours';
import { WEEKLY_HOURS_PRESETS } from '@/lib/calendar/weekly-hours-editing';
import type { JsonLdValue } from '@/lib/seo/json-ld';
import type { DeclaredShowcaseMark } from '@/types/agency-profile';
import type { ShowcaseLocation } from '@/types/showcase-card';
import { openingHoursSpecification, showcaseStructuredData, specialOpeningHoursSpecification } from '../showcase-structured-data';

const PROFILE_URL = 'https://nestorconstruct.gr/pro/vafes-pagoni';
const CONTEXT = { profileUrl: PROFILE_URL, canHoldMandate: false, todayKey: '2026-09-15' };

const SPLIT: WeeklyHours = {
  1: [{ opens: '09:00', closes: '14:00' }, { opens: '17:00', closes: '20:30' }],
  2: [{ opens: '09:00', closes: '14:00' }, { opens: '17:00', closes: '20:30' }],
  3: [],
  4: [],
  5: [],
  6: [{ opens: '10:00', closes: '14:00' }],
  7: [],
};

function location(overrides: Partial<ShowcaseLocation> = {}): ShowcaseLocation {
  return {
    id: 'sloc_hq',
    role: 'headquarters',
    label: null,
    place: { landId: 'land_1', buildingId: null },
    position: { lat: 40.63, lng: 22.94 },
    street: { street: 'Τσιμισκή', number: '12', postalCode: '54624' },
    hours: null,
    specialHours: [],
    channelKinds: ['phone', 'email'],
    emailConfirmedAt: null,
    ...overrides,
  };
}

function mark(kind: DeclaredShowcaseMark['kind']): DeclaredShowcaseMark {
  return { kind, image: { url: `https://cdn.example/${kind}.png`, width: 256, height: 256, altKey: 'k', sources: [] } };
}

function graphOf(value: JsonLdValue): Record<string, JsonLdValue | undefined>[] {
  const root = value as { readonly '@graph': Record<string, JsonLdValue | undefined>[] };
  return root['@graph'];
}

function keysDeep(value: unknown, into: Set<string> = new Set()): Set<string> {
  if (Array.isArray(value)) value.forEach((item) => keysDeep(item, into));
  else if (typeof value === 'object' && value !== null) {
    for (const [key, nested] of Object.entries(value)) {
      into.add(key);
      keysDeep(nested, into);
    }
  }
  return into;
}

describe('showcaseStructuredData', () => {
  it('🔴 Κ1 — ΚΑΝΕΝΑ κανάλι σε κανένα βάθος', () => {
    const data = showcaseStructuredData(
      showcaseFixture({ locations: [location({ hours: SPLIT }), location({ id: 'sloc_b', role: 'branch' })] }),
      CONTEXT,
    );
    const keys = keysDeep(data);
    for (const forbidden of ['telephone', 'email', 'faxNumber', 'contactPoint']) expect(keys.has(forbidden)).toBe(false);
  });

  it('🔴 Κ2 — «μόνο περιοχή» ⇒ μόνο ο οργανισμός, καμία διεύθυνση', () => {
    const graph = graphOf(showcaseStructuredData(showcaseFixture({ locations: [location({ street: null })] }), CONTEXT));
    expect(graph).toHaveLength(1);
    expect(graph[0]['@type']).toBe('Organization');
    expect(keysDeep(graph).has('address')).toBe(false);
  });

  it('Κ3 — κατάστημα με οδό: διεύθυνση, γεωγραφία, γονέας — και ο τύπος από τον κριτή', () => {
    const showcase = showcaseFixture({ displayName: 'ΒΑΦΕΣ', locations: [location({ label: 'Κέντρο' })] });
    const [organisation, shop] = graphOf(showcaseStructuredData(showcase, CONTEXT));

    expect(organisation).toMatchObject({ '@id': `${PROFILE_URL}#organization`, name: 'ΒΑΦΕΣ', url: PROFILE_URL });
    expect(shop).toMatchObject({
      '@type': 'LocalBusiness',
      '@id': `${PROFILE_URL}#sloc_hq`,
      name: 'ΒΑΦΕΣ — Κέντρο',
      parentOrganization: { '@id': `${PROFILE_URL}#organization` },
      address: { '@type': 'PostalAddress', streetAddress: 'Τσιμισκή, 12', postalCode: '54624', addressCountry: 'GR' },
      geo: { '@type': 'GeoCoordinates', latitude: 40.63, longitude: 22.94 },
    });
    const broker = graphOf(showcaseStructuredData(showcase, { ...CONTEXT, canHoldMandate: true }));
    expect(broker[1]['@type']).toBe('RealEstateAgent');
  });

  it('Κ6 — δηλωμένη ιστοσελίδα ⇒ `url` ΤΟΥ οργανισμού· η ταυτότητα (`@id`) μένει η βιτρίνα', () => {
    const showcase = showcaseFixture({ website: 'https://www.vafes.gr/', locations: [location()] });
    const [organisation, shop] = graphOf(showcaseStructuredData(showcase, CONTEXT));
    expect(organisation).toMatchObject({ '@id': `${PROFILE_URL}#organization`, url: 'https://www.vafes.gr/' });
    expect(shop).toMatchObject({ '@id': `${PROFILE_URL}#sloc_hq`, url: 'https://www.vafes.gr/' });
  });

  it('Κ5 — λογότυπο ⇒ logo · πορτρέτο ⇒ image', () => {
    const [withLogo] = graphOf(showcaseStructuredData(showcaseFixture({ mark: mark('logo') }), CONTEXT));
    expect(withLogo).toMatchObject({ logo: 'https://cdn.example/logo.png' });
    expect(withLogo.image).toBeUndefined();

    const [withPortrait] = graphOf(showcaseStructuredData(showcaseFixture({ mark: mark('portrait') }), CONTEXT));
    expect(withPortrait).toMatchObject({ image: 'https://cdn.example/portrait.png' });
    expect(withPortrait.logo).toBeUndefined();
  });

  describe('Κ8 (ADR-841 §7 Α23 Φ4) — κλειστή στο ΓΕΜΗ', () => {
    const BROKER = { ...CONTEXT, canHoldMandate: true };
    const stores = [location({ hours: SPLIT }), location({ id: 'sloc_b', role: 'branch' })];
    const closedShowcase = showcaseFixture({
      displayName: 'ΒΑΦΕΣ',
      locations: stores,
      legalIdentity: legalIdentityFixture({ registryClosure: { issuer: 'gemi', checkedAt: '2026-09-14T11:00:00.000Z' } }),
    });

    it('🔴 Κ8α — ΜΟΝΟ ο οργανισμός: κανένα «κατάστημα με ωράριο», καμία επινοημένη ημερομηνία λύσης', () => {
      const graph = graphOf(showcaseStructuredData(closedShowcase, BROKER));
      expect(graph).toHaveLength(1);
      expect(graph[0]).toMatchObject({ '@type': 'Organization', name: 'ΒΑΦΕΣ' });
      const keys = keysDeep(graph);
      for (const forbidden of ['geo', 'openingHoursSpecification', 'dissolutionDate', 'parentOrganization']) expect(keys.has(forbidden)).toBe(false);
      // 🔑 Α2: η ΜΟΝΗ διεύθυνση είναι η καταστατική έδρα του οργανισμού (αληθής ταυτότητα) — καμία οδός καταστήματος.
      expect(graph[0].address).toEqual({ '@type': 'PostalAddress', addressLocality: 'Θεσσαλονίκη', addressCountry: 'GR' });
    });

    it('🔑 Κ8β — Ο ΘΕΤΙΚΟΣ ΜΑΡΤΥΡΑΣ: η ΙΔΙΑ βιτρίνα ενεργή ⇒ οργανισμός + δύο καταστήματα με ωράριο', () => {
      const graph = graphOf(showcaseStructuredData({ ...closedShowcase, legalIdentity: legalIdentityFixture() }, BROKER));
      expect(graph.map((node) => node['@type'])).toEqual(['Organization', 'RealEstateAgent', 'RealEstateAgent']);
      expect(graph[1].openingHoursSpecification).toHaveLength(3);
    });
  });

  describe('Κ9 (ADR-841 §7 Α23 Φ4 Α2) — νομικά στοιχεία στον οργανισμό', () => {
    it('⚖️ Κ9α — `legalName` όταν διαφέρει από το όνομα · `address` = η ΔΗΜΟΣΙΕΥΜΕΝΗ έδρα (municipality ⇒ μόνο δήμος)', () => {
      const [organisation] = graphOf(
        showcaseStructuredData(showcaseFixture({ displayName: 'ΒΑΦΕΣ', legalIdentity: legalIdentityFixture() }), CONTEXT),
      );
      expect(organisation).toMatchObject({
        legalName: 'ΠΑΓΩΝΗΣ ΑΝΩΝΥΜΗ ΕΤΑΙΡΕΙΑ',
        address: { '@type': 'PostalAddress', addressLocality: 'Θεσσαλονίκη', addressCountry: 'GR' },
      });
      expect(keysDeep(organisation.address).has('streetAddress')).toBe(false);
    });

    it('Κ9β — ίδια επωνυμία με το όνομα ⇒ καμία επανάληψη `legalName`', () => {
      const [organisation] = graphOf(
        showcaseStructuredData(
          showcaseFixture({ displayName: 'ΠΑΓΩΝΗΣ ΑΝΩΝΥΜΗ ΕΤΑΙΡΕΙΑ', legalIdentity: legalIdentityFixture() }),
          CONTEXT,
        ),
      );
      expect(organisation.legalName).toBeUndefined();
    });

    it('🔑 Κ9γ — Ο ΘΕΤΙΚΟΣ ΜΑΡΤΥΡΑΣ: βιτρίνα πριν την Α23 ⇒ ούτε `legalName` ούτε `address` (κανένα επινοημένο)', () => {
      const [organisation] = graphOf(showcaseStructuredData(showcaseFixture({ displayName: 'ΒΑΦΕΣ' }), CONTEXT));
      expect(organisation.legalName).toBeUndefined();
      expect(organisation.address).toBeUndefined();
    });
  });
});

describe('openingHoursSpecification', () => {
  it('Κ4 — ίδια διαστήματα ⇒ μία εγγραφή με πολλές ημέρες· κλειστή ημέρα απούσα', () => {
    expect(openingHoursSpecification(SPLIT)).toEqual([
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: ['https://schema.org/Monday', 'https://schema.org/Tuesday'],
        opens: '09:00',
        closes: '14:00',
      },
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: ['https://schema.org/Monday', 'https://schema.org/Tuesday'],
        opens: '17:00',
        closes: '20:30',
      },
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: ['https://schema.org/Saturday'],
        opens: '10:00',
        closes: '14:00',
      },
    ]);
  });

  it('Κ5 (Α21.16.8) — 24 ώρες ⇒ 00:00–23:59, όπως ορίζει η Google', () => {
    expect(openingHoursSpecification(WEEKLY_HOURS_PRESETS['always-open'])).toEqual([
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: Object.values({
          1: 'https://schema.org/Monday', 2: 'https://schema.org/Tuesday', 3: 'https://schema.org/Wednesday',
          4: 'https://schema.org/Thursday', 5: 'https://schema.org/Friday', 6: 'https://schema.org/Saturday',
          7: 'https://schema.org/Sunday',
        }),
        opens: '00:00',
        closes: '23:59',
      },
    ]);
  });

  it('🏆 Κ7 (Α21.21) — ειδικές μέρες: validFrom = validThrough, κλειστά 00:00–00:00, «Κανονικά» ΡΗΤΑ, περασμένες απούσες', () => {
    const special = [
      { date: '2026-09-14', kind: 'closed' as const },
      { date: '2026-12-25', kind: 'closed' as const },
      { date: '2026-12-28', kind: 'regular' as const },
      { date: '2026-12-31', kind: 'custom' as const, intervals: [{ opens: '09:00', closes: '24:00' }] },
    ];
    expect(specialOpeningHoursSpecification(SPLIT, special, '2026-09-15')).toEqual([
      { '@type': 'OpeningHoursSpecification', opens: '00:00', closes: '00:00', validFrom: '2026-12-25', validThrough: '2026-12-25' },
      { '@type': 'OpeningHoursSpecification', opens: '09:00', closes: '14:00', validFrom: '2026-12-28', validThrough: '2026-12-28' },
      { '@type': 'OpeningHoursSpecification', opens: '17:00', closes: '20:30', validFrom: '2026-12-28', validThrough: '2026-12-28' },
      { '@type': 'OpeningHoursSpecification', opens: '09:00', closes: '23:59', validFrom: '2026-12-31', validThrough: '2026-12-31' },
    ]);
    const [, shop] = graphOf(showcaseStructuredData(showcaseFixture({ locations: [location({ hours: SPLIT, specialHours: special })] }), CONTEXT));
    expect(shop.openingHoursSpecification).toHaveLength(3 + 4);
  });

  it('Κ6 (Α21.16.8) — μετά τα μεσάνυχτα ⇒ ΜΙΑ εγγραφή με closes < opens, ποτέ σπασμένη σε δύο ημέρες', () => {
    const friday: WeeklyHours = { 1: [], 2: [], 3: [], 4: [], 5: [{ opens: '22:00', closes: '03:00' }], 6: [], 7: [] };
    expect(openingHoursSpecification(friday)).toEqual([
      { '@type': 'OpeningHoursSpecification', dayOfWeek: ['https://schema.org/Friday'], opens: '22:00', closes: '03:00' },
    ]);
  });
});
