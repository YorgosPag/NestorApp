/**
 * Οι δύο βαθμίδες γραμμών χάρακα: ποια πεδία του άξονα διαβάζει και γράφει καθεμία.
 *
 * Δηλώσεις με συναρτήσεις, όχι υπολογισμένα κλειδιά: έτσι ο τύπος κρατά ότι το `show*` είναι
 * boolean και το `*Color` string, και μια βαθμίδα δεν μπορεί να γράψει πεδίο της άλλης.
 */

import type { RulerAxisSettings } from '../../../../../../systems/rulers-grid/config';

export type RulerTickTier = 'major' | 'minor';

type AxisPatch = Partial<RulerAxisSettings>;

export interface RulerTickFields {
  visible: (axis: RulerAxisSettings) => boolean;
  color: (axis: RulerAxisSettings) => string;
  length: (axis: RulerAxisSettings) => number;
  patchVisible: (visible: boolean) => AxisPatch;
  patchColor: (color: string) => AxisPatch;
  patchLength: (length: number) => AxisPatch;
}

export const RULER_TICK_TIERS: Readonly<Record<RulerTickTier, RulerTickFields>> = {
  major: {
    visible: (axis) => axis.showMajorTicks,
    color: (axis) => axis.majorTickColor,
    length: (axis) => axis.majorTickLength,
    patchVisible: (showMajorTicks) => ({ showMajorTicks }),
    patchColor: (majorTickColor) => ({ majorTickColor }),
    patchLength: (majorTickLength) => ({ majorTickLength }),
  },
  minor: {
    visible: (axis) => axis.showMinorTicks,
    color: (axis) => axis.minorTickColor,
    length: (axis) => axis.minorTickLength,
    patchVisible: (showMinorTicks) => ({ showMinorTicks }),
    patchColor: (minorTickColor) => ({ minorTickColor }),
    patchLength: (minorTickLength) => ({ minorTickLength }),
  },
};

/** Τα κλειδιά κάθε βαθμίδας, κάτω από `rulerSettings.<major|minor>Lines`. */
export const RULER_TICK_LABEL_KEYS = [
  'display.title',
  'display.description',
  'opacity.title',
  'opacity.description',
  'color.title',
  'color.description',
  'colorPicker',
  'width.title',
  'width.description',
] as const;

export type RulerTickLabelKey = (typeof RULER_TICK_LABEL_KEYS)[number];

export function rulerTickLabelKey(tier: RulerTickTier, key: RulerTickLabelKey): string {
  return `rulerSettings.${tier}Lines.${key}`;
}
