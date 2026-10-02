/**
 * GET /api/buildings/[buildingId]/space-relations — ό,τι δείχνουν οι καρτέλες θέσεων/αποθηκών **δίπλα** στη λίστα τους
 * (ADR-184 · ADR-898 §20): χώροι μονάδων του κτιρίου που **βρίσκονται σε άλλο** κτίριο (αναφορές, χωρίς ποσό) και
 * χώροι μονάδων του **χωρίς** κτίριο (μετρούν εδώ — επιδιόρθωση ενός κλικ).
 *
 * 🔑 Ο ΙΔΙΟΣ κανόνας «ποιοι χώροι είναι του κτιρίου» με τον πίνακα αντικειμενικής
 *   (`lib/building-spaces/building-space-membership.ts`) — κανένας τρίτος.
 *
 * @module api/buildings/[buildingId]/space-relations
 * @permission buildings:buildings:view
 * @rateLimit STANDARD (60 req/min) — δηλωμένο εδώ (`category`), όχι κρυμμένο στο εργοστάσιο (CHECK 3.78)
 */

import { NextResponse } from 'next/server';

import { API_ROUTES } from '@/config/domain-constants';
import { buildingScopedRoute } from '@/lib/api/building-scoped-route';
import type { BuildingSpaceRelations } from '@/lib/building-spaces/building-space-contract';
import { readBuildingSpaceRelations } from '@/services/building-spaces/building-space-admin-reader';

export const GET = buildingScopedRoute<BuildingSpaceRelations>({
  routePath: API_ROUTES.BUILDINGS.SPACE_RELATIONS,
  permissions: 'buildings:buildings:view',
  category: 'STANDARD',
  handler: async ({ adminDb, buildingId }) => {
    const relations = await readBuildingSpaceRelations(adminDb, buildingId);
    return NextResponse.json(relations, { headers: { 'Cache-Control': 'private, no-store' } });
  },
});
