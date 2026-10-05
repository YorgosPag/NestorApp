/**
 * 🗄️ PROPERTIES ARCHIVE ENDPOINT
 *
 * Returns properties with status='archived' for the current tenant — όσα αποσύρθηκαν από την
 * καθημερινή λίστα αλλά μένουν επειδή τα αναφέρουν άλλες εγγραφές (ADR-329 §3.9).
 *
 * Behaviour lives in `createArchiveListRoute`; the contract is shared with the bin
 * (`SOFT_DELETE_CONFIG.property.trashList`) and gated by `SOFT_DELETE_CONFIG.property.archive`.
 *
 * @module api/properties/archived
 * @enterprise ADR-281 — SSOT Soft-Delete System · ADR-697 — Trash-List Route SSoT
 * @security Permission: properties:properties:view — same as normal list
 */

import { createArchiveListRoute } from '@/lib/api/trash-list-route';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';

export const GET = withStandardRateLimit(createArchiveListRoute('property'));
