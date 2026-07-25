/**
 * 🗑️ STORAGES TRASH ENDPOINT
 *
 * Returns storage units with status='deleted' for the current tenant.
 * Used by the UI trash view to show and restore deleted storage units.
 *
 * Behaviour lives in `createTrashListRoute`; the contract (collection, response
 * key, sort field, permission) lives in `SOFT_DELETE_CONFIG.storage.trashList`.
 *
 * @module api/storages/trash
 * @enterprise ADR-281 — SSOT Soft-Delete System · ADR-697 — Trash-List Route SSoT
 * @security Permission: units:units:view — same as normal list
 */

import { createTrashListRoute } from '@/lib/api/trash-list-route';

export const GET = createTrashListRoute('storage');
