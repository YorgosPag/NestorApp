/**
 * Showcase PDF labels — server-side i18n SSoT (ADR-312 + ADR-321 Phase 4).
 *
 * Reads `src/i18n/locales/{el,en}/showcase.json` directly so the PDF
 * generator never duplicates localised strings. Chrome / email / header
 * fallbacks are delegated to `showcase-core/labels-shared` (ADR-321 SSoT).
 *
 * @module services/property-showcase/labels
 */

import elShowcase from '@/i18n/locales/el/showcase.json';
import enShowcase from '@/i18n/locales/en/showcase.json';
import type { EnumLocale } from '@/services/property-enum-labels/property-enum-labels.service';
import {
  createLocaleFallback,
  resolveHeaderContactLabels,
  showcaseCtaLabelDefault,
  showcaseDescriptionSectionDefault,
  showcaseFloorplansTitleDefault,
  showcaseGeneratedOnDefault,
  showcasePhotosTitleDefault,
  showcasePoweredByDefault,
  type ShowcaseHeaderContactLabels,
  type ShowcaseHeaderLabels,
} from '@/services/showcase-core/labels-shared';

export type { ShowcaseHeaderContactLabels, ShowcaseHeaderLabels };

type ElShowcase = typeof elShowcase;

const CATALOGS: Record<EnumLocale, ElShowcase> = {
  el: elShowcase as ElShowcase,
  en: enShowcase as unknown as ElShowcase,
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
  const raw = c as unknown as Record<string, Record<string, unknown>>;
  const fb = createLocaleFallback(locale);

  const pdf = (raw.pdf ?? {}) as Record<string, string>;
  const email = (raw.email ?? {}) as Record<string, string>;

  const floorplansRaw = (raw.floorplans ?? {}) as Record<string, string>;
  const floorplans: ShowcaseFloorplansLabels = {
    title:        floorplansRaw.title        ?? showcaseFloorplansTitleDefault(locale),
    floorSubtitle: floorplansRaw.floorSubtitle ?? fb('Κάτοψη ορόφου', 'Floor plan'),
  };

  const linkedSpacesFloorplansRaw = (raw.linkedSpacesFloorplans ?? {}) as Record<string, string>;
  const linkedSpacesFloorplans: ShowcaseLinkedSpacesFloorplansLabels = {
    sectionTitle:  linkedSpacesFloorplansRaw.sectionTitle  ?? fb('Κατόψεις συνδεδεμένων χώρων', 'Linked spaces floorplans'),
    parkingColumn: linkedSpacesFloorplansRaw.parkingColumn ?? fb('Κατόψεις θέσεων στάθμευσης', 'Parking floorplans'),
    storageColumn: linkedSpacesFloorplansRaw.storageColumn ?? fb('Κατόψεις αποθηκών', 'Storage floorplans'),
    emptyParking:  linkedSpacesFloorplansRaw.emptyParking  ?? fb('Δεν υπάρχουν κατόψεις για τις θέσεις στάθμευσης', 'No parking floorplans available'),
    emptyStorage:  linkedSpacesFloorplansRaw.emptyStorage  ?? fb('Δεν υπάρχουν κατόψεις για τις αποθήκες', 'No storage floorplans available'),
    unnamedSpace:  linkedSpacesFloorplansRaw.unnamedSpace  ?? fb('Χωρίς κωδικό', 'Unlabeled'),
    floorSubtitle: linkedSpacesFloorplansRaw.floorSubtitle ?? fb('Κάτοψη ορόφου', 'Floor plan'),
  };

  const orientationRaw = (raw.orientation ?? {}) as Record<string, string>;

  return {
    specs:                 c.specs as unknown as ShowcaseSpecLabels,
    project:               c.project as unknown as ShowcaseProjectLabels,
    commercial:            c.commercial as unknown as ShowcaseCommercialLabels,
    systems:               c.systems as unknown as ShowcaseSystemsLabels,
    finishes:              c.finishes as unknown as ShowcaseFinishesLabels,
    features:              c.features as unknown as ShowcaseFeaturesLabels,
    energy:                c.energy as unknown as ShowcaseEnergyLabels,
    orientation: {
      sectionTitle: orientationRaw.sectionTitle ?? fb('Προσανατολισμός', 'Orientation'),
    },
    linkedSpaces:          c.linkedSpaces as unknown as ShowcaseLinkedSpacesLabels,
    linkedSpacesFloorplans,
    floorplans,
    chrome: {
      title:              pdf.title              ?? fb('Property Showcase', 'Property Showcase'),
      generatedOn:        pdf.generatedOn        ?? showcaseGeneratedOnDefault(locale),
      descriptionSection: pdf.descriptionSection ?? showcaseDescriptionSectionDefault(locale),
      footerNote:         pdf.footerNote         ?? fb('Property showcase', 'Property showcase'),
      photosTitle:        (c.photos as unknown as { title: string }).title ?? showcasePhotosTitleDefault(locale),
      floorplansTitle:    floorplans.title,
      viewsTitle:         (c.views as unknown as { sectionTitle: string }).sectionTitle ?? fb('Θέα', 'Views'),
      poweredBy:          showcasePoweredByDefault(locale),
    },
    email: {
      subjectPrefix: email.subjectPrefix ?? fb('Παρουσίαση Ακινήτου', 'Property Showcase'),
      introText:     email.introText     ?? fb('Σας προωθούμε την αναλυτική παρουσίαση του ακινήτου.', 'We are sharing the detailed presentation of the property.'),
      ctaLabel:      email.ctaLabel      ?? showcaseCtaLabelDefault(locale),
    },
    header: {
      subtitle: ((raw.header ?? {}) as Record<string, string>).subtitle ?? fb('Παρουσίαση ακινήτου', 'Property showcase'),
      contacts: resolveHeaderContactLabels(
        (c as unknown as { header?: { contacts?: Record<string, unknown> } }).header?.contacts,
        locale,
      ),
    },
  };
}
