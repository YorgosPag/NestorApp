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

import type {
  AuthorityService,
  DocumentObligor,
  IssuerAuthority,
  IssuerQualification,
} from '@/config/document-validity/document-issuers';
import type { ProfessionalLicence } from '@/config/professional-licences';
import type { DocumentKind } from '@/config/document-validity/document-validity';
import type { ExpirySource } from '@/lib/document-validity/document-expiry';
import type { RegistryRowState } from '@/lib/document-validity/document-registry';
import type { RegistryPickerView } from '@/lib/document-validity/document-registry-view';
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
/** ADR-915 §21 — το όνομα της **άδειας** και της **αρχής** της ζουν μία φορά, στο namespace της βιτρίνας (`property-market`). */
export const PROPERTY_MARKET_NS = 'property-market';

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
  /** `undetermined` επειδή λείπει η **μέρα**, όχι η λήξη — το `IMPACT_LABEL_KEYS.undetermined` λέει «η λήξη». */
  undeterminedDay: `${K}dependents.undeterminedDay`,
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

export const REGISTRY_VIEW_LABEL_KEYS: Readonly<Record<RegistryPickerView, string>> = {
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
  // ADR-915 §14 — ίδια ονόματα με τις γραμμές του καταλόγου μεταβίβασης: ένα κλειδί, μία ετικέτα.
  'tax-clearance': 'conveyance:items.seller_tax_clearance.label',
  'insurance-clearance': 'conveyance:items.seller_insurance_clearance.label',
  'enfia-certificate': 'conveyance:items.seller_enfia_certificate.label',
};

/** ADR-915 §18 — «Εκδίδει / Το φέρνει»: κάθε χάρτης δεμένος στο κλειστό σύνολο του `document-issuers.ts`. */
export const ISSUER_KEYS = {
  heading: `${K}issuer.heading`,
  obligorHeading: `${K}issuer.obligorHeading`,
  registered: `${K}issuer.registered`,
  selfService: `${K}issuer.selfService`,
} as const;

export const ISSUER_QUALIFICATION_LABEL_KEYS: Readonly<Record<IssuerQualification, string>> = {
  'civil-engineer': `${K}issuer.qualification.civil-engineer`,
  architect: `${K}issuer.qualification.architect`,
  'surveyor-engineer': `${K}issuer.qualification.surveyor-engineer`,
  'spatial-planner': `${K}issuer.qualification.spatial-planner`,
  'civil-sub-engineer': `${K}issuer.qualification.civil-sub-engineer`,
  'civil-engineer-tei': `${K}issuer.qualification.civil-engineer-tei`,
  // Προσόν-άδεια ⇒ το ΟΝΟΜΑ ΤΗΣ ΑΔΕΙΑΣ, ένα κλειδί (`PROFESSIONAL_LICENCE_SPECS.nameKey` — άγκυρα ισότητας στο test).
  'energy-inspector-registered': 'property-market:licences.energyInspector.name',
};

/**
 * Σε ποιο μητρώο είναι γραμμένη κάθε άδεια — το όνομα της ΑΡΧΗΣ (`REGISTRY_AUTHORITY_PRESENTATION[authority].nameKey`).
 * ⚠️ Κυριολεκτικό κλειδί και όχι αναφορά: ο τεμαχιστής του CHECK 3.34 λύνει `t(TABLE[x])` μόνο για πίνακα του ίδιου
 *    module· η ισότητα με την πηγή κλειδώνεται με άγκυρα.
 */
export const LICENCE_REGISTRY_LABEL_KEYS: Readonly<Record<ProfessionalLicence, string>> = {
  'energy-inspector': 'property-market:registries.ypen.name',
};

export const ISSUER_AUTHORITY_LABEL_KEYS: Readonly<Record<IssuerAuthority, string>> = {
  aade: `${K}issuer.authority.aade`,
  efka: `${K}issuer.authority.efka`,
};

export const OBLIGOR_LABEL_KEYS: Readonly<Record<DocumentObligor, string>> = {
  owner: `${K}issuer.obligor.owner`,
};

/** «Τον ορίζει …» — πλήρης πρόταση ανά υπόχρεο (ποτέ συναρμολόγηση άρθρου/πτώσης από κομμάτια). */
export const APPOINTED_BY_LABEL_KEYS: Readonly<Record<DocumentObligor, string>> = {
  owner: `${K}issuer.appointedBy.owner`,
};

/** ADR-915 §24 — «Επόμενο βήμα»: ενέργειες που παράγονται από τον εκδότη (`document-next-step.ts`). */
export const NEXT_STEP_KEYS = {
  heading: `${K}nextStep.heading`,
  findProfessional: `${K}nextStep.findProfessional`,
  findProfessionalNear: `${K}nextStep.findProfessionalNear`,
  findProfessionalAnywhere: `${K}nextStep.findProfessionalAnywhere`,
  selfService: `${K}nextStep.selfService`,
  selfServiceHint: `${K}nextStep.selfServiceHint`,
  opensInNewTab: `${K}nextStep.opensInNewTab`,
} as const;

/** Η διαδρομή μέσα στην πύλη της αρχής — μία ανά υπηρεσία· η πηγή της ζει στο `AUTHORITY_SERVICE_SPECS.pathSource`. */
export const SELF_SERVICE_PATH_KEYS: Readonly<Record<AuthorityService, string>> = {
  'aade-tax-clearance': `${K}nextStep.path.aade-tax-clearance`,
  'aade-enfia-certificate': `${K}nextStep.path.aade-enfia-certificate`,
  'efka-insurance-clearance': `${K}nextStep.path.efka-insurance-clearance`,
};

/** ADR-915 §14 — από πού ήρθε η λήξη· `floor` = το εγγυημένο κατώτατο («τουλάχιστον έως»), όχι η πραγματική λήξη. */
export const EXPIRY_SOURCE_LABEL_KEYS: Readonly<Record<ExpirySource, string>> = {
  rule: `${K}row.sourceRule`,
  printed: `${K}row.sourcePrinted`,
  floor: `${K}row.sourceFloor`,
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
