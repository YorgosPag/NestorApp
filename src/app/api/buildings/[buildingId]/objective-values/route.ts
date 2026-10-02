/**
 * GET /api/buildings/[buildingId]/objective-values — η αντικειμενική αξία κάθε μονάδας του κτιρίου (ADR-898 Φ4).
 *
 * 🔑 Υπολογισμός **κατά την ανάγνωση** (ADR-889 §10.2): οι τιμές ζωνών αναθεωρούνται — τίποτα δεν αποθηκεύεται.
 * 🔑 `private, no-store`: εσωτερικά στοιχεία του κατασκευαστή (και μονάδες με κρυμμένη αντικειμενική στο κοινό).
 *
 * @module api/buildings/[buildingId]/objective-values
 * @permission buildings:buildings:view
 */

import { NextResponse } from 'next/server';

import { API_ROUTES } from '@/config/domain-constants';
import { buildingScopedRoute } from '@/lib/api/building-scoped-route';
import { marketDayOf } from '@/lib/listings/listing-stats';
import type { BuildingObjectiveValues } from '@/lib/objective-value/building-objective-values-contract';
import { readBuildingObjectiveValues } from '@/services/objective-value/building-objective-values.service';

export const maxDuration = 60;

export const GET = buildingScopedRoute<BuildingObjectiveValues>({
  routePath: API_ROUTES.BUILDINGS.OBJECTIVE_VALUES,
  permissions: 'buildings:buildings:view',
  handler: async ({ adminDb, buildingId }) => {
    const values = await readBuildingObjectiveValues(adminDb, buildingId, marketDayOf(Date.now()));
    return NextResponse.json(values, { headers: { 'Cache-Control': 'private, no-store' } });
  },
});
