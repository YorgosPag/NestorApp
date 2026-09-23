/**
 * ADR-875 §10 — ΟΙ ΜΑΡΤΥΡΕΣ ΥΠΑΡΞΗΣ της βαθμίδας `witness` (δεδομένα, καμία εκτέλεση).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ΤΙ ΕΙΝΑΙ, ΚΑΙ ΤΙ **ΔΕΝ** ΕΙΝΑΙ
 *
 * Οι σελίδες που γεμίζουν αυτές οι οντότητες **δεν** τις διαβάζουν στον server
 * (client component ή σκέτο redirect — η άγκυρα Γ6 το ΕΚΤΕΛΕΙ). Το SSR τους είναι
 * ίδιο για κάθε id· ο μάρτυρας αποδεικνύει ότι το id που κρίθηκε **υπάρχει** στον
 * χώρο, όχι ότι η οντότητα είναι πλήρης. ⚠️ **ΔΕΝ είναι δεύτερη αλήθεια του σχήματος**:
 * κανείς δεν τους διαβάζει στον server — τη μέρα που κάποιος θα τους διαβάσει, η Γ6
 * κοκκινίζει και η οντότητα ανεβαίνει σε `api` (σπορά από το API της εικόνας).
 *
 * Εξαίρεση με λόγο: η **επαφή εταιρείας**. Είναι μάρτυρας για τη σελίδα `contacts/[id]`
 * αλλά και **είσοδος** του API έργου (`assertLinkedCompanyExists`: `type === 'company'`)
 * και του PO (`supplierId`). Οι επαφές γράφονται από τον client SDK — **δεν υπάρχει**
 * route εγγραφής στον server — άρα η εγγραφή εδώ είναι η μόνη διαθέσιμη διαδρομή.
 *
 * 🔑 Ids **ντετερμινιστικά** με το κανονικό πρόθεμα (`<πρόθεμα>_alpha_golden`): ίδιο
 *    προηγούμενο με το `emulator-seed-demo-tenant.ts` (δεδομένα του διαχειριστή, όχι
 *    της εφαρμογής) ⇒ το ξανατρέξιμο είναι idempotent χωρίς αναζήτηση.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { COLLECTIONS } from '@/config/firestore-collections';

/** Οι οντότητες της βαθμίδας `witness` — ΙΔΙΟ σύνολο με τον κατάλογο (άγκυρα Γ8). */
export const WITNESS_COLLECTIONS = {
  contact: COLLECTIONS.CONTACTS,
  building: COLLECTIONS.BUILDINGS,
  property: COLLECTIONS.PROPERTIES,
  parking: COLLECTIONS.PARKING_SPACES,
  storage: COLLECTIONS.STORAGE,
  lead: COLLECTIONS.OPPORTUNITIES,
  task: COLLECTIONS.TASKS,
  obligation: COLLECTIONS.OBLIGATIONS,
  invoice: COLLECTIONS.ACCOUNTING_INVOICES,
  ownerProperty: COLLECTIONS.OWNER_PROPERTIES,
  quote: COLLECTIONS.QUOTES,
} as const;

export type WitnessEntity = keyof typeof WITNESS_COLLECTIONS;

/** Ο πυρήνας κάθε μάρτυρα — γνωστός ΠΡΙΝ από κάθε κλήση API. */
export interface WitnessCore {
  readonly companyId: string;
  readonly createdBy: string;
}

/** Οι αναφορές που φέρνει η σπορά της βαθμίδας `api` (η επαφή γράφεται ΠΡΙΝ από αυτές). */
export interface WitnessRefs extends WitnessCore {
  readonly contactId: string;
  readonly projectId: string;
  readonly rfqId: string;
}

export const GOLDEN_MARK = 'ADR-875 golden';

export function witnessId(prefix: string): string {
  return `${prefix}_alpha_golden`;
}

function coreFields(entity: WitnessEntity, core: WitnessCore): Record<string, unknown> & { name: string } {
  return { companyId: core.companyId, createdBy: core.createdBy, name: `${GOLDEN_MARK} · ${entity}`, goldenWitness: GOLDEN_MARK };
}

/** Η επαφή εταιρείας — είσοδος του API έργου (`type === 'company'`) και του PO (`supplierId`). */
export function companyContactDocument(core: WitnessCore): Record<string, unknown> {
  const base = coreFields('contact', core);
  return { ...base, type: 'company', companyName: base.name, displayName: base.name, status: 'active' };
}

/** Οι υπόλοιποι μάρτυρες: πυρήνας + ό,τι τους δένει με τις οντότητες της βαθμίδας `api`. */
export function witnessDocument(entity: Exclude<WitnessEntity, 'contact'>, refs: WitnessRefs): Record<string, unknown> {
  const core = coreFields(entity, refs);
  switch (entity) {
    case 'building':
    case 'property':
    case 'parking':
    case 'storage':
      return { ...core, projectId: refs.projectId };
    case 'lead':
      return { ...core, title: core.name, contactId: refs.contactId };
    case 'quote':
      return { ...core, projectId: refs.projectId, rfqId: refs.rfqId };
    default:
      return { ...core, title: core.name };
  }
}
