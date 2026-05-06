import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '@/lib/api/enterprise-api-client';
import { API_ROUTES } from '@/config/domain-constants';
import { RealtimeService } from '@/services/realtime/RealtimeService';

/** Shared factory — one implementation, three space-type exports below. */
function useHasAnySpaces(
  route: string,
  responseKey: string,
  createdEvent: string,
  deletedEvent: string,
): boolean {
  const [hasItems, setHasItems] = useState(false);

  const check = useCallback(async () => {
    try {
      const result = await apiClient.get<Record<string, unknown>>(route);
      const items = result?.[responseKey];
      setHasItems(Array.isArray(items) ? items.length > 0 : false);
    } catch {
      setHasItems(false);
    }
  }, [route, responseKey]);

  useEffect(() => { check(); }, [check]);

  useEffect(() => {
    const u1 = RealtimeService.subscribe(createdEvent, check);
    const u2 = RealtimeService.subscribe(deletedEvent, check);
    return () => { u1(); u2(); };
  }, [check, createdEvent, deletedEvent]);

  return hasItems;
}

/** True when ≥1 Property exists in the system. Updates in real-time. */
export function useHasAnyUnits(): boolean {
  return useHasAnySpaces(
    API_ROUTES.PROPERTIES.LIST,
    'units',
    'UNIT_CREATED',
    'UNIT_DELETED',
  );
}

/** True when ≥1 ParkingSpot exists in the system. Updates in real-time. */
export function useHasAnyParking(): boolean {
  return useHasAnySpaces(
    API_ROUTES.PARKING.LIST,
    'parkingSpots',
    'PARKING_CREATED',
    'PARKING_DELETED',
  );
}

/** True when ≥1 Storage exists in the system. Updates in real-time. */
export function useHasAnyStorages(): boolean {
  return useHasAnySpaces(
    API_ROUTES.STORAGES.LIST,
    'storages',
    'STORAGE_CREATED',
    'STORAGE_DELETED',
  );
}
