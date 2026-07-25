/**
 * 🗑️ PROJECTS TRASH ENDPOINT
 *
 * Returns projects with status='deleted' for the current tenant.
 * Used by the UI trash view to show and restore deleted projects.
 *
 * Behaviour lives in `createTrashListRoute`; the contract (collection, response
 * key, sort field, permission) lives in `SOFT_DELETE_CONFIG.project.trashList`.
 *
 * @module api/projects/trash
 * @enterprise ADR-308 — Projects Soft-Delete Trash · ADR-697 — Trash-List Route SSoT
 * @security Permission: projects:projects:view — same as normal list
 */

import { createTrashListRoute } from '@/lib/api/trash-list-route';

export const GET = createTrashListRoute('project');
