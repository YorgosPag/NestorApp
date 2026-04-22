/**
 * Project Showcase PDF labels — server-side i18n SSoT (ADR-316).
 *
 * Reads `src/i18n/locales/{el,en}/showcase.json` → `projectShowcase` namespace
 * so the PDF generator never duplicates localised strings.
 *
 * Also exports inline label maps for project type + status (no separate
 * constants file exists for these enum labels).
 *
 * @module services/project-showcase/labels
 */

import elShowcase from '@/i18n/locales/el/showcase.json';
import enShowcase from '@/i18n/locales/en/showcase.json';
import type { EnumLocale } from '@/services/property-enum-labels/property-enum-labels.service';
import type { ShowcaseHeaderContactLabels } from '@/services/property-showcase/labels';

// ============================================================================
// ENUM LABEL MAPS (inline — no centralised label service for project types)
// ============================================================================

const PROJECT_TYPE_LABELS: Record<EnumLocale, Record<string, string>> = {
  el: {
    residential: 'Κατοικίες',
    commercial: 'Εμπορικό',
    mixed: 'Μικτό',
    industrial: 'Βιομηχανικό',
    office: 'Γραφεία',
    hotel: 'Ξενοδοχείο',
    infrastructure: 'Υποδομές',
    renovation: 'Ανακαίνιση',
    other: 'Άλλο',
  },
  en: {
    residential: 'Residential',
    commercial: 'Commercial',
    mixed: 'Mixed use',
    industrial: 'Industrial',
    office: 'Office',
    hotel: 'Hotel',
    infrastructure: 'Infrastructure',
    renovation: 'Renovation',
    other: 'Other',
  },
};

const PROJECT_STATUS_LABELS: Record<EnumLocale, Record<string, string>> = {
  el: {
    planning: 'Σχεδιασμός',
    in_progress: 'Σε εξέλιξη',
    completed: 'Ολοκληρωμένο',
    on_hold: 'Σε αναμονή',
    cancelled: 'Ακυρωμένο',
  },
  en: {
    planning: 'Planning',
    in_progress: 'In progress',
    completed: 'Completed',
    on_hold: 'On hold',
    cancelled: 'Cancelled',
  },
};

export function translateProjectType(type: string | undefined, locale: EnumLocale): string | undefined {
  if (!type) return undefined;
  return PROJECT_TYPE_LABELS[locale][type] ?? type;
}

export function translateProjectStatus(status: string | undefined, locale: EnumLocale): string | undefined {
  if (!status) return undefined;
  return PROJECT_STATUS_LABELS[locale][status] ?? status;
}

// ============================================================================
// PDF LABEL TYPES
// ============================================================================

type ElShowcase = typeof elShowcase;

export interface ProjectShowcaseSpecLabels {
  title: string;
  code: string;
  type: string;
  status: string;
  progress: string;
  totalArea: string;
  totalValue: string;
  startDate: string;
  completionDate: string;
  areaUnit: string;
  location: string;
  client: string;
}

export interface ProjectShowcaseDescriptionLabels {
  sectionTitle: string;
}

export interface ProjectShowcasePhotosLabels {
  title: string;
}

export interface ProjectShowcaseFloorplansLabels {
  title: string;
}

export interface ProjectShowcasePdfChrome {
  title: string;
  generatedOn: string;
  descriptionSection: string;
  footerNote: string;
  photosTitle: string;
  floorplansTitle: string;
  poweredBy: string;
}

export interface ProjectShowcaseEmailLabels {
  subjectPrefix: string;
  introText: string;
  ctaLabel: string;
}

export interface ProjectShowcaseHeaderLabels {
  subtitle: string;
  contacts: ShowcaseHeaderContactLabels;
}

export interface ProjectShowcasePDFLabels {
  specs: ProjectShowcaseSpecLabels;
  description: ProjectShowcaseDescriptionLabels;
  photos: ProjectShowcasePhotosLabels;
  floorplans: ProjectShowcaseFloorplansLabels;
  chrome: ProjectShowcasePdfChrome;
  email: ProjectShowcaseEmailLabels;
  header: ProjectShowcaseHeaderLabels;
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
  const raw = (c as unknown as { header?: { contacts?: Record<string, string> } }).header?.contacts ?? {};
  const fb = (el: string, en: string) => (locale === 'el' ? el : en);
  return {
    addressLabel: raw.addressLabel ?? fb('Διεύθυνση', 'Address'),
    phoneLabel:   raw.phoneLabel   ?? fb('Τηλέφωνο', 'Phone'),
    emailLabel:   raw.emailLabel   ?? fb('Email', 'Email'),
    websiteLabel: raw.websiteLabel ?? fb('Ιστοσελίδα', 'Website'),
    socialLabel:  raw.socialLabel  ?? fb('Μέσα κοινωνικής δικτύωσης', 'Social media'),
  };
}

export function loadProjectShowcasePdfLabels(locale: EnumLocale = 'el'): ProjectShowcasePDFLabels {
  const c = CATALOGS[locale];
  const ps = (c as unknown as { projectShowcase?: Record<string, unknown> }).projectShowcase ?? {};

  const specs = (ps.specs ?? {}) as Record<string, string>;
  const description = (ps.description ?? {}) as Record<string, string>;
  const photos = (ps.photos ?? {}) as Record<string, string>;
  const floorplans = (ps.floorplans ?? {}) as Record<string, string>;
  const pdf = (ps.pdf ?? {}) as Record<string, string>;
  const email = (ps.email ?? {}) as Record<string, string>;
  const header = (ps.header ?? {}) as Record<string, string>;

  const fallback = (key: string, el: string, en: string) =>
    (locale === 'el' ? el : en);

  return {
    specs: {
      title:          specs.title          ?? fallback('title', 'Στοιχεία Έργου', 'Project Details'),
      code:           specs.code           ?? fallback('code', 'Κωδικός', 'Code'),
      type:           specs.type           ?? fallback('type', 'Τύπος', 'Type'),
      status:         specs.status         ?? fallback('status', 'Κατάσταση', 'Status'),
      progress:       specs.progress       ?? fallback('progress', 'Πρόοδος', 'Progress'),
      totalArea:      specs.totalArea      ?? fallback('totalArea', 'Συνολικό εμβαδόν', 'Total area'),
      totalValue:     specs.totalValue     ?? fallback('totalValue', 'Συνολική αξία', 'Total value'),
      startDate:      specs.startDate      ?? fallback('startDate', 'Έναρξη', 'Start date'),
      completionDate: specs.completionDate ?? fallback('completionDate', 'Παράδοση', 'Completion date'),
      areaUnit:       specs.areaUnit       ?? 'm²',
      location:       specs.location       ?? fallback('location', 'Τοποθεσία', 'Location'),
      client:         specs.client         ?? fallback('client', 'Πελάτης', 'Client'),
    },
    description: {
      sectionTitle: description.sectionTitle ?? fallback('desc', 'Περιγραφή', 'Description'),
    },
    photos: {
      title: photos.title ?? fallback('photos', 'Φωτογραφίες', 'Photos'),
    },
    floorplans: {
      title: floorplans.title ?? fallback('floorplans', 'Κατόψεις', 'Floorplans'),
    },
    chrome: {
      title:              pdf.title              ?? fallback('pdfTitle', 'Παρουσίαση Έργου', 'Project Showcase'),
      generatedOn:        pdf.generatedOn        ?? fallback('gen', 'Δημιουργήθηκε', 'Generated on'),
      descriptionSection: pdf.descriptionSection ?? fallback('desc', 'Περιγραφή', 'Description'),
      footerNote:         pdf.footerNote         ?? fallback('footer', 'Παρουσίαση έργου', 'Project showcase'),
      photosTitle:        photos.title           ?? fallback('photos', 'Φωτογραφίες', 'Photos'),
      floorplansTitle:    floorplans.title       ?? fallback('floorplans', 'Κατόψεις', 'Floorplans'),
      poweredBy:          locale === 'el' ? 'Υλοποίηση από Nestor App' : 'Powered by Nestor App',
    },
    email: {
      subjectPrefix: email.subjectPrefix ?? fallback('sub', 'Παρουσίαση Έργου', 'Project Showcase'),
      introText:     email.introText     ?? fallback('intro', 'Σας προωθούμε την αναλυτική παρουσίαση του έργου.', 'We are sharing the detailed presentation of the project.'),
      ctaLabel:      email.ctaLabel      ?? fallback('cta', 'Δείτε online', 'View online'),
    },
    header: {
      subtitle: (header.subtitle as string | undefined) ?? fallback('sub', 'Παρουσίαση έργου', 'Project showcase'),
      contacts: loadHeaderContactLabels(c, locale),
    },
  };
}
