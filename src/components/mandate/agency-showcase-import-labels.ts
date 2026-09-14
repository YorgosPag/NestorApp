/**
 * @fileoverview **ΚΩΔΙΚΟΣ → ΚΛΕΙΔΙ ΚΕΙΜΕΝΟΥ** για την «εισαγωγή από τα στοιχεία της εταιρείας» στην κάρτα.
 * @related ADR-841 §7 Α21.19 · N.11 · N.7.1 · CHECK 3.8
 * @module components/mandate/agency-showcase-import-labels
 *
 * ⚠️ **Ίδιο ιδίωμα με το `agency-showcase-labels.ts`, ξεχωριστό αρχείο**: η εισαγωγή είναι πράξη
 * **πάνω στο πρόχειρο**, με δική της πηγή και δικές της αποτυχίες — όχι μέρος της αποθήκευσης.
 * Χωρίστηκε όταν το κοινό αρχείο πέρασε τις 500 γραμμές (N.7.1). Το namespace μένει
 * `SHOWCASE_NS` (`property-market`) — εισάγεται από εκεί, δεν ξαναδηλώνεται.
 */

import type { ImportField, ImportOrigin } from '@/types/showcase-card-import';
import type { ImportRowStatus } from '@/lib/agency/showcase-card-import';

const K = 'property-market:mandate.showcase';

/**
 * 🏆 **«ΕΙΣΑΓΩΓΗ ΑΠΟ ΤΑ ΣΤΟΙΧΕΙΑ ΤΗΣ ΕΤΑΙΡΕΙΑΣ»** (ADR-841 §7 Α21.19) — ξεχωριστός πίνακας: είναι πράξη **πάνω στο
 * πρόχειρο**, με δική της πηγή και δικές της αποτυχίες, όχι μέρος της αποθήκευσης.
 */
export const SHOWCASE_CARD_IMPORT_KEYS = {
  /** 🔑 Η ζωντανή ένδειξη: το κουμπί **μετρά** τις διαφορές — καμία αποθήκευση, κανένα banner. */
  openWithCount: `${K}.cardImport.openWithCount`,
  upToDate: `${K}.cardImport.upToDate`,
  review: `${K}.cardImport.review`,
  noCompanyData: `${K}.cardImport.noCompanyData`,
  companySettings: `${K}.cardImport.companySettings`,
  /** ⚠️ «Δεν μάθαμε» — ποτέ «δεν έχετε στοιχεία» (N.12). */
  sourceFailed: `${K}.cardImport.sourceFailed`,
  title: `${K}.cardImport.title`,
  lead: `${K}.cardImport.lead`,
  colField: `${K}.cardImport.colField`,
  colCard: `${K}.cardImport.colCard`,
  colCompany: `${K}.cardImport.colCompany`,
  colDecision: `${K}.cardImport.colDecision`,
  keepCard: `${K}.cardImport.keepCard`,
  takeCompany: `${K}.cardImport.takeCompany`,
  checkedOn: `${K}.cardImport.checkedOn`,
  apply: `${K}.cardImport.apply`,
  cancel: `${K}.cardImport.cancel`,
  applied: `${K}.cardImport.applied`,
  undo: `${K}.cardImport.undo`,
  /** 🔑 Ο χάρτης **κεντράρει** — το κτίριο το πατά ο άνθρωπος. */
  locate: `${K}.cardImport.locate`,
  locating: `${K}.cardImport.locating`,
  locateNotFound: `${K}.cardImport.locateNotFound`,
  locateFailed: `${K}.cardImport.locateFailed`,
} as const;

/** **Πεδίο εισαγωγής → ετικέτα** — `Record` στο κλειστό σύνολο: πέμπτο πεδίο δεν μεταγλωττίζεται χωρίς λέξεις. */
export const SHOWCASE_CARD_IMPORT_FIELD_KEYS: Record<ImportField, string> = {
  street: `${K}.cardImport.field.street`,
  phones: `${K}.cardImport.field.phones`,
  emails: `${K}.cardImport.field.emails`,
  website: `${K}.cardImport.field.website`,
};

/** **Κατάσταση γραμμής → κείμενο.** Το `differs` δεν έχει κείμενο εδώ: εκεί μιλά η **ερώτηση**. */
export const SHOWCASE_CARD_IMPORT_STATUS_KEYS: Record<Exclude<ImportRowStatus, 'differs'>, string> = {
  fill: `${K}.cardImport.status.fill`,
  same: `${K}.cardImport.status.same`,
  'no-room': `${K}.cardImport.status.no-room`,
  'invalid-source': `${K}.cardImport.status.invalid-source`,
};

/** **Προέλευση → κείμενο** — φαίνεται δίπλα σε κάθε πεδίο που γέμισε η εισαγωγή. */
export const SHOWCASE_CARD_IMPORT_ORIGIN_KEYS: Record<ImportOrigin, string> = {
  'company-profile': `${K}.cardImport.origin.company-profile`,
  'business-registry': `${K}.cardImport.origin.business-registry`,
};
