/**
 * Building Showcase PDF labels — server-side i18n SSoT (ADR-320 + ADR-321 Phase 2).
 *
 * Reads `src/i18n/locales/{el,en}/showcase.json` → `buildingShowcase` namespace
 * so the PDF generator never duplicates localised strings.
 *
 * Building-specific enum label maps stay inline (BUILDING_TYPE_LABELS /
 * BUILDING_STATUS_LABELS / RENOVATION_STATUS_LABELS). Chrome / email / header
 * fallbacks are delegated to `showcase-core/labels-shared` so all three
 * showcases share a single source of truth.
 *
 * @module services/building-showcase/labels
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
import type { BuildingType } from '@/constants/building-types';
import type { BuildingStatus } from '@/constants/building-statuses';
import type { RenovationStatus } from '@/constants/renovation-statuses';

// ============================================================================
// ENUM LABEL MAPS (inline — SSoT arrays imported from @/constants/*)
// ============================================================================

const BUILDING_TYPE_LABELS: Record<EnumLocale, Record<BuildingType, string>> = {
  el: {
    residential: 'Κατοικίες',
    commercial: 'Εμπορικό',
    industrial: 'Βιομηχανικό',
    mixed: 'Μικτή χρήση',
    office: 'Γραφεία',
    warehouse: 'Αποθήκη',
  },
  en: {
    residential: 'Residential',
    commercial: 'Commercial',
    industrial: 'Industrial',
    mixed: 'Mixed use',
    office: 'Office',
    warehouse: 'Warehouse',
  },
};

const BUILDING_STATUS_LABELS: Record<EnumLocale, Record<BuildingStatus, string>> = {
  el: {
    planning: 'Σχεδιασμός',
    construction: 'Υπό κατασκευή',
    completed: 'Ολοκληρωμένο',
    active: 'Ενεργό',
    deleted: 'Διαγραμμένο',
  },
  en: {
    planning: 'Planning',
    construction: 'Under construction',
    completed: 'Completed',
    active: 'Active',
    deleted: 'Deleted',
  },
};

const RENOVATION_STATUS_LABELS: Record<EnumLocale, Record<RenovationStatus, string>> = {
  el: {
    none: 'Χωρίς ανακαίνιση',
    partial: 'Μερική ανακαίνιση',
    full: 'Πλήρης ανακαίνιση',
    planned: 'Προγραμματισμένη',
  },
  en: {
    none: 'No renovation',
    partial: 'Partial renovation',
    full: 'Full renovation',
    planned: 'Planned',
  },
};

export function translateBuildingType(
  type: string | undefined,
  locale: EnumLocale,
): string | undefined {
  if (!type) return undefined;
  const map = BUILDING_TYPE_LABELS[locale] as Record<string, string>;
  return map[type] ?? type;
}

export function translateBuildingStatus(
  status: string | undefined,
  locale: EnumLocale,
): string | undefined {
  if (!status) return undefined;
  const map = BUILDING_STATUS_LABELS[locale] as Record<string, string>;
  return map[status] ?? status;
}

export function translateRenovationStatus(
  status: string | undefined,
  locale: EnumLocale,
): string | undefined {
  if (!status) return undefined;
  const map = RENOVATION_STATUS_LABELS[locale] as Record<string, string>;
  return map[status] ?? status;
}

// ============================================================================
// PDF LABEL TYPES
// ============================================================================

type ElShowcase = typeof elShowcase;

export interface BuildingShowcaseSpecLabels {
  title: string;
  code: string;
  type: string;
  status: string;
  progress: string;
  totalArea: string;
  builtArea: string;
  floors: string;
  units: string;
  totalValue: string;
  energyClass: string;
  renovation: string;
  constructionYear: string;
  startDate: string;
  completionDate: string;
  location: string;
  project: string;
  linkedCompany: string;
  areaUnit: string;
}

export interface BuildingShowcaseDescriptionLabels {
  sectionTitle: string;
}

export interface BuildingShowcasePhotosLabels {
  title: string;
}

export interface BuildingShowcaseFloorplansLabels {
  title: string;
}

export interface BuildingShowcasePdfChrome {
  title: string;
  generatedOn: string;
  descriptionSection: string;
  footerNote: string;
  photosTitle: string;
  floorplansTitle: string;
  poweredBy: string;
}

export interface BuildingShowcaseEmailLabels {
  subjectPrefix: string;
  introText: string;
  ctaLabel: string;
}

export type BuildingShowcaseHeaderLabels = ShowcaseHeaderLabels;

export interface BuildingShowcasePDFLabels {
  specs: BuildingShowcaseSpecLabels;
  description: BuildingShowcaseDescriptionLabels;
  photos: BuildingShowcasePhotosLabels;
  floorplans: BuildingShowcaseFloorplansLabels;
  chrome: BuildingShowcasePdfChrome;
  email: BuildingShowcaseEmailLabels;
  header: BuildingShowcaseHeaderLabels;
}

export type { ShowcaseHeaderContactLabels };

// ============================================================================
// LOADER
// ============================================================================

const CATALOGS: Record<EnumLocale, ElShowcase> = {
  el: elShowcase as ElShowcase,
  en: enShowcase as unknown as ElShowcase,
};

export function loadBuildingShowcasePdfLabels(
  locale: EnumLocale = 'el',
): BuildingShowcasePDFLabels {
  const c = CATALOGS[locale];
  const bs = (c as unknown as { buildingShowcase?: Record<string, unknown> }).buildingShowcase ?? {};

  const specs = (bs.specs ?? {}) as Record<string, string>;
  const description = (bs.description ?? {}) as Record<string, string>;
  const photos = (bs.photos ?? {}) as Record<string, string>;
  const floorplans = (bs.floorplans ?? {}) as Record<string, string>;
  const pdf = (bs.pdf ?? {}) as Record<string, string>;
  const email = (bs.email ?? {}) as Record<string, string>;
  const header = (bs.header ?? {}) as Record<string, string>;
  const headerContacts = (c as unknown as { header?: { contacts?: Record<string, string> } })
    .header?.contacts;

  const fb = createLocaleFallback(locale);
  const photosTitle = photos.title ?? showcasePhotosTitleDefault(locale);
  const floorplansTitle = floorplans.title ?? showcaseFloorplansTitleDefault(locale);

  return {
    specs: {
      title:             specs.title             ?? fb('Στοιχεία Κτηρίου', 'Building Details'),
      code:              specs.code              ?? fb('Κωδικός', 'Code'),
      type:              specs.type              ?? fb('Τύπος', 'Type'),
      status:            specs.status            ?? fb('Κατάσταση', 'Status'),
      progress:          specs.progress          ?? fb('Πρόοδος', 'Progress'),
      totalArea:         specs.totalArea         ?? fb('Συνολικό εμβαδόν', 'Total area'),
      builtArea:         specs.builtArea         ?? fb('Δομημένη επιφάνεια', 'Built area'),
      floors:            specs.floors            ?? fb('Όροφοι', 'Floors'),
      units:             specs.units             ?? fb('Μονάδες', 'Units'),
      totalValue:        specs.totalValue        ?? fb('Συνολική αξία', 'Total value'),
      energyClass:       specs.energyClass       ?? fb('Ενεργειακή κλάση', 'Energy class'),
      renovation:        specs.renovation        ?? fb('Ανακαίνιση', 'Renovation'),
      constructionYear:  specs.constructionYear  ?? fb('Έτος κατασκευής', 'Construction year'),
      startDate:         specs.startDate         ?? fb('Έναρξη', 'Start date'),
      completionDate:    specs.completionDate    ?? fb('Παράδοση', 'Completion date'),
      location:          specs.location          ?? fb('Τοποθεσία', 'Location'),
      project:           specs.project           ?? fb('Έργο', 'Project'),
      linkedCompany:     specs.linkedCompany     ?? fb('Συνεργαζόμενη εταιρεία', 'Linked company'),
      areaUnit:          specs.areaUnit          ?? 'm²',
    },
    description: {
      sectionTitle: description.sectionTitle ?? showcaseDescriptionSectionDefault(locale),
    },
    photos: { title: photosTitle },
    floorplans: { title: floorplansTitle },
    chrome: {
      title:              pdf.title              ?? fb('Παρουσίαση Κτηρίου', 'Building Showcase'),
      generatedOn:        pdf.generatedOn        ?? showcaseGeneratedOnDefault(locale),
      descriptionSection: pdf.descriptionSection ?? showcaseDescriptionSectionDefault(locale),
      footerNote:         pdf.footerNote         ?? fb('Παρουσίαση κτηρίου', 'Building showcase'),
      photosTitle,
      floorplansTitle,
      poweredBy:          showcasePoweredByDefault(locale),
    },
    email: {
      subjectPrefix: email.subjectPrefix ?? fb('Παρουσίαση Κτηρίου', 'Building Showcase'),
      introText:     email.introText     ?? fb(
        'Σας προωθούμε την αναλυτική παρουσίαση του κτηρίου.',
        'We are sharing the detailed presentation of the building.',
      ),
      ctaLabel:      email.ctaLabel      ?? showcaseCtaLabelDefault(locale),
    },
    header: {
      subtitle: (header.subtitle as string | undefined) ?? fb('Παρουσίαση κτηρίου', 'Building showcase'),
      contacts: resolveHeaderContactLabels(headerContacts, locale),
    },
  };
}
