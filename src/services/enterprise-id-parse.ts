/**
 * ENTERPRISE ID — PURE PARSING / VALIDATION
 *
 * Reading an id needs no instance state: `prefix_uuid` is self-describing and
 * the prefix registry is a module constant. Extracted from
 * `enterprise-id-class.ts` (2026-07-25) under N.7.1, alongside
 * `./enterprise-id-composite-keys` and `./enterprise-id-deterministic` — the
 * class keeps only what genuinely touches the retry loop, the cache and stats.
 *
 * The `EnterpriseIdService.parseId/validateId/getIdType/isLegacyId` methods
 * delegate here, so the public API is unchanged.
 *
 * @module services/enterprise-id-parse
 * @see ADR-017, ADR-210, ADR-294 — enterprise ID SSoT
 */

import {
  ENTERPRISE_ID_PREFIXES,
  type EnterpriseIdPrefix,
  type EnterpriseId,
} from './enterprise-id-prefixes';

/** UUID v4, as emitted by both branches of the class's secure-uuid generator. */
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseEnterpriseId(enterpriseId: string): Partial<EnterpriseId> | null {
  const parts = enterpriseId.split('_');
  if (parts.length !== 2) return null;

  const [prefix, uuid] = parts;
  if (!Object.values(ENTERPRISE_ID_PREFIXES).includes(prefix as EnterpriseIdPrefix)) {
    return null;
  }

  return { id: enterpriseId, prefix: prefix as EnterpriseIdPrefix, uuid };
}

/** A known prefix is not enough — the uuid half must be a real v4. */
export function isValidEnterpriseId(id: string): boolean {
  const parsed = parseEnterpriseId(id);
  if (!parsed) return false;
  return UUID_V4.test(parsed.uuid || '');
}

export function enterpriseIdType(id: string): string | null {
  return parseEnterpriseId(id)?.prefix || null;
}
