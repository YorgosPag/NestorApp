/**
 * @fileoverview **ΠΥΞΙΔΑ ΠΡΟΣΑΝΑΤΟΛΙΣΜΟΥ 3×3** — η επιλογή προσανατολισμού ως ανεμολόγιο, όχι ως σειρά γραμμάτων.
 * @related ADR-287 (λεξιλόγιο προσανατολισμού SSoT) · ui/toggle-button
 * @module components/properties/shared/OrientationCompassGrid
 *
 * 🔑 **ΓΙΑΤΙ.** Η σειρά `Β · ΒΑ · Α · ΝΑ · Ν · ΝΔ · Δ · ΒΔ` ζητούσε από τον χρήστη να ξέρει τι σημαίνει «ΝΔ» και
 * να το τοποθετήσει νοερά στον χάρτη. Στο πλέγμα η **θέση** λέει την κατεύθυνση (πάνω = Βορράς), και το ολογράφως
 * όνομα φαίνεται στο tooltip και στη σύνοψη κάτω από το πλέγμα.
 *
 * ⚠️ **Πολλαπλή επιλογή** (γωνιακό, διαμπερές): κάθε κελί είναι ανεξάρτητη εναλλαγή (`aria-pressed`) — γι' αυτό
 * `ToggleButton` και **όχι** `SegmentedControl` (εκείνο είναι «ένα από Ν»).
 *
 * ⚠️ Το λεξιλόγιο **δεν** ξαναγράφεται εδώ: οι τιμές έρχονται από το `Orientation`, τα ονόματα από το
 * `ORIENTATION_LABELS` και η χωρική διάταξη από το `COMPASS_GRID_LAYOUT` (κοινή με την πυξίδα της αγγελίας).
 */

import React from 'react';
import type { TFunction } from 'i18next';
import { Compass } from 'lucide-react';

import { ToggleButton } from '@/components/ui/toggle-button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ORIENTATION_LABELS, type OrientationType } from '@/constants/property-features-enterprise';
import { COMPASS_GRID_LAYOUT as COMPASS_LAYOUT } from '@/constants/orientation-compass';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';

export interface OrientationCompassGridProps {
  readonly value: readonly OrientationType[];
  readonly onToggle: (orientation: OrientationType) => void;
  readonly disabled?: boolean;
  /** Το `t` του namespace `properties-enums` (εκεί ζουν τα `orientation.*` και `units.orientation.*`). */
  readonly t: TFunction;
  readonly className?: string;
}

export function OrientationCompassGrid({ value, onToggle, disabled, t, className }: OrientationCompassGridProps) {
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const fullName = (o: OrientationType) => t(ORIENTATION_LABELS[o]);
  const selectedNames = COMPASS_LAYOUT
    .filter((o): o is OrientationType => o !== null && value.includes(o))
    .map(fullName);

  return (
    <section className={cn('space-y-1', className)}>
      <div
        role="group"
        aria-label={t('orientation.sectionTitle')}
        className="grid w-fit grid-cols-3 gap-1"
      >
        {COMPASS_LAYOUT.map((orientation) =>
          orientation === null ? (
            <span
              key="center"
              aria-hidden="true"
              className={cn('flex h-8 w-10 items-center justify-center', colors.text.muted)}
            >
              <Compass className={iconSizes.sm} />
            </span>
          ) : (
            <Tooltip key={orientation}>
              <TooltipTrigger asChild>
                <ToggleButton
                  type="button"
                  pressed={value.includes(orientation)}
                  variant="outline"
                  size="sm"
                  className="h-8 w-10 px-0 text-xs"
                  disabled={disabled}
                  aria-label={fullName(orientation)}
                  onClick={() => onToggle(orientation)}
                >
                  {t(`orientation.short.${orientation}`)}
                </ToggleButton>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                {fullName(orientation)}
              </TooltipContent>
            </Tooltip>
          ),
        )}
      </div>
      <p aria-live="polite" className={cn('text-xs', colors.text.muted)}>
        {selectedNames.length > 0 ? selectedNames.join(', ') : t('orientation.compass.northUp')}
      </p>
    </section>
  );
}
