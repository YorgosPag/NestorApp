/**
 * ADR-841 §7 Α21.17 — η βιτρίνα όπως τη διαβάζει η μηχανή αναζήτησης.
 *
 *   • Κ1 — 🔴 κανένα κανάλι (τηλέφωνο/email/επαφή) σε κανέναν κόμβο, σε κανένα βάθος
 *   • Κ2 — 🔴 «μόνο περιοχή» ⇒ ΚΑΝΕΝΑΣ κόμβος καταστήματος, καμία διεύθυνση
 *   • Κ3 — ο τύπος ακολουθεί τον ΙΔΙΟ κριτή με τη σελίδα (μεσίτης ⇒ RealEstateAgent)
 *   • Κ4 — σπαστό ωράριο: ομαδοποίηση ημερών, κλειστή ημέρα απούσα
 *   • Κ5 — λογότυπο ⇒ `logo` · πορτρέτο ⇒ `image`, ποτέ ανάποδα
 */

import { showcaseFixture } from '@/lib/agency/__fixtures__/showcase-fixture';
import type { WeeklyHours } from '@/lib/calendar/weekly-hours';
import type { JsonLdValue } from '@/lib/seo/json-ld';
import type { DeclaredShowcaseMark } from '@/types/agency-profile';
import type { ShowcaseLocation } from '@/types/showcase-card';
import { openingHoursSpecification, showcaseStructuredData } from '../showcase-structured-data';

const PROFILE_URL = 'https://nestorconstruct.gr/pro/vafes-pagoni';
const CONTEXT = { profileUrl: PROFILE_URL, canHoldMandate: false };

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
});
