/**
 * Org Structure Repository — L1 (Tenant) CRUD (ADR-326 Phase 1)
 *
 * Stores/reads orgStructure as `companies/{companyId}.settings.orgStructure`.
 * Uses Admin SDK (bypasses Firestore rules by design — auth enforced at API layer).
 * 5-min in-memory cache; invalidated on every write.
 */

import 'server-only';

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { sanitizeForFirestore } from '@/utils/firestore-sanitize';
import { COLLECTIONS } from '@/config/firestore-collections';
import { generateOrgStructureId } from '@/services/enterprise-id.service';
import { createModuleLogger } from '@/lib/telemetry';
import { EntityAuditService } from '@/services/entity-audit.service';
import { ENTITY_TYPES } from '@/config/domain-constants';
import type { OrgStructure } from '@/types/org/org-structure';

const logger = createModuleLogger('OrgStructureRepository');

// ─── Cache (5-min TTL) ───────────────────────────────────────────────────────

interface CacheEntry { data: OrgStructure; expiresAt: number }
const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 5 * 60 * 1000;

export function invalidateOrgStructureCache(companyId: string): void {
  cache.delete(companyId);
}

// ─── Read ─────────────────────────────────────────────────────────────────────

export async function getOrgStructure(companyId: string): Promise<OrgStructure | null> {
  const hit = cache.get(companyId);
  if (hit && hit.expiresAt > Date.now()) return hit.data;

  try {
    const snap = await getAdminFirestore()
      .collection(COLLECTIONS.COMPANIES)
      .doc(companyId)
      .get();

    if (!snap.exists) return null;

    const raw = (snap.data() as { settings?: { orgStructure?: OrgStructure } })
      .settings?.orgStructure ?? null;

    if (raw) cache.set(companyId, { data: raw, expiresAt: Date.now() + CACHE_TTL_MS });
    return raw;
  } catch (err) {
    logger.error('[OrgStructureRepository] getOrgStructure failed', { companyId, err });
    return null;
  }
}

// ─── Write ────────────────────────────────────────────────────────────────────

export type SaveOrgStructureInput = Omit<OrgStructure, 'id' | 'updatedAt' | 'updatedBy'> & {
  id?: string;
};

export async function saveOrgStructure(
  companyId: string,
  input: SaveOrgStructureInput,
  userId: string,
): Promise<OrgStructure> {
  const toSave: OrgStructure = {
    ...input,
    id: input.id ?? generateOrgStructureId(),
    updatedAt: new Date(),
    updatedBy: userId,
  };

  try {
    await getAdminFirestore()
      .collection(COLLECTIONS.COMPANIES)
      .doc(companyId)
      .update({ 'settings.orgStructure': sanitizeForFirestore(toSave) });

    cache.set(companyId, { data: toSave, expiresAt: Date.now() + CACHE_TTL_MS });
    logger.info('[OrgStructureRepository] saved', { companyId, orgId: toSave.id });

    // ADR-195 — Entity audit trail (org structure update)
    void EntityAuditService.recordChange({
      entityType: ENTITY_TYPES.COMPANY,
      entityId: companyId,
      action: 'updated',
      changes: [{ field: 'settings.orgStructure', oldValue: null, newValue: toSave.id, label: 'Org Structure' }],
      performedBy: userId,
      performedByName: null,
      companyId,
    });

    return toSave;
  } catch (err) {
    logger.error('[OrgStructureRepository] saveOrgStructure failed', { companyId, err });
    throw new Error('Failed to save org structure');
  }
}
