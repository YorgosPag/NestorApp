/**
 * 🗑️ COMMON SPACES TRASH ENDPOINT (ADR-931)
 *
 * Returns common spaces with status='deleted' for the current tenant. Behaviour lives in
 * `createTrashListRoute`; the contract lives in `SOFT_DELETE_CONFIG.common_space.trashList`.
 *
 * @module api/common-spaces/trash
 * @enterprise ADR-281 — SSOT Soft-Delete System · ADR-697 — Trash-List Route SSoT
 * @security Permission: units:units:view — same as normal list
 */

import { createTrashListRoute } from '@/lib/api/trash-list-route';

export const GET = createTrashListRoute('common_space', { category: 'STANDARD' });
