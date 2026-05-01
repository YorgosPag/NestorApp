'use client';

/**
 * PropertyTypeIcon — Canonical icon for any property, regardless of type.
 *
 * SSoT: reads icon + color from NAVIGATION_ENTITIES.property.
 * Type-specific icons were removed — all properties share one visual identity.
 *
 * @module components/properties/shared/property-type-icon
 */

import { cn } from '@/lib/utils';
import { NAVIGATION_ENTITIES } from '@/components/navigation/config';
import type { PropertyType } from '@/types/property';

export function PropertyTypeIcon({
  type: _type,
  className,
}: {
  type?: PropertyType | string | null;
  className?: string;
}) {
  const { icon: Icon, color } = NAVIGATION_ENTITIES.property;
  return <Icon className={cn('shrink-0', color, className)} aria-hidden />;
}
