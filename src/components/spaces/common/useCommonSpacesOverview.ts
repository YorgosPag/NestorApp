'use client';

/**
 * Τα δεδομένα της σελίδας κοινόχρηστων (ADR-931): ζωντανοί χώροι + ζωντανά κτίρια → σύνολα.
 * Καμία τιμή δεν γράφεται με το χέρι· όλα προκύπτουν από το `computeCommonSpaceStats`.
 */

import { useMemo } from 'react';
import { useFirestoreCommonSpaces } from '@/hooks/useFirestoreCommonSpaces';
import { useFirestoreBuildings } from '@/hooks/useFirestoreBuildings';
import { computeCommonSpaceStats, type CommonSpaceStats } from '@/lib/common-spaces/common-space-stats';

export interface CommonSpacesOverview {
  readonly stats: CommonSpaceStats;
  readonly buildingNames: ReadonlyMap<string, string>;
  readonly loading: boolean;
  readonly error: string | null;
}

export function useCommonSpacesOverview(): CommonSpacesOverview {
  const { commonSpaces, loading: spacesLoading, error } = useFirestoreCommonSpaces();
  const { buildings, loading: buildingsLoading } = useFirestoreBuildings();

  const stats = useMemo(() => computeCommonSpaceStats(commonSpaces), [commonSpaces]);
  const buildingNames = useMemo(
    () => new Map(buildings.map((building) => [building.id, building.name])),
    [buildings],
  );

  return { stats, buildingNames, loading: spacesLoading || buildingsLoading, error };
}
