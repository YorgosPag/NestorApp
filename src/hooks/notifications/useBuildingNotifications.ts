'use client';

import { useMemo } from 'react';
import { useNotifications } from '@/providers/NotificationProvider';
import { NOTIFICATION_KEYS } from '@/config/notification-keys';

export interface BuildingFloorNotifications {
  readonly created: () => void;
  readonly createError: (serverMessage?: string) => void;
  readonly duplicate: () => void;
}

export interface BuildingNotifications {
  readonly created: () => void;
  readonly updated: () => void;
  readonly createError: (serverMessage?: string) => void;
  readonly updateError: (serverMessage?: string) => void;
  readonly floor: BuildingFloorNotifications;
}

export function useBuildingNotifications(): BuildingNotifications {
  const { success, error } = useNotifications();

  return useMemo<BuildingNotifications>(() => {
    const fireError = (key: string, serverMessage?: string) => {
      if (serverMessage && serverMessage.trim().length > 0) {
        error(serverMessage);
        return;
      }
      error(key);
    };

    return {
      created: () => success(NOTIFICATION_KEYS.buildings.created),
      updated: () => success(NOTIFICATION_KEYS.buildings.updated),
      createError: (serverMessage) => fireError(NOTIFICATION_KEYS.buildings.createError, serverMessage),
      updateError: (serverMessage) => fireError(NOTIFICATION_KEYS.buildings.updateError, serverMessage),
      floor: {
        created: () => success(NOTIFICATION_KEYS.buildings.floor.created),
        createError: (serverMessage) => fireError(NOTIFICATION_KEYS.buildings.floor.createError, serverMessage),
        duplicate: () => error(NOTIFICATION_KEYS.buildings.floor.duplicate),
      },
    };
  }, [success, error]);
}
