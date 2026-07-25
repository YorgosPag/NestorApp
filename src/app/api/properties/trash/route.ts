/**
 * 🗑️ PROPERTIES TRASH ENDPOINT
 *
 * Returns properties with status='deleted' for the current tenant.
 * Used by the UI trash view to show and restore deleted properties.
 *
 * Behaviour lives in `createTrashListRoute`; the contract (collection, response
 * key, sort field, permission) lives in `SOFT_DELETE_CONFIG.property.trashList`.
 *
 * @module api/properties/trash
 * @enterprise ADR-281 — SSOT Soft-Delete System · ADR-697 — Trash-List Route SSoT
 * @security Permission: properties:properties:view — same as normal list
 */

import { createTrashListRoute } from '@/lib/api/trash-list-route';

export const GET = createTrashListRoute('property');
