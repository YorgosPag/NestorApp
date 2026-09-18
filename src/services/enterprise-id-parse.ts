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

import { ENTERPRISE_ID_PREFIXES, type EnterpriseIdPrefix } from './enterprise-id-prefixes';
import type { EnterpriseId } from './enterprise-id-types';

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

/**
 * **Είναι αυτό έγκυρη ταυτότητα ΑΥΤΟΥ του είδους;** — πρόθεμα από το μητρώο **και** πραγματικό uuid v4.
 *
 * 🔑 SSoT (ADR-866 §2.8 — N.0.2): το ζεύγος `isValidEnterpriseId && enterpriseIdType === P` ήταν γραμμένο
 * με το χέρι σε δύο σημεία (αγγελία · τμήμα διεύθυνσης χώρου) και ο φάκελος θα ήταν το τρίτο. Ένα γνωστό
 * πρόθεμα **δεν** αρκεί, ούτε ένα έγκυρο uuid με **άλλο** πρόθεμα (`ownp_…` δεν είναι φάκελος).
 * ⚠️ **Αυστηρό**: κανένα `trim` — ό,τι ήρθε από το δίκτυο το κανονικοποιεί το {@link enterpriseIdFromRequest}.
 */
export function isEnterpriseIdOfPrefix(id: string, prefix: EnterpriseIdPrefix): boolean {
  return isValidEnterpriseId(id) && enterpriseIdType(id) === prefix;
}

/**
 * **Η ταυτότητα από ένα αίτημα** — κανονικοποιημένη, ή `null` αν δεν είναι ταυτότητα του είδους `prefix`.
 *
 * Για ταυτότητες **επιπέδου Β** που προ-γεννά ο πελάτης (`ownp` · `pdos`): ο διακομιστής **δεν** τις
 * εμπιστεύεται — τις ελέγχει εδώ και γράφει με `create()`, που αρνείται υπάρχον έγγραφο.
 */
export function enterpriseIdFromRequest(value: unknown, prefix: EnterpriseIdPrefix): string | null {
  if (typeof value !== 'string') return null;
  const id = value.trim();
  return isEnterpriseIdOfPrefix(id, prefix) ? id : null;
}
