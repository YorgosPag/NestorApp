/**
 * Category icon map — ADR-358 §5.5.bis Q8 Phase 7 (Google-grade enhancement).
 *
 * Maps each `AecLayerCategory` (10-value AIA-aligned enum, ADR-358 Q7) to a
 * Lucide icon component. Used by the popover group headers and (optionally)
 * by the ribbon trigger to surface the current layer's category at-a-glance.
 *
 * Pro CAD UI principle: vector icons, NOT emoji. Q8 spec text uses emoji as
 * a visual shorthand but the production component renders Lucide SVGs for
 * theme-coherence with the rest of the ribbon (Building2/Zap/...).
 */

import {
  Antenna,
  Building2,
  Droplets,
  Flame,
  HardHat,
  Layers as LayersIcon,
  Map as MapIcon,
  Sofa,
  Wrench,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import type { AecLayerCategory } from '../../../types/entities';

export const CATEGORY_ICONS: Readonly<Record<AecLayerCategory, LucideIcon>> = Object.freeze({
  architectural: Building2,
  structural: HardHat,
  electrical: Zap,
  mechanical: Wrench,
  plumbing: Droplets,
  fire: Flame,
  civil: MapIcon,
  telecom: Antenna,
  interior: Sofa,
  general: LayersIcon,
});

export function getCategoryIcon(category: AecLayerCategory | null | undefined): LucideIcon {
  if (!category) return LayersIcon;
  return CATEGORY_ICONS[category] ?? LayersIcon;
}
