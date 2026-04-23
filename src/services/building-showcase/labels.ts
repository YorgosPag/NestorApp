/**
 * Building Showcase PDF labels — server-side i18n SSoT (ADR-320).
 *
 * Reads `src/i18n/locales/{el,en}/showcase.json` → `buildingShowcase` namespace
 * so the PDF generator never duplicates localised strings.
 *
 * Also exports inline label maps for building type, status, energy class and
 * renovation status (canonical enum arrays imported from leaf SSoT modules
 * in `@/constants/*`).
 *
 * @module services/building-showcase/labels
 */

import elShowcase from '@/i18n/locales/el/showcase.json';
import enShowcase from '@/i18n/locales/en/showcase.json';
import type { EnumLocale } from '@/services/property-enum-labels/property-enum-labels.service';
import type { ShowcaseHeaderContactLabels } from '@/services/property-showcase/labels';
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

export interface BuildingShowcaseHeaderLabels {
  subtitle: string;
  contacts: ShowcaseHeaderContactLabels;
}

export interface BuildingShowcasePDFLabels {
  specs: BuildingShowcaseSpecLabels;
  description: BuildingShowcaseDescriptionLabels;
  photos: BuildingShowcasePhotosLabels;
  floorplans: BuildingShowcaseFloorplansLabels;
  chrome: BuildingShowcasePdfChrome;
  email: BuildingShowcaseEmailLabels;
  header: BuildingShowcaseHeaderLabels;
}

// ============================================================================
// LOADER
// ============================================================================

const CATALOGS: Record<EnumLocale, ElShowcase> = {
  el: elShowcase as ElShowcase,
  en: enShowcase as unknown as ElShowcase,
};

function loadHeaderContactLabels(
  c: ElShowcase,
  locale: EnumLocale,
): ShowcaseHeaderContactLabels {
  const raw =
    (c as unknown as { header?: { contacts?: Record<string, string> } }).header?.contacts ?? {};
  const fb = (el: string, en: string) => (locale === 'el' ? el : en);
  return {
    addressLabel: raw.addressLabel ?? fb('Διεύθυνση', 'Address'),
    phoneLabel:   raw.phoneLabel   ?? fb('Τηλέφωνο', 'Phone'),
    emailLabel:   raw.emailLabel   ?? fb('Email', 'Email'),
    websiteLabel: raw.websiteLabel ?? fb('Ιστοσελίδα', 'Website'),
    socialLabel:  raw.socialLabel  ?? fb('Μέσα κοινωνικής δικτύωσης', 'Social media'),
  };
}

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

  const fallback = (el: string, en: string) => (locale === 'el' ? el : en);

  return {
    specs: {
      title:             specs.title             ?? fallback('Στοιχεία Κτηρίου', 'Building Details'),
      code:              specs.code              ?? fallback('Κωδικός', 'Code'),
      type:              specs.type              ?? fallback('Τύπος', 'Type'),
      status:            specs.status            ?? fallback('Κατάσταση', 'Status'),
      progress:          specs.progress          ?? fallback('Πρόοδος', 'Progress'),
      totalArea:         specs.totalArea         ?? fallback('Συνολικό εμβαδόν', 'Total area'),
      builtArea:         specs.builtArea         ?? fallback('Δομημένη επιφάνεια', 'Built area'),
      floors:            specs.floors            ?? fallback('Όροφοι', 'Floors'),
      units:             specs.units             ?? fallback('Μονάδες', 'Units'),
      totalValue:        specs.totalValue        ?? fallback('Συνολική αξία', 'Total value'),
      energyClass:       specs.energyClass       ?? fallback('Ενεργειακή κλάση', 'Energy class'),
      renovation:        specs.renovation        ?? fallback('Ανακαίνιση', 'Renovation'),
      constructionYear:  specs.constructionYear  ?? fallback('Έτος κατασκευής', 'Construction year'),
      startDate:         specs.startDate         ?? fallback('Έναρξη', 'Start date'),
      completionDate:    specs.completionDate    ?? fallback('Παράδοση', 'Completion date'),
      location:          specs.location          ?? fallback('Τοποθεσία', 'Location'),
      project:           specs.project           ?? fallback('Έργο', 'Project'),
      linkedCompany:     specs.linkedCompany     ?? fallback('Συνεργαζόμενη εταιρεία', 'Linked company'),
      areaUnit:          specs.areaUnit          ?? 'm²',
    },
    description: {
      sectionTitle: description.sectionTitle ?? fallback('Περιγραφή', 'Description'),
    },
    photos: {
      title: photos.title ?? fallback('Φωτογραφίες', 'Photos'),
    },
    floorplans: {
      title: floorplans.title ?? fallback('Κατόψεις', 'Floorplans'),
    },
    chrome: {
      title:              pdf.title              ?? fallback('Παρουσίαση Κτηρίου', 'Building Showcase'),
      generatedOn:        pdf.generatedOn        ?? fallback('Δημιουργήθηκε', 'Generated on'),
      descriptionSection: pdf.descriptionSection ?? fallback('Περιγραφή', 'Description'),
      footerNote:         pdf.footerNote         ?? fallback('Παρουσίαση κτηρίου', 'Building showcase'),
      photosTitle:        photos.title           ?? fallback('Φωτογραφίες', 'Photos'),
      floorplansTitle:    floorplans.title       ?? fallback('Κατόψεις', 'Floorplans'),
      poweredBy:          locale === 'el' ? 'Υλοποίηση από Nestor App' : 'Powered by Nestor App',
    },
    email: {
      subjectPrefix: email.subjectPrefix ?? fallback('Παρουσίαση Κτηρίου', 'Building Showcase'),
      introText:     email.introText     ?? fallback(
        'Σας προωθούμε την αναλυτική παρουσίαση του κτηρίου.',
        'We are sharing the detailed presentation of the building.',
      ),
      ctaLabel:      email.ctaLabel      ?? fallback('Δείτε online', 'View online'),
    },
    header: {
      subtitle: (header.subtitle as string | undefined) ?? fallback('Παρουσίαση κτηρίου', 'Building showcase'),
      contacts: loadHeaderContactLabels(c, locale),
    },
  };
}
