'use client';

/**
 * useFrameworkAgreements — Framework Agreements hook (ADR-330 Phase 5)
 *
 * Reads via `useProcurementCatalogList` (ADR-355 SSoT, ADR-361 equality-guarded; ADR-300 stale cache).
 * Writes via API routes (`/api/procurement/agreements`) — Firestore rules
 * block direct client writes; mutations go through Admin SDK with audit trail.
 *
 * @module hooks/procurement/useFrameworkAgreements
 * @see ADR-330 §3 Phase 5
 * @see ADR-300 — Stale-while-revalidate
 */

import { API_ROUTES } from '@/config/domain-constants';
import { procurementCatalogApi } from './procurement-catalog-api';
import { useProcurementCatalogList, type ProcurementCatalogListConfig } from './useProcurementCatalogList';
import { createModuleLogger } from '@/lib/telemetry';
import { createStaleCache } from '@/lib/stale-cache';
import { compareInstantsDesc } from '@/lib/date-local';
import type {
  FrameworkAgreement,
  FrameworkAgreementWire,
  CreateFrameworkAgreementDTO,
  UpdateFrameworkAgreementDTO,
} from '@/subapps/procurement/types/framework-agreement';

const agreementsList: ProcurementCatalogListConfig<FrameworkAgreement> = {
  collection: 'FRAMEWORK_AGREEMENTS',
  cache: createStaleCache<FrameworkAgreement[]>('framework-agreements-list'),
  compare: (a, b) => compareInstantsDesc(a.createdAt, b.createdAt),
  logger: createModuleLogger('useFrameworkAgreements'),
  label: 'Framework agreements',
};

const agreementsApi = procurementCatalogApi<FrameworkAgreementWire, CreateFrameworkAgreementDTO, UpdateFrameworkAgreementDTO>(
  API_ROUTES.PROCUREMENT.AGREEMENTS,
  API_ROUTES.PROCUREMENT.AGREEMENT_BY_ID,
);

interface UseFrameworkAgreementsReturn {
  agreements: FrameworkAgreement[];
  loading: boolean;
  error: string | null;
  createAgreement: (dto: CreateFrameworkAgreementDTO) => Promise<FrameworkAgreement>;
  updateAgreement: (id: string, dto: UpdateFrameworkAgreementDTO) => Promise<FrameworkAgreement>;
  deleteAgreement: (id: string) => Promise<void>;
}

export function useFrameworkAgreements(): UseFrameworkAgreementsReturn {
  const { items, loading, error } = useProcurementCatalogList(agreementsList);
  return {
    agreements: items,
    loading,
    error,
    createAgreement: agreementsApi.create,
    updateAgreement: agreementsApi.update,
    deleteAgreement: agreementsApi.remove,
  };
}
