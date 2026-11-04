/**
 * Οπτική ταυτότητα κάθε ομάδας κοινόχρηστων (ADR-931) — **ολική** πάνω στη ρίζα του λεξιλογίου:
 * νέα ομάδα χωρίς εικονίδιο/τόνο δεν μεταγλωττίζεται.
 */

import { ArrowUpDown, DoorOpen, Sparkles, Trees, Wrench, type LucideIcon } from 'lucide-react';
import type { CommonSpaceGroup } from '@/constants/common-space-categories';

/** Οι τόνοι του `UnifiedDashboard` που χρησιμοποιεί η σελίδα. */
export type CommonSpaceGroupTone = 'blue' | 'purple' | 'orange' | 'green' | 'cyan';

export interface CommonSpaceGroupVisual {
  readonly icon: LucideIcon;
  readonly tone: CommonSpaceGroupTone;
}

export const COMMON_SPACE_GROUP_VISUALS: Readonly<Record<CommonSpaceGroup, CommonSpaceGroupVisual>> = {
  circulation: { icon: DoorOpen, tone: 'blue' },
  vertical: { icon: ArrowUpDown, tone: 'purple' },
  technical: { icon: Wrench, tone: 'orange' },
  outdoor: { icon: Trees, tone: 'green' },
  amenity: { icon: Sparkles, tone: 'cyan' },
};
