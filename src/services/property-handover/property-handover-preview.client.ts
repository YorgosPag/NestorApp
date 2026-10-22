/**
 * @fileoverview **Η καρτέλα «Παράδοση» ρωτά τον διακομιστή** — `GET /api/properties/[id]/handover` (ADR-916 §5.15 Φ-Δ).
 * @related services/property-handover/property-handover-preview.server.ts (η απάντηση) · hooks/property-handover/usePropertyHandover
 * @module services/property-handover/property-handover-preview.client
 *
 * 🔑 **Ποτέ δεν πετά** — η αποτυχία είναι **ονομασμένη**: «δεν σου επιτρέπεται / δεν υπάρχει» (`unavailable`) ≠
 *    «δεν μπόρεσα τώρα» (`failed`, με «Δοκιμάστε ξανά»). Μια αποτυχία δικτύου **δεν** είναι «καμία παράδοση».
 */

import { API_ROUTES } from '@/config/domain-constants';
import { apiClient, isClientRefusal } from '@/lib/api/enterprise-api-client';
import { createModuleLogger } from '@/lib/telemetry';
import type { PropertyHandoverPreview } from '@/types/property-handover';

const logger = createModuleLogger('property-handover-preview.client');

export type PropertyHandoverLoad =
  | { readonly kind: 'ready'; readonly preview: PropertyHandoverPreview }
  | { readonly kind: 'unavailable' }
  | { readonly kind: 'failed' };

export async function fetchPropertyHandover(propertyId: string): Promise<PropertyHandoverLoad> {
  try {
    return { kind: 'ready', preview: await apiClient.get<PropertyHandoverPreview>(API_ROUTES.PROPERTIES.HANDOVER(propertyId)) };
  } catch (cause: unknown) {
    logger.warn('Η καρτέλα «Παράδοση» δεν φορτώθηκε', { propertyId, cause });
    return isClientRefusal(cause) ? { kind: 'unavailable' } : { kind: 'failed' };
  }
}
