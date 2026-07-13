/**
 * ADR-344 Phase 7.D — In-memory cache for user text-templates (manager UI).
 *
 * The cache is intentionally module-scope, not React-state: it survives
 * unmounts so closing/reopening the manager dialog reuses the previous
 * result without a network round-trip. Optimistic mutations replace the
 * cache entry atomically (`setCachedUserTemplates`).
 *
 * Multi-tenant safety: keyed by `companyId`. If a user switches tenant
 * (rare) the new tenant simply gets a fresh fetch.
 *
 * ⚠️ ADR-651 Φάση Θ: ο **deserializer** μετακόμισε στο
 * `text-engine/templates/text-template-api.ts` (τον μοιράζονται manager + βιβλιοθήκη
 * πινακίδας — N.18). Εδώ μένει μόνο το cache· ο deserializer επανεξάγεται για back-compat.
 */
import type { TextTemplate } from '@/subapps/dxf-viewer/text-engine/templates';

export { deserializeUserTemplate } from '@/subapps/dxf-viewer/text-engine/templates/text-template-api';

const cache = new Map<string, readonly TextTemplate[]>();

export function getCachedUserTemplates(companyId: string): readonly TextTemplate[] | undefined {
  return cache.get(companyId);
}

export function setCachedUserTemplates(companyId: string, list: readonly TextTemplate[]): void {
  cache.set(companyId, list);
}

export function clearCachedUserTemplates(companyId: string): void {
  cache.delete(companyId);
}
