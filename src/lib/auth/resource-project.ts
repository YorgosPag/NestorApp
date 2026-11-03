import 'server-only';

/**
 * «ΣΕ ΠΟΙΟ ΕΡΓΟ ΑΝΗΚΕΙ ΑΥΤΟΣ Ο ΠΟΡΟΣ;» — η μία απάντηση του κριτή (ADR-926 Κ3).
 *
 * Το έργο έρχεται από το **έγγραφο του πόρου**, αφού περάσει τον φράχτη χώρου. Ξένος πόρος δίνει 404 πριν από κρίση
 * ρόλου, ίδιο με το ανύπαρκτο. Από το σώμα διαβάζεται μόνο το **id του πόρου**, ποτέ το έργο του (AIP-203). Η μόνη
 * εξαίρεση είναι η γέννηση κτιρίου, όπου το έργο του σώματος είναι ο ίδιος ο στόχος και περνά πρώτα από τον φράχτη έργου.
 *
 * ⚠️ Χαλασμένο σώμα ή απόν id δίνει {@link NO_PROJECT}: κρίνει μόνο η εταιρεία, και ο handler απαντά το 400 του.
 * Δεν υπάρχει κλάδος όπου η άγνοια ανοίγει τον ρόλο έργου.
 *
 * @module lib/auth/resource-project
 * @see lib/auth/permissions — ο κριτής
 * @see lib/auth/tenant-isolation — ο φράχτης
 */

import type { NextRequest } from 'next/server';

import { requireBuildingInTenant, requireProjectInTenant } from './tenant-isolation';
import type { AuthContext } from './types';

/** Ο πόρος όπως τον βλέπει ο κριτής. `null`: δεν ανήκει σε έργο, ο ρόλος έργου δεν έχει σημείο εφαρμογής (Κ4). */
export interface PermissionResource {
  readonly projectId: string | null;
}

export const NO_PROJECT: PermissionResource = { projectId: null };

/** Ο πόρος ως επιλογή του κριτή. Χωρίς έργο ⇒ κενές επιλογές, άρα κρίνει μόνο η εταιρεία (Κ4). */
export function scopeOf(resource: PermissionResource): { projectId?: string } {
  return resource.projectId === null ? {} : { projectId: resource.projectId };
}

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> => typeof value === 'object' && value !== null;

/**
 * Ένα πεδίο κειμένου του σώματος σε **διαδρομή** (`['draft', 'scope', 'projectId']`), χωρίς να καταναλωθεί το αίτημα.
 * Οτιδήποτε άλλο (χαλασμένο JSON, κενό, άλλος τύπος) ⇒ `null`.
 */
export async function bodyTextAt(request: NextRequest, path: readonly string[]): Promise<string | null> {
  try {
    let value: unknown = await request.clone().json();
    for (const field of path) value = isRecord(value) ? value[field] : undefined;
    return typeof value === 'string' && value.length > 0 ? value : null;
  } catch {
    return null;
  }
}

/** Ένα πεδίο κειμένου στην κορυφή του σώματος. */
export function bodyText(request: NextRequest, field: string): Promise<string | null> {
  return bodyTextAt(request, [field]);
}

/** Τα κτίρια κρατούν ιστορικά και αριθμητικά id έργου. Κενό ⇒ χωρίς έργο. */
function projectIdOf(raw: string | number | null | undefined): string | null {
  if (typeof raw === 'number') return String(raw);
  return typeof raw === 'string' && raw.length > 0 ? raw : null;
}

/**
 * Το έργο ενός κτιρίου, μέσα από τον φράχτη χώρου.
 *
 * @throws TenantIsolationError(404) ξένο ή ανύπαρκτο κτίριο
 */
export async function projectOfBuilding(ctx: AuthContext, buildingId: string, path: string): Promise<PermissionResource> {
  const building = await requireBuildingInTenant({ ctx, buildingId, path });
  return { projectId: projectIdOf(building.projectId) };
}

/** `buildingId` στο σώμα: `PATCH /api/buildings` · `POST /api/floors`. */
export async function projectOfBodyBuilding(request: NextRequest, ctx: AuthContext, path: string): Promise<PermissionResource> {
  const buildingId = await bodyText(request, 'buildingId');
  return buildingId === null ? NO_PROJECT : projectOfBuilding(ctx, buildingId, path);
}

/**
 * Γέννηση κτιρίου: ο στόχος είναι το έργο του σώματος, άρα ξένο έργο δίνει 404 πριν από κρίση ρόλου.
 *
 * @throws TenantIsolationError(404) ξένο ή ανύπαρκτο έργο
 */
export async function projectOfBodyTarget(request: NextRequest, ctx: AuthContext, path: string): Promise<PermissionResource> {
  const projectId = await bodyText(request, 'projectId');
  if (projectId === null) return NO_PROJECT;
  await requireProjectInTenant({ ctx, projectId, path });
  return { projectId };
}
