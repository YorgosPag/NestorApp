'use client';

/**
 * PropertyTypeIcon — Colored icon for a given PropertyType.
 * Used in property pickers (MultiSelect tree/chips, SingleSelect items).
 *
 * @module components/properties/shared/property-type-icon
 */

import {
  Home, Building2, Crown, Layers, TreePine,
  ShoppingBag, Briefcase, LayoutDashboard, Package, Building,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PropertyType } from '@/types/property';

interface IconConfig {
  Icon: LucideIcon;
  color: string;
}

const ICON_MAP: Partial<Record<string, IconConfig>> = {
  studio:         { Icon: Home,            color: 'text-sky-400'     },
  apartment_1br:  { Icon: Home,            color: 'text-blue-400'    },
  apartment:      { Icon: Home,            color: 'text-blue-500'    },
  maisonette:     { Icon: Building2,       color: 'text-indigo-400'  },
  penthouse:      { Icon: Crown,           color: 'text-yellow-400'  },
  loft:           { Icon: Layers,          color: 'text-orange-400'  },
  detached_house: { Icon: Home,            color: 'text-emerald-400' },
  villa:          { Icon: TreePine,        color: 'text-green-500'   },
  shop:           { Icon: ShoppingBag,     color: 'text-orange-500'  },
  office:         { Icon: Briefcase,       color: 'text-slate-400'   },
  hall:           { Icon: LayoutDashboard, color: 'text-gray-400'    },
  storage:        { Icon: Package,         color: 'text-amber-500'   },
};

const DEFAULT_CONFIG: IconConfig = { Icon: Building, color: 'text-muted-foreground' };

export function PropertyTypeIcon({
  type,
  className,
}: {
  type?: PropertyType | string | null;
  className?: string;
}) {
  const { Icon, color } = (type ? (ICON_MAP[type] ?? DEFAULT_CONFIG) : DEFAULT_CONFIG);
  return <Icon className={cn('shrink-0', color, className)} aria-hidden />;
}
