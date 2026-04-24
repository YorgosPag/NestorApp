/**
 * Project Showcase PDF labels — server-side i18n SSoT (ADR-316 + ADR-321 Phase 3).
 *
 * Reads `src/i18n/locales/{el,en}/showcase.json` → `projectShowcase` namespace
 * so the PDF generator never duplicates localised strings.
 *
 * Also exports inline label maps for project type + status (no separate
 * constants file exists for these enum labels). Chrome / email / header
 * fallbacks are delegated to `showcase-core/labels-shared` so all three
 * showcases share a single source of truth.
 *
 * @module services/project-showcase/labels
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

export type { ShowcaseHeaderContactLabels };

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

export interface ProjectShowcasePDFLabels {
  specs: ProjectShowcaseSpecLabels;
  description: ProjectShowcaseDescriptionLabels;
  photos: ProjectShowcasePhotosLabels;
  floorplans: ProjectShowcaseFloorplansLabels;
  chrome: ProjectShowcasePdfChrome;
  email: ProjectShowcaseEmailLabels;
  header: ShowcaseHeaderLabels;
}

// ============================================================================
// LOADER
// ============================================================================

const CATALOGS: Record<EnumLocale, ElShowcase> = {
  el: elShowcase as ElShowcase,
  en: enShowcase as unknown as ElShowcase,
};

export function loadProjectShowcasePdfLabels(locale: EnumLocale = 'el'): ProjectShowcasePDFLabels {
  const c = CATALOGS[locale];
  const ps = (c as unknown as { projectShowcase?: Record<string, unknown> }).projectShowcase ?? {};
  const fb = createLocaleFallback(locale);

  const specs = (ps.specs ?? {}) as Record<string, string>;
  const description = (ps.description ?? {}) as Record<string, string>;
  const photos = (ps.photos ?? {}) as Record<string, string>;
  const floorplans = (ps.floorplans ?? {}) as Record<string, string>;
  const pdf = (ps.pdf ?? {}) as Record<string, string>;
  const email = (ps.email ?? {}) as Record<string, string>;
  const header = (ps.header ?? {}) as Record<string, string>;

  return {
    specs: {
      title:          specs.title          ?? fb('Στοιχεία Έργου', 'Project Details'),
      code:           specs.code           ?? fb('Κωδικός', 'Code'),
      type:           specs.type           ?? fb('Τύπος', 'Type'),
      status:         specs.status         ?? fb('Κατάσταση', 'Status'),
      progress:       specs.progress       ?? fb('Πρόοδος', 'Progress'),
      totalArea:      specs.totalArea      ?? fb('Συνολικό εμβαδόν', 'Total area'),
      totalValue:     specs.totalValue     ?? fb('Συνολική αξία', 'Total value'),
      startDate:      specs.startDate      ?? fb('Έναρξη', 'Start date'),
      completionDate: specs.completionDate ?? fb('Παράδοση', 'Completion date'),
      areaUnit:       specs.areaUnit       ?? 'm²',
      location:       specs.location       ?? fb('Τοποθεσία', 'Location'),
      client:         specs.client         ?? fb('Πελάτης', 'Client'),
    },
    description: {
      sectionTitle: description.sectionTitle ?? showcaseDescriptionSectionDefault(locale),
    },
    photos: {
      title: photos.title ?? showcasePhotosTitleDefault(locale),
    },
    floorplans: {
      title: floorplans.title ?? showcaseFloorplansTitleDefault(locale),
    },
    chrome: {
      title:              pdf.title              ?? fb('Παρουσίαση Έργου', 'Project Showcase'),
      generatedOn:        pdf.generatedOn        ?? showcaseGeneratedOnDefault(locale),
      descriptionSection: pdf.descriptionSection ?? showcaseDescriptionSectionDefault(locale),
      footerNote:         pdf.footerNote         ?? fb('Παρουσίαση έργου', 'Project showcase'),
      photosTitle:        photos.title           ?? showcasePhotosTitleDefault(locale),
      floorplansTitle:    floorplans.title       ?? showcaseFloorplansTitleDefault(locale),
      poweredBy:          showcasePoweredByDefault(locale),
    },
    email: {
      subjectPrefix: email.subjectPrefix ?? fb('Παρουσίαση Έργου', 'Project Showcase'),
      introText:     email.introText     ?? fb('Σας προωθούμε την αναλυτική παρουσίαση του έργου.', 'We are sharing the detailed presentation of the project.'),
      ctaLabel:      email.ctaLabel      ?? showcaseCtaLabelDefault(locale),
    },
    header: {
      subtitle: (header.subtitle as string | undefined) ?? fb('Παρουσίαση έργου', 'Project showcase'),
      contacts: resolveHeaderContactLabels(
        (c as unknown as { header?: { contacts?: Record<string, unknown> } }).header?.contacts,
        locale,
      ),
    },
  };
}
