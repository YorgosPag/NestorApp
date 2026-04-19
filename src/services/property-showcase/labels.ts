/**
 * Showcase PDF labels — server-side i18n SSoT.
 *
 * Reads `src/i18n/locales/{el,en}/showcase.json` directly (same pattern as
 * `property-enum-labels.service`) so the PDF generator never duplicates
 * localised strings. Every label the renderer needs is loaded here, keyed to
 * the exact JSON paths used by the web `ShowcaseClient` component.
 *
 * @module services/property-showcase/labels
 * @enterprise ADR-312 Phase 4 — replaces hard-coded `buildShowcaseLabels`
 */

import elShowcase from '@/i18n/locales/el/showcase.json';
import enShowcase from '@/i18n/locales/en/showcase.json';
import type { EnumLocale } from '@/services/property-enum-labels/property-enum-labels.service';

const CATALOGS: Record<EnumLocale, typeof elShowcase> = {
  el: elShowcase as typeof elShowcase,
  en: enShowcase as unknown as typeof elShowcase,
};

export interface ShowcaseSpecLabels {
  title: string;
  areaUnit: string;
  type: string;
  code: string;
  building: string;
  floor: string;
  grossArea: string;
  netArea: string;
  balcony: string;
  terrace: string;
  garden: string;
  millesimalShares: string;
  bedrooms: string;
  bathrooms: string;
  wc: string;
  totalRooms: string;
  balconies: string;
  orientation: string;
  energyClass: string;
  condition: string;
  renovationYear: string;
  deliveryDate: string;
}

export interface ShowcaseProjectLabels {
  sectionTitle: string;
  name: string;
  address: string;
}

export interface ShowcaseCommercialLabels {
  sectionTitle: string;
  availability: string;
  operational: string;
  price: string;
}

export interface ShowcaseSystemsLabels {
  sectionTitle: string;
  heating: string;
  heatingFuel: string;
  cooling: string;
  waterHeating: string;
}

export interface ShowcaseFinishesLabels {
  sectionTitle: string;
  flooring: string;
  frames: string;
  glazing: string;
}

export interface ShowcaseFeaturesLabels {
  sectionTitle: string;
  interior: string;
  security: string;
  amenities: string;
}

export interface ShowcaseEnergyLabels {
  sectionTitle: string;
  energyClass: string;
  certificateId: string;
  certificateDate: string;
  validUntil: string;
}

export interface ShowcaseOrientationLabels {
  sectionTitle: string;
}

export interface ShowcaseLinkedSpacesLabels {
  sectionTitle: string;
  parking: string;
  storage: string;
  floor: string;
  inclusion: string;
  quantity: string;
  inclusions: {
    included: string;
    optional: string;
    rented: string;
  };
}

export interface ShowcaseLinkedSpacesFloorplansLabels {
  sectionTitle: string;
  parkingColumn: string;
  storageColumn: string;
  emptyParking: string;
  emptyStorage: string;
  unnamedSpace: string;
  floorSubtitle: string;
}

export interface ShowcaseFloorplansLabels {
  title: string;
  floorSubtitle: string;
}

export interface ShowcasePdfChrome {
  title: string;
  generatedOn: string;
  descriptionSection: string;
  footerNote: string;
  photosTitle: string;
  floorplansTitle: string;
  viewsTitle: string;
  /** "Powered by Nestor App" label shown in the PDF footer (ADR-312 Phase 8). */
  poweredBy: string;
}

export interface ShowcaseEmailLabels {
  /** Subject line prefix — e.g. "Παρουσίαση Ακινήτου". */
  subjectPrefix: string;
  /** Short introduction sentence shown above the hero block. */
  introText: string;
  /** Primary CTA button label pointing to the web showcase. */
  ctaLabel: string;
}

export interface ShowcaseHeaderContactLabels {
  addressLabel: string;
  phoneLabel: string;
  emailLabel: string;
  websiteLabel: string;
  socialLabel: string;
}

export interface ShowcaseHeaderLabels {
  subtitle: string;
  contacts: ShowcaseHeaderContactLabels;
}

export interface PropertyShowcasePDFLabels {
  specs: ShowcaseSpecLabels;
  project: ShowcaseProjectLabels;
  commercial: ShowcaseCommercialLabels;
  systems: ShowcaseSystemsLabels;
  finishes: ShowcaseFinishesLabels;
  features: ShowcaseFeaturesLabels;
  energy: ShowcaseEnergyLabels;
  orientation: ShowcaseOrientationLabels;
  linkedSpaces: ShowcaseLinkedSpacesLabels;
  linkedSpacesFloorplans: ShowcaseLinkedSpacesFloorplansLabels;
  floorplans: ShowcaseFloorplansLabels;
  chrome: ShowcasePdfChrome;
  email: ShowcaseEmailLabels;
  header: ShowcaseHeaderLabels;
}

export function loadShowcasePdfLabels(locale: EnumLocale = 'el'): PropertyShowcasePDFLabels {
  const c = CATALOGS[locale];
  return {
    specs: c.specs as unknown as ShowcaseSpecLabels,
    project: c.project as unknown as ShowcaseProjectLabels,
    commercial: c.commercial as unknown as ShowcaseCommercialLabels,
    systems: c.systems as unknown as ShowcaseSystemsLabels,
    finishes: c.finishes as unknown as ShowcaseFinishesLabels,
    features: c.features as unknown as ShowcaseFeaturesLabels,
    energy: c.energy as unknown as ShowcaseEnergyLabels,
    orientation: (c as { orientation?: ShowcaseOrientationLabels }).orientation ?? {
      sectionTitle: locale === 'el' ? 'Προσανατολισμός' : 'Orientation',
    },
    linkedSpaces: c.linkedSpaces as unknown as ShowcaseLinkedSpacesLabels,
    linkedSpacesFloorplans: (c as { linkedSpacesFloorplans?: ShowcaseLinkedSpacesFloorplansLabels })
      .linkedSpacesFloorplans ?? {
        sectionTitle: locale === 'el' ? 'Κατόψεις συνδεδεμένων χώρων' : 'Linked spaces floorplans',
        parkingColumn: locale === 'el' ? 'Κατόψεις θέσεων στάθμευσης' : 'Parking floorplans',
        storageColumn: locale === 'el' ? 'Κατόψεις αποθηκών' : 'Storage floorplans',
        emptyParking: locale === 'el'
          ? 'Δεν υπάρχουν κατόψεις για τις θέσεις στάθμευσης'
          : 'No parking floorplans available',
        emptyStorage: locale === 'el'
          ? 'Δεν υπάρχουν κατόψεις για τις αποθήκες'
          : 'No storage floorplans available',
        unnamedSpace: locale === 'el' ? 'Χωρίς κωδικό' : 'Unlabeled',
        floorSubtitle: locale === 'el' ? 'Κάτοψη ορόφου' : 'Floor plan',
      },
    floorplans: (c as { floorplans?: ShowcaseFloorplansLabels }).floorplans
      ? {
          title: (c as { floorplans: ShowcaseFloorplansLabels }).floorplans.title,
          floorSubtitle:
            (c as { floorplans: ShowcaseFloorplansLabels }).floorplans.floorSubtitle
            ?? (locale === 'el' ? 'Κάτοψη ορόφου' : 'Floor plan'),
        }
      : {
          title: locale === 'el' ? 'Κατόψεις' : 'Floorplans',
          floorSubtitle: locale === 'el' ? 'Κάτοψη ορόφου' : 'Floor plan',
        },
    chrome: {
      title: (c as { pdf?: { title?: string } }).pdf?.title ?? 'Property Showcase',
      generatedOn: (c as { pdf?: { generatedOn?: string } }).pdf?.generatedOn ?? 'Generated on',
      descriptionSection:
        (c as { pdf?: { descriptionSection?: string } }).pdf?.descriptionSection ?? 'Description',
      footerNote: (c as { pdf?: { footerNote?: string } }).pdf?.footerNote ?? 'Property showcase',
      photosTitle: c.photos.title,
      floorplansTitle: c.floorplans.title,
      viewsTitle: c.views.sectionTitle,
      poweredBy:
        (c as { brand?: { poweredBy?: string } }).brand?.poweredBy
        ?? (locale === 'el' ? 'Υλοποίηση από Nestor App' : 'Powered by Nestor App'),
    },
    email: {
      subjectPrefix:
        (c as { email?: { subjectPrefix?: string } }).email?.subjectPrefix
        ?? (locale === 'el' ? 'Παρουσίαση Ακινήτου' : 'Property Showcase'),
      introText:
        (c as { email?: { introText?: string } }).email?.introText
        ?? (locale === 'el'
          ? 'Σας προωθούμε την αναλυτική παρουσίαση του ακινήτου.'
          : 'We are sharing the detailed presentation of the property.'),
      ctaLabel:
        (c as { email?: { ctaLabel?: string } }).email?.ctaLabel
        ?? (locale === 'el' ? 'Δείτε online' : 'View online'),
    },
    header: {
      subtitle:
        (c as { header?: { subtitle?: string } }).header?.subtitle
        ?? (locale === 'el' ? 'Παρουσίαση ακινήτου' : 'Property showcase'),
      contacts: {
        addressLabel:
          (c as { header?: { contacts?: { addressLabel?: string } } }).header?.contacts?.addressLabel
          ?? (locale === 'el' ? 'Διεύθυνση' : 'Address'),
        phoneLabel:
          (c as { header?: { contacts?: { phoneLabel?: string } } }).header?.contacts?.phoneLabel
          ?? (locale === 'el' ? 'Τηλέφωνο' : 'Phone'),
        emailLabel:
          (c as { header?: { contacts?: { emailLabel?: string } } }).header?.contacts?.emailLabel
          ?? 'Email',
        websiteLabel:
          (c as { header?: { contacts?: { websiteLabel?: string } } }).header?.contacts?.websiteLabel
          ?? (locale === 'el' ? 'Ιστοσελίδα' : 'Website'),
        socialLabel:
          (c as { header?: { contacts?: { socialLabel?: string } } }).header?.contacts?.socialLabel
          ?? (locale === 'el' ? 'Κοινωνικά δίκτυα' : 'Social media'),
      },
    },
  };
}
