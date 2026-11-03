/**
 * Οι **διαδρομές API** των συμφωνητικών υπεργολαβίας (ADR-928 §5.14 · Φ3α-2) — η **μία** ονομασία τους για τον πελάτη,
 * όπως το `catalog-routes` του ADR-923: τα routes του Next.js ζουν στο σύστημα αρχείων, και μετονομασία φακέλου πρέπει να
 * σπάει **ένα** σημείο, όχι κάθε κουμπί.
 * @module subapps/procurement/subcontracts/subcontract-routes
 */

import type { SubcontractAgreementTransition } from './types/agreement';

const AGREEMENTS = '/api/subcontracts/agreements';

const agreement = (id: string) => `${AGREEMENTS}/${encodeURIComponent(id)}`;

export const SUBCONTRACT_API = {
  agreements: {
    collection: AGREEMENTS,
    item: agreement,
    transition: (id: string, transition: SubcontractAgreementTransition) => `${agreement(id)}/transitions/${transition}`,
    assignments: (id: string) => `${agreement(id)}/assignments`,
    decideDeviation: (id: string) => `${agreement(id)}/deviations/decide`,
  },
} as const;
