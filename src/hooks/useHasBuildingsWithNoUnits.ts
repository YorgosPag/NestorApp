'use client';

import { useNavigation } from '@/components/navigation';

/**
 * Returns true if at least one building has no active units.
 * Reactive: updates in real-time via NavigationContext onSnapshot subscriptions.
 * Zero duplicate Firestore subscriptions — derived from NavigationContext data.
 */
export function useHasBuildingsWithNoUnits(): boolean {
  return useNavigation().hasBuildingsWithNoUnits;
}
