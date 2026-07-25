/**
 * 🗑️ BUILDINGS TRASH ENDPOINT
 *
 * Returns buildings with status='deleted' for the current tenant.
 * Used by the UI trash view to show and restore deleted buildings.
 *
 * Behaviour lives in `createTrashListRoute`; the contract (collection, response
 * key, sort field, permission) lives in `SOFT_DELETE_CONFIG.building.trashList`.
 *
 * @module api/buildings/trash
 * @enterprise ADR-308 — Buildings Soft-Delete Trash · ADR-697 — Trash-List Route SSoT
 * @security Permission: buildings:buildings:view — same as normal list
 */

import { createTrashListRoute } from '@/lib/api/trash-list-route';

export const GET = createTrashListRoute('building');
