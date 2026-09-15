/**
 * @fileoverview 🏆 **Η ΒΙΤΡΙΝΑ ΟΠΩΣ ΤΗ ΔΙΑΒΑΖΕΙ Η ΜΗΧΑΝΗ ΑΝΑΖΗΤΗΣΗΣ** — JSON-LD, χωρίς κανάλια (ADR-841 §7 Α21.17).
 * @related app/(light)/pro/[alias]/page.tsx · lib/seo/json-ld.ts · types/showcase-card.ts
 * @module lib/agency/showcase-structured-data
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΚΑΝΕΝΑ `telephone`, ΚΑΝΕΝΑ `email` — ΚΑΙ Η ΜΗΧΑΝΗ ΔΕΝ ΜΑΣ ΤΟ ΖΗΤΑ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ο αριθμός μέσα στο HTML θα ακύρωνε ολόκληρη την Α21.16.1: ο συλλέκτης δεν θα χρειαζόταν ούτε την
 * πόρτα με το όριο. Και η Google (Search Central, LocalBusiness) δηλώνει το `telephone` **συνιστώμενο,
 * όχι απαιτούμενο** — υποχρεωτικά είναι μόνο `name` και `address`. Άρα η επιλεξιμότητα δεν πληρώνει τίποτα.
 *
 * 🔒 Ο τύπος εξόδου είναι **κλειστός**· η άγκυρα (`showcase-structured-data.test.ts`) σαρώνει **βαθιά**.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ «ΜΟΝΟ ΠΕΡΙΟΧΗ» ΔΕΝ ΓΙΝΕΤΑΙ `LocalBusiness` — ΟΥΤΕ `areaServed`
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η Google **απαιτεί** `address`. Κατάστημα χωρίς δημοσιευμένη οδό είτε θα έστελνε μισή διεύθυνση
 * (παράβαση οδηγιών — κίνδυνος χειροκίνητης ποινής) είτε θα έπρεπε να ονομάσει την περιοχή από το
 * `displayAddress` της γης — **ελεύθερο κείμενο που μπορεί να κρατά την οδό της κατοικίας**, δηλαδή
 * ακριβώς ό,τι ο άνθρωπος διάλεξε να κρύψει (§9.9 β). ⇒ **Σιωπή**: ο κόμβος του οργανισμού μένει, το
 * κατάστημα δεν εμφανίζεται.
 *
 * 🔑 **Λογότυπο ≠ πορτρέτο**: το σήμα-λογότυπο γίνεται `logo`· το πορτρέτο είναι **πρόσωπο** και γίνεται
 * `image` — ένα πρόσωπο δηλωμένο ως λογότυπο θα έμπαινε στο πάνελ γνώσεων ως σήμα εταιρείας.
 *
 * **Layering**: leaf — καθαρή συνάρτηση, καμία ανάγνωση.
 */

import { END_OF_DAY, ISO_WEEKDAYS, type IsoWeekday, type WeeklyHours } from '@/lib/calendar/weekly-hours';
import type { JsonLdValue } from '@/lib/seo/json-ld';
import { formatContactAddressLine } from '@/utils/address/address-line';
import type { PublicShowcase } from '@/types/agency-profile';
import type { ShowcaseLocation } from '@/types/showcase-card';

const SCHEMA_DAY: Readonly<Record<IsoWeekday, string>> = {
  1: 'https://schema.org/Monday',
  2: 'https://schema.org/Tuesday',
  3: 'https://schema.org/Wednesday',
  4: 'https://schema.org/Thursday',
  5: 'https://schema.org/Friday',
  6: 'https://schema.org/Saturday',
  7: 'https://schema.org/Sunday',
};

export interface ShowcaseStructuredDataContext {
  /** Απόλυτο URL της βιτρίνας — η **ταυτότητα** κάθε κόμβου (`@id`). */
  readonly profileUrl: string;
  /** Ο **ίδιος** κριτής με το κουμπί της σελίδας (`acceptsMandate`) — ποτέ δεύτερη κρίση εδώ. */
  readonly canHoldMandate: boolean;
}

/**
 * Α21.16.8 — **Google Search Central (LocalBusiness)**: «ανοιχτό 24 ώρες» = `opens 00:00` + `closes 23:59`·
 * μετά τα μεσάνυχτα = **μία** εγγραφή με `closes` μικρότερο του `opens` (το δικό μας σχήμα, αυτούσιο).
 * Άρα η μόνη μετάφραση είναι το `24:00` του σχήματος → `23:59`.
 */
const SCHEMA_END_OF_DAY = '23:59';

const schemaTime = (time: string): string => (time === END_OF_DAY ? SCHEMA_END_OF_DAY : time);

/**
 * **Ωράριο → `openingHoursSpecification`** — ημέρες με **ίδιο** διάστημα ομαδοποιούνται (όπως στα
 * παραδείγματα της Google)· σπαστό ωράριο = μία εγγραφή ανά διάστημα. Κλειστή ημέρα **παραλείπεται**.
 */
export function openingHoursSpecification(hours: WeeklyHours): JsonLdValue[] {
  const groups = new Map<string, { readonly opens: string; readonly closes: string; readonly days: string[] }>();
  for (const weekday of ISO_WEEKDAYS) {
    for (const interval of hours[weekday]) {
      const opens = interval.opens;
      const closes = schemaTime(interval.closes);
      const key = `${opens}-${closes}`;
      const group = groups.get(key) ?? { opens, closes, days: [] };
      group.days.push(SCHEMA_DAY[weekday]);
      groups.set(key, group);
    }
  }
  return [...groups.values()].map(({ opens, closes, days }) => ({
    '@type': 'OpeningHoursSpecification',
    dayOfWeek: days,
    opens,
    closes,
  }));
}

function organisationNode(showcase: PublicShowcase, organisationId: string, profileUrl: string): JsonLdValue {
  const mark = showcase.mark;
  return {
    '@type': 'Organization',
    '@id': organisationId,
    name: showcase.displayName,
    // Α21.17 — η **δική του** ιστοσελίδα όταν τη δήλωσε (αυτό σημαίνει `url` για τη Google)· αλλιώς η βιτρίνα.
    url: showcase.website ?? profileUrl,
    logo: mark?.kind === 'logo' ? mark.image.url : undefined,
    image: mark?.kind === 'portrait' ? mark.image.url : undefined,
  };
}

function locationNode(
  showcase: PublicShowcase,
  location: ShowcaseLocation & { readonly street: NonNullable<ShowcaseLocation['street']> },
  organisationId: string,
  context: ShowcaseStructuredDataContext,
): JsonLdValue {
  const { street, number, postalCode } = location.street;
  return {
    '@type': context.canHoldMandate ? 'RealEstateAgent' : 'LocalBusiness',
    '@id': `${context.profileUrl}#${location.id}`,
    name: location.label === null ? showcase.displayName : `${showcase.displayName} — ${location.label}`,
    url: showcase.website ?? context.profileUrl,
    parentOrganization: { '@id': organisationId },
    address: {
      '@type': 'PostalAddress',
      streetAddress: formatContactAddressLine({ street, number }),
      postalCode,
      addressCountry: 'GR',
    },
    geo:
      location.position === null
        ? undefined
        : { '@type': 'GeoCoordinates', latitude: location.position.lat, longitude: location.position.lng },
    openingHoursSpecification: location.hours === null ? undefined : openingHoursSpecification(location.hours),
  };
}

/** **Βιτρίνα → `@graph`**: ένας οργανισμός, και ένα κατάστημα για κάθε δημοσιευμένη οδό. */
export function showcaseStructuredData(showcase: PublicShowcase, context: ShowcaseStructuredDataContext): JsonLdValue {
  const organisationId = `${context.profileUrl}#organization`;
  const addressed = showcase.locations.filter(
    (location): location is ShowcaseLocation & { readonly street: NonNullable<ShowcaseLocation['street']> } =>
      location.street !== null,
  );
  return {
    '@context': 'https://schema.org',
    '@graph': [
      organisationNode(showcase, organisationId, context.profileUrl),
      ...addressed.map((location) => locationNode(showcase, location, organisationId, context)),
    ],
  };
}
