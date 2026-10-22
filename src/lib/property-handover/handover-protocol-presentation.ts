/**
 * @fileoverview **Τι λέει η οθόνη για ένα Πρωτόκολλο Παράδοσης** (ADR-916 Φ-Γ2 Σ5) — καθαρή όψη πάνω στην προβολή
 *               `origin.protocol` που γράφει ο ένας γραφέας.
 * @related lib/property-handover/handover-protocol-terms.ts (ο κανόνας «μέρα → κείμενο σε ισχύ») ·
 *   components/property-dossier/PropertyDossierProtocol.tsx (ο καταναλωτής)
 * @module lib/property-handover/handover-protocol-presentation
 *
 * 🔑 **Κανένα νέο πεδίο**: η έκδοση του κειμένου **παράγεται** από το `issuedAt` με τον **ίδιο** κανόνα που ρώτησε ο
 *    γραφέας όταν τύπωσε το PDF (`handoverProtocolIssueDayOf` + `handoverProtocolTermsOn`) — οι εκδόσεις είναι
 *    παγωμένες, άρα η απάντηση δεν αλλάζει ποτέ για το ίδιο `issuedAt`.
 * 🔒 Όχι `in-force` ⇒ **κανένας** σύνδεσμος: ποτέ παραπομπή σε «παρεμφερή» έκδοση από αυτήν του PDF.
 * 🔑 Αναθεωρήσεις **συνεχόμενες** εκ κατασκευής (`planHandoverProtocol`: N ⇒ N+1 με `supersedesProtocolId`).
 *
 * **Layering**: leaf — καθαρή συνάρτηση, κανένα SDK, client-safe.
 */

import type { PropertyHandoverProtocolSummary } from '@/types/property-handover-protocol';

import {
  handoverProtocolIssueDayOf,
  handoverProtocolLegalTextHref,
  handoverProtocolTermsOn,
} from './handover-protocol-terms';

export interface HandoverProtocolPresentation {
  readonly revision: number;
  /** Η αναθεώρηση που αντικαθιστά — `null` στην πρώτη. */
  readonly supersedesRevision: number | null;
  readonly issuedAt: string;
  /** Το κείμενο **σε ισχύ** την ημέρα έκδοσης — `null` ⇒ η οθόνη δεν παραπέμπει πουθενά. */
  readonly legalText: { readonly version: number; readonly href: string } | null;
}

export function handoverProtocolPresentationOf(summary: PropertyHandoverProtocolSummary): HandoverProtocolPresentation {
  const terms = handoverProtocolTermsOn(handoverProtocolIssueDayOf(summary.issuedAt));
  const version = terms.kind === 'in-force' ? terms.version.frozen.version : null;
  return {
    revision: summary.revision,
    supersedesRevision: summary.revision > 1 ? summary.revision - 1 : null,
    issuedAt: summary.issuedAt,
    legalText: version === null ? null : { version, href: handoverProtocolLegalTextHref(version) },
  };
}
