/**
 * ADR-344 Phase 7.D — In-memory cache + wire deserializer for user
 * text-templates.
 *
 * The cache is intentionally module-scope, not React-state: it survives
 * unmounts so closing/reopening the manager dialog reuses the previous
 * result without a network round-trip. Optimistic mutations replace the
 * cache entry atomically (`setCachedUserTemplates`).
 *
 * Multi-tenant safety: keyed by `companyId`. If a user switches tenant
 * (rare) the new tenant simply gets a fresh fetch.
 */
import type { TextTemplate } from '@/subapps/dxf-viewer/text-engine/templates';
import type { SerializedUserTextTemplate } from '../shared/serialized-template.types';

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

/**
 * Convert wire payload to canonical {@link TextTemplate} so the UI sees
 * the same shape for built-ins and user docs. Dates come back as ISO
 * strings; we parse to `Date` so callers can format them with the
 * existing centralized formatters.
 */
export function deserializeUserTemplate(wire: SerializedUserTextTemplate): TextTemplate {
  return {
    id: wire.id,
    companyId: wire.companyId,
    name: wire.name,
    category: wire.category,
    content: wire.content,
    placeholders: wire.placeholders,
    isDefault: false,
    createdAt: new Date(wire.createdAt),
    updatedAt: new Date(wire.updatedAt),
  };
}
