/**
 * @fileoverview ADR-915 §35 · §45.21.1 — τα **ονόματα πεδίων** του ιστορικού μιας απόφασης μόνιμης υποχρέωσης, ανά είδος.
 * @module lib/document-validity/upkeep-audit-fields
 *
 * 🔑 **ΓΙΑΤΙ ΚΟΙΝΟ (ΟΧΙ `.server`) MODULE.** Ο γραφέας (`upkeep-declarations.server.ts`) γράφει αυτά τα πεδία **απευθείας**,
 *    εκτός του μητρώου tracked πεδίων· η γραμμή Ιστορικού (client) φορτώνει τα λεξιλόγιά τους από την ΙΔΙΑ δήλωση
 *    (`config/audit-direct-written-fields.ts`). Ίδια κλάση και ίδια θεραπεία με το `issuance-audit-fields.ts`.
 *
 * **Layering**: leaf — μόνο δεδομένα, μηδέν I/O.
 */

import type { DocumentKind } from '@/config/document-validity/document-validity';

/**
 * Τα πεδία του ιστορικού **ενός** είδους (ονόματα στο `common-audit:audit.fields.*`, τιμές στους καταλόγους
 * `document-registry:upkeep.*` — `audit-value-catalogs.ts`).
 */
export interface UpkeepAuditFields {
  readonly decision: string;
  readonly exemption: string;
  readonly proposal: string;
}

/** `null` = το είδος δεν είναι μόνιμη υποχρέωση. */
export const UPKEEP_AUDIT_FIELDS: Readonly<Record<DocumentKind, UpkeepAuditFields | null>> = {
  'energy-certificate': null,
  'building-identity': null,
  'tax-clearance': null,
  'insurance-clearance': null,
  'enfia-certificate': null,
  'electrical-installation': {
    decision: 'electricalInstallationStandingObligation',
    exemption: 'electricalInstallationStandingObligationExemption',
    proposal: 'electricalInstallationStandingObligationProposal',
  },
};
