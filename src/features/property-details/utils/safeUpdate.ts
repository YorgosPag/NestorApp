'use client';

import type { Property } from '@/types/property-viewer';

export function makeSafeUpdate(isReadOnly: boolean, onUpdate: (id: string, updates: Partial<Property>) => void) {
  return isReadOnly ? (() => {}) : onUpdate;
}
