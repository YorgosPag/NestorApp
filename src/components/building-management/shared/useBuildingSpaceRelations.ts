'use client';

/**
 * @fileoverview **Οι χώροι δίπλα στη λίστα μιας καρτέλας χώρων** (ADR-184 · ADR-898 §20): αναφορές σε χώρους μονάδων
 * του κτιρίου που βρίσκονται σε άλλο κτίριο, και χώροι μονάδων του χωρίς κτίριο. Από τον ΙΔΙΟ κανόνα με τον πίνακα
 * αντικειμενικής (`GET /api/buildings/[buildingId]/space-relations`).
 * @module components/building-management/shared/useBuildingSpaceRelations
 *
 * 🔑 Ζωντανό: κάθε αλλαγή χώρου του ίδιου είδους (σύνδεση · αποσύνδεση · κάδος) **ή μονάδας** (τα `linkedSpaces`) ξαναρωτά
 *   — ο κάτοχος ζει στη μονάδα, όχι στον χώρο.
 *
 * 🔴 **«Δεν φόρτωσε» ≠ «δεν υπάρχει τίποτα»** (ADR-898 §21.6 Ε2): μια αποτυχημένη ανάγνωση γύριζε `EMPTY`, και το πάνελ
 *   εξαφανιζόταν — ψευδές πράσινο («κανένας χώρος αλλού»). Η κατάσταση είναι πλέον ρητή (`loading | ready | error`), από
 *   τον ΕΝΑ μηχανισμό ανάγνωσης με αρίθμηση (`useReconciledResource`: εφαρμόζεται μόνο η τελευταία απάντηση).
 */

import { useCallback, useEffect, useMemo } from 'react';

import { API_ROUTES } from '@/config/domain-constants';
import { useReconciledResource } from '@/hooks/useReconciledResource';
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

/** Η απάντηση **μαζί με το κτίριο που ρωτήθηκε** — οι σχέσεις ενός κτιρίου δεν δείχνονται ποτέ ως σχέσεις άλλου. */
interface LoadedRelations {
  readonly buildingId: string;
  readonly relations: BuildingSpaceRelations;
}

export type BuildingSpaceRelationsStatus = 'loading' | 'ready' | 'error';

export interface BuildingSpaceRelationsState extends BuildingSpaceRelations {
  /**
   * `error` ⇒ η τελευταία ανάγνωση απέτυχε. Τα `references`/`unplaced` είναι τότε η **τελευταία γνωστή** εικόνα (ή κενά,
   * αν δεν υπήρξε ποτέ) — ο καταναλωτής **οφείλει** να το πει, ποτέ να τα δείξει ως «τίποτα».
   */
  readonly status: BuildingSpaceRelationsStatus;
  readonly retry: () => void;
}

export function useBuildingSpaceRelations(buildingId: string, kind: BuildingSpaceKind): BuildingSpaceRelationsState {
  const load = useCallback(async (): Promise<LoadedRelations | null> => {
    try {
      const relations = await apiClient.get<BuildingSpaceRelations>(API_ROUTES.BUILDINGS.SPACE_RELATIONS(buildingId));
      return { buildingId, relations };
    } catch (error) {
      logger.warn('Space relations failed to load', { buildingId, error: String(error) });
      return null;
    }
  }, [buildingId]);

  const { data, status, refresh } = useReconciledResource(load);

  useEffect(() => {
    const unsubscribers = EVENTS_OF[kind].map((event) => RealtimeService.subscribe(event, () => void refresh()));
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [refresh, kind]);

  const retry = useCallback(() => void refresh(), [refresh]);
  const known = data?.buildingId === buildingId ? data.relations : null;

  return useMemo(() => {
    const relations = known ?? EMPTY;
    return {
      status: status === 'error' ? 'error' : known === null ? 'loading' : 'ready',
      retry,
      references: relations.references.filter((space) => space.kind === kind),
      unplaced: relations.unplaced.filter((space) => space.kind === kind),
    };
  }, [known, status, retry, kind]);
}
