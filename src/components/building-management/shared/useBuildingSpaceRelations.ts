'use client';

/**
 * @fileoverview **Οι χώροι δίπλα στη λίστα μιας καρτέλας χώρων** (ADR-184 · ADR-898 §20): αναφορές σε χώρους μονάδων
 * του κτιρίου που βρίσκονται σε άλλο κτίριο, και χώροι μονάδων του χωρίς κτίριο. Από τον ΙΔΙΟ κανόνα με τον πίνακα
 * αντικειμενικής (`GET /api/buildings/[buildingId]/space-relations`).
 * @module components/building-management/shared/useBuildingSpaceRelations
 *
 * 🔑 Ζωντανό: κάθε αλλαγή χώρου του ίδιου είδους (σύνδεση · αποσύνδεση · κάδος) **ή μονάδας** (τα `linkedSpaces`) ξαναρωτά
 *   — ο κάτοχος ζει στη μονάδα, όχι στον χώρο.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';

import { API_ROUTES } from '@/config/domain-constants';
import { apiClient } from '@/lib/api/enterprise-api-client';
import type { BuildingSpaceRelations } from '@/lib/building-spaces/building-space-contract';
import type { BuildingSpaceKind } from '@/lib/building-spaces/building-space-membership';
import { createModuleLogger } from '@/lib/telemetry';
import { RealtimeService } from '@/services/realtime/RealtimeService';

const logger = createModuleLogger('useBuildingSpaceRelations');

const EMPTY: BuildingSpaceRelations = { references: [], unplaced: [] };

/** Τα γεγονότα που αλλάζουν τις σχέσεις, ανά είδος — ο κάτοχος ζει στη μονάδα (`UNIT_UPDATED`). */
const EVENTS_OF = {
  parking: ['PARKING_UPDATED', 'PARKING_DELETED', 'UNIT_UPDATED'],
  storage: ['STORAGE_UPDATED', 'STORAGE_DELETED', 'UNIT_UPDATED'],
} as const;

export function useBuildingSpaceRelations(buildingId: string, kind: BuildingSpaceKind): BuildingSpaceRelations {
  const [relations, setRelations] = useState<BuildingSpaceRelations>(EMPTY);

  const load = useCallback(async () => {
    try {
      setRelations(await apiClient.get<BuildingSpaceRelations>(API_ROUTES.BUILDINGS.SPACE_RELATIONS(buildingId)));
    } catch (error) {
      // Η λίστα της καρτέλας δεν εξαρτάται από αυτό — χωρίς σχέσεις, απλώς δεν φαίνονται.
      logger.warn('Space relations failed to load', { buildingId, error: String(error) });
      setRelations(EMPTY);
    }
  }, [buildingId]);

  useEffect(() => {
    void load();
    const unsubscribers = EVENTS_OF[kind].map((event) => RealtimeService.subscribe(event, () => void load()));
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [load, kind]);

  return useMemo(
    () => ({
      references: relations.references.filter((space) => space.kind === kind),
      unplaced: relations.unplaced.filter((space) => space.kind === kind),
    }),
    [relations, kind],
  );
}
