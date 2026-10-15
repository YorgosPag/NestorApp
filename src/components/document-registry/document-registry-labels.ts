/**
 * @fileoverview **Οι λέξεις του μητρώου λήξεων** — κάθε χάρτης δεμένος στη ρίζα του λεξιλογίου (ADR-915 Φ4γ).
 * @related lib/document-validity/document-registry.ts · lib/document-validity/document-registry-view.ts ·
 *   components/mandate/catalog/mandate-catalog-labels.ts (το ιδίωμα)
 * @module components/document-registry/document-registry-labels
 *
 * 🔑 **`Record<Ρίζα, …>`, ποτέ `Record<string, …>`** (CHECK 3.73): μια νέα κατάσταση, φίλτρο, είδος ή διαδικασία
 *    **δεν μεταγλωττίζεται** μέχρι να αποκτήσει λέξη — και εικονίδιο, για να αναγνωρίζεται χωρίς χρώμα (CHECK 3.41).
 *
 * 🔑 **Τα ονόματα εγγράφων ΔΕΝ ξαναγράφονται**: το ΠΕΑ ονομάζεται ήδη στον κατάλογο μεταβίβασης και η ταυτότητα κτιρίου
 *    στη νομιμότητα — το ίδιο έγγραφο, ένα όνομα. Το ίδιο και η πρόταση ασυμφωνίας της Α4.
 *
 * ⚠️ Κυριολεκτικά κλειδιά (template σε σταθερά module): ο γεννήτορας του route slice τα **λύνει** στατικά.
 */

import {
  CalendarCheck2,
  CalendarClock,
  CalendarX2,
  CircleHelp,
  FileX2,
  History,
  type LucideIcon,
} from 'lucide-react';

import type { DocumentKind } from '@/config/document-validity/document-validity';
import type { RegistryRowState } from '@/lib/document-validity/document-registry';
import type { RegistryView } from '@/lib/document-validity/document-registry-view';
import type {
  DependentImpact,
  DocumentProcess,
  RequirementPolicy,
} from '@/lib/document-validity/document-requirement';
import type { StatsCardColor } from '@/components/property-management/dashboard/StatsCard';
import type { BadgeVariantProps } from '@/components/ui/badge';
import type { RegistrySource } from '@/services/document-registry/document-registry.types';

export const REGISTRY_NS = 'document-registry';
/** Τα namespaces των **δανεικών** ονομάτων (είδος εγγράφου · ασυμφωνία Α4).
 *  ⚠️ Οι καλούντες γράφουν `useTranslation([REGISTRY_NS, CONVEYANCE_NS, LEGALITY_NS])` ως **κυριολεκτικό πίνακα**: ο
 *     γεννήτορας του route slice διαβάζει στατικά το όρισμα — ένα spread θα άφηνε τα κλειδιά «χωρίς namespace». */
export const CONVEYANCE_NS = 'conveyance';
export const LEGALITY_NS = 'legality';

const K = 'document-registry:';

export const REGISTRY_KEYS = {
  title: `${K}page.title`,
  lead: `${K}page.lead`,
  asOf: `${K}page.asOf`,
  loading: `${K}load.loading`,
  error: `${K}load.error`,
  retry: `${K}load.retry`,
  tallyHeading: `${K}tally.heading`,
  groupCount: `${K}group.count`,
  filterLabel: `${K}filter.label`,
  filterOption: `${K}filter.option`,
  filterEmpty: `${K}filter.empty`,
  property: `${K}row.property`,
  propertyNone: `${K}row.propertyNone`,
  propertyUnnamed: `${K}row.propertyUnnamed`,
  document: `${K}row.document`,
  declared: `${K}row.declared`,
  attested: `${K}row.attested`,
  fileUnnamed: `${K}row.fileUnnamed`,
  expiry: `${K}row.expiry`,
  expiryUnknown: `${K}row.expiryUnknown`,
  daysLeft: `${K}row.daysLeft`,
  daysAgo: `${K}row.daysAgo`,
  sourceRule: `${K}row.sourceRule`,
  sourcePrinted: `${K}row.sourcePrinted`,
  state: `${K}row.state`,
  supersededBy: `${K}row.supersededBy`,
  openDocuments: `${K}row.openDocuments`,
  missingDocument: `${K}row.missingDocument`,
  discrepancy: 'conveyance:dialogs.expiryDiscrepancy',
  dependentsHeading: `${K}dependents.heading`,
  missingHeading: `${K}dependents.missingHeading`,
  dependentsNone: `${K}dependents.none`,
  signingOn: `${K}dependents.signingOn`,
  continuous: `${K}dependents.continuous`,
  unscheduled: `${K}dependents.unscheduled`,
  blockingNow: `${K}dependents.blockingNow`,
  openProperty: `${K}dependents.openProperty`,
  openListing: `${K}dependents.openListing`,
  truncatedTitle: `${K}truncated.title`,
  truncatedBody: `${K}truncated.body`,
  emptyTitle: `${K}empty.title`,
  emptyHint: `${K}empty.hint`,
  emptyAction: `${K}empty.openProperties`,
  scopeNote: `${K}scope.note`,
  unscopedListings: `${K}scope.unscopedListings`,
} as const;

/**
 * Η κατάσταση γραμμής: εικονίδιο (κανάλι **πέρα** από το χρώμα, CHECK 3.41) · τόνος κάρτας · σήμα.
 * ⚠️ Τα κλειδιά λέξης/εξήγησης ζουν σε **επίπεδους** χάρτες ({@link REGISTRY_STATE_LABEL_KEYS}): το `t(look.label)`
 *    (δύο βήματα πρόσβασης) δεν λύνεται στατικά από τον γεννήτορα του route slice — μετρημένο.
 */
export interface RegistryStateLook {
  readonly icon: LucideIcon;
  readonly tone: StatsCardColor;
  readonly badge: NonNullable<BadgeVariantProps['variant']>;
}

export const REGISTRY_STATE_LOOK: Readonly<Record<RegistryRowState, RegistryStateLook>> = {
  expired: { icon: CalendarX2, tone: 'red', badge: 'error' },
  missing: { icon: FileX2, tone: 'red', badge: 'error' },
  expiring: { icon: CalendarClock, tone: 'orange', badge: 'warning' },
  'expiry-unknown': { icon: CircleHelp, tone: 'gray', badge: 'muted' },
  valid: { icon: CalendarCheck2, tone: 'green', badge: 'success' },
  superseded: { icon: History, tone: 'gray', badge: 'outline' },
};

export const REGISTRY_STATE_LABEL_KEYS: Readonly<Record<RegistryRowState, string>> = {
  expired: `${K}state.expired`,
  missing: `${K}state.missing`,
  expiring: `${K}state.expiring`,
  'expiry-unknown': `${K}state.expiry-unknown`,
  valid: `${K}state.valid`,
  superseded: `${K}state.superseded`,
};

export const REGISTRY_STATE_HINT_KEYS: Readonly<Record<RegistryRowState, string>> = {
  expired: `${K}stateHint.expired`,
  missing: `${K}stateHint.missing`,
  expiring: `${K}stateHint.expiring`,
  'expiry-unknown': `${K}stateHint.expiry-unknown`,
  valid: `${K}stateHint.valid`,
  superseded: `${K}stateHint.superseded`,
};

export const REGISTRY_VIEW_LABEL_KEYS: Readonly<Record<RegistryView, string>> = {
  all: `${K}filter.all`,
  'renewal-due': `${K}filter.renewal-due`,
  missing: `${K}filter.missing`,
  'within-window': `${K}filter.within-window`,
  blocking: `${K}filter.blocking`,
  'expiry-unknown': `${K}filter.expiry-unknown`,
  discrepancy: `${K}filter.discrepancy`,
};

export const DOCUMENT_KIND_LABEL_KEYS: Readonly<Record<DocumentKind, string>> = {
  'energy-certificate': 'conveyance:items.energy_certificate.label',
  'building-identity': 'legality:kind.building-identity',
};

export const PROCESS_LABEL_KEYS: Readonly<Record<DocumentProcess, string>> = {
  conveyance: `${K}dependents.conveyance`,
  'listing-publication': `${K}dependents.listing-publication`,
};

export const IMPACT_LABEL_KEYS: Readonly<Record<DependentImpact, string>> = {
  stops: `${K}dependents.stops`,
  unaffected: `${K}dependents.unaffected`,
  undetermined: `${K}dependents.undetermined`,
  absent: `${K}dependents.absent`,
};

export const POLICY_LABEL_KEYS: Readonly<Record<RequirementPolicy, string>> = {
  block: `${K}dependents.block`,
  warn: `${K}dependents.warn`,
};

export const TRUNCATED_SOURCE_KEYS: Readonly<Record<RegistrySource, string>> = {
  files: `${K}truncated.files`,
  declared: `${K}truncated.declared`,
  cases: `${K}truncated.cases`,
  'owner-properties': `${K}truncated.owner-properties`,
  listings: `${K}truncated.listings`,
};
