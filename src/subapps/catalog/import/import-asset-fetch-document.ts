/**
 * =============================================================================
 * Ο ΑΝΑΓΝΩΣΤΗΣ ΤΟΥ ΕΓΓΡΑΦΟΥ ΛΗΨΗΣ (`catalog_import_asset_fetches`, ADR-934 §5.2.2 Μ-β4) — ποτέ cast
 * =============================================================================
 *
 * Έγγραφο άλλου χώρου, άλλης παρτίδας, άλλης διεύθυνσης ή με αλλοιωμένο πεδίο ⇒ `null` (= «καμία λήψη ακόμη»): η διεύθυνση
 * ξαναμπαίνει στην ουρά, ποτέ δεν δείχνεται ψεύτικο «έτοιμο». Ίδιο δόγμα με το `mediaSourceFromDocument`.
 * ⛔ **ΚΑΘΑΡΟ**.
 *
 * @module subapps/catalog/import/import-asset-fetch-document
 */

import { isPayloadOwnedByCompany } from '@/lib/auth/tenant-ownership';
import type { OutboundTransport } from '@/lib/security/outbound-fetch';
import type { ImportAssetFetchDefinition, ImportAssetFetchFailure, MediaContentFacts, MediaSourceVerdict } from '../types/catalog-media';
import { ASSET_FETCH_FAILURES, type AssetFetchFailure, type StoredAssetFetchStatus } from '../vocabulary/asset-fetch';
import { CATALOG_ASSET_ROLES, type CatalogAssetRole } from '../vocabulary/asset-roles';
import { ASSET_KINDS, type AssetKind } from '../vocabulary/attribute-types';

type Data = Readonly<Record<string, unknown>>;

const STORED_STATUSES: readonly StoredAssetFetchStatus[] = ['fetching', 'ready', 'failed'];
const VERDICTS: readonly MediaSourceVerdict[] = ['new', 'sameContent', 'unchanged', 'newVersion'];
const TRANSPORTS: readonly OutboundTransport[] = ['secure', 'insecure'];
const SHA256_HEX = /^[0-9a-f]{64}$/;

const oneOf = <T extends string>(values: readonly T[], value: unknown): value is T => typeof value === 'string' && (values as readonly string[]).includes(value);
const isRecord = (value: unknown): value is Data => typeof value === 'object' && value !== null && !Array.isArray(value);
const isCount = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 0;

function failureOf(value: unknown): ImportAssetFetchFailure | null | undefined {
  if (value === null) return null;
  if (!isRecord(value) || !oneOf<AssetFetchFailure>(ASSET_FETCH_FAILURES, value.code)) return undefined;
  const httpStatus = value.httpStatus === null || isCount(value.httpStatus) ? value.httpStatus : undefined;
  return httpStatus === undefined ? undefined : { code: value.code, httpStatus };
}

function contentOf(value: unknown): MediaContentFacts | null | undefined {
  if (value === null) return null;
  if (!isRecord(value)) return undefined;
  const { fileId, sha256, sizeBytes, kind, ext, contentType } = value;
  if (typeof fileId !== 'string' || fileId === '' || typeof sha256 !== 'string' || !SHA256_HEX.test(sha256)) return undefined;
  if (!isCount(sizeBytes) || !oneOf<AssetKind>(ASSET_KINDS, kind) || typeof ext !== 'string' || typeof contentType !== 'string') return undefined;
  return { fileId, sha256, sizeBytes, kind, ext, contentType };
}

const nullableOneOf = <T extends string>(values: readonly T[], value: unknown): T | null | undefined =>
  value === null ? null : oneOf(values, value) ? value : undefined;

/** Ο κάτοχος και η ταυτότητα: χώρος · παρτίδα · διεύθυνση — αλλιώς δεν είναι αυτή η λήψη. */
const belongs = (data: Data, expected: { readonly companyId: string; readonly batchId: string; readonly uri: string }): boolean =>
  data.batchId === expected.batchId && data.uri === expected.uri
  && isPayloadOwnedByCompany({ companyId: typeof data.companyId === 'string' ? data.companyId : null }, expected.companyId);

export function importAssetFetchFromDocument(
  data: Data | undefined,
  expected: { readonly companyId: string; readonly batchId: string; readonly uri: string },
): ImportAssetFetchDefinition | null {
  if (data === undefined || !belongs(data, expected)) return null;
  const failure = failureOf(data.failure);
  const content = contentOf(data.content);
  const verdict = nullableOneOf(VERDICTS, data.verdict);
  const transport = nullableOneOf(TRANSPORTS, data.transport);
  const leaseUntil = data.leaseUntil === null || isCount(data.leaseUntil) ? data.leaseUntil : undefined;
  const { status, attempts, roles, updatedAt, updatedBy } = data;
  if (failure === undefined || content === undefined || verdict === undefined || transport === undefined || leaseUntil === undefined) return null;
  if (!oneOf(STORED_STATUSES, status) || !isCount(attempts) || !Array.isArray(roles) || typeof updatedAt !== 'string' || typeof updatedBy !== 'string') return null;
  const knownRoles = roles.filter((role): role is CatalogAssetRole => oneOf(CATALOG_ASSET_ROLES, role));
  return { ...expected, roles: knownRoles, status, leaseUntil, attempts, failure, verdict, content, transport, updatedAt, updatedBy };
}
