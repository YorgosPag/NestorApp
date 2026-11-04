'use client';

/**
 * Τα συμφωνητικά υπεργολαβίας ενός έργου, ζωντανά (ADR-928 §5.14 απόφαση 12 · Φ3α-2) — και του ενός έργου, και οι κύριες
 * συμβάσεις με ανάθεση σε αυτό: το `projectIds` το γράφει **μόνο** ο γραφέας από το `scope` (`projectIdsOf`).
 *
 * Ερώτημα: `companyId ==` (από την υπηρεσία) + `projectIds array-contains` + `updatedAt ↓` — ο δείκτης είναι στο
 * `firestore.indexes.json` και **ανεπτυγμένος** (γραμμή Firebase, run 41684653779). Ταξινόμηση και στον πελάτη, με τον
 * ίδιο κανόνα, ώστε η τοπική cache να έχει την ίδια σειρά με το ερώτημα.
 * Οι εγγραφές περνούν **μόνο** από τον γραφέα (`subcontract-agreements-api.client`)· οι κανόνες κλείνουν τον πελάτη.
 * @module hooks/procurement/subcontracts/useProjectSubcontractAgreements
 */

import { useMemo } from 'react';
import { orderBy, where } from 'firebase/firestore';
import { compareInstantsDesc } from '@/lib/date-local';
import { createStaleCache } from '@/lib/stale-cache';
import { createModuleLogger } from '@/lib/telemetry';
import type { SubcontractAgreement } from '@/subapps/procurement/subcontracts/types/agreement';
import {
  useProcurementCatalogList,
  type ProcurementCatalogList,
  type ProcurementCatalogListConfig,
  type ProcurementCatalogListScope,
} from '../useProcurementCatalogList';

const agreementsByProject: ProcurementCatalogListConfig<SubcontractAgreement> = {
  collection: 'SUBCONTRACT_AGREEMENTS',
  cache: createStaleCache<SubcontractAgreement[]>('subcontract-agreements-by-project'),
  compare: (a, b) => compareInstantsDesc(a.updatedAt, b.updatedAt),
  logger: createModuleLogger('useProjectSubcontractAgreements'),
  label: 'Subcontract agreements',
  // Τα συμφωνητικά δεν διαγράφονται: απορρίπτονται, αποσύρονται, λήγουν — κατάσταση, ορατή στη λίστα.
  liveness: null,
};

const companyDrafts: ProcurementCatalogListConfig<SubcontractAgreement> = {
  ...agreementsByProject,
  cache: createStaleCache<SubcontractAgreement[]>('subcontract-agreements-company-drafts'),
  label: 'Subcontract draft agreements (company)',
};

/**
 * Ο **ένας** στόχος των πρόχειρων της εταιρείας: `companyId ==` (υπηρεσία) + `status == 'draft'` + `updatedAt ↓` — ο
 * **υπάρχων** δείκτης `companyId + status + updatedAt` (`firestore.indexes.json`), κανένας νέος.
 */
const COMPANY_DRAFTS_SCOPE: ProcurementCatalogListScope = {
  cacheKey: 'company-drafts',
  constraints: [where('status', '==', 'draft'), orderBy('updatedAt', 'desc')],
};

/**
 * Τα **πρόχειρα** συμφωνητικά όλης της εταιρείας (ADR-928 Φ3γ-0) — η επίπτωση μιας απόφασης βιβλιοθήκης («ποια
 * πρόχειρα δένουν αυτή τη ρήτρα, σε ποια έκδοση»). Τα εκδοθέντα **δεν** αλλάζουν ποτέ (§5.6), άρα δεν διαβάζονται.
 */
export function useCompanyDraftSubcontractAgreements(): ProcurementCatalogList<SubcontractAgreement> {
  return useProcurementCatalogList(companyDrafts, COMPANY_DRAFTS_SCOPE);
}

export function useProjectSubcontractAgreements(projectId: string): ProcurementCatalogList<SubcontractAgreement> {
  const scope = useMemo<ProcurementCatalogListScope>(
    () => ({
      cacheKey: projectId,
      constraints: [where('projectIds', 'array-contains', projectId), orderBy('updatedAt', 'desc')],
    }),
    [projectId],
  );
  return useProcurementCatalogList(agreementsByProject, scope);
}
