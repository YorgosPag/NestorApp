'use client';

/**
 * ADR-632 Φ5 — Slab-opening validation warnings section.
 *
 * Surfaces `SlabOpeningEntity.validation.violationKeys` ως αναγνώσιμη λίστα
 * (π.χ. το soft warning `slabOpening.validation.codeViolations.outlineAtSlabEdge`
 * ενός auto «well» opening που ακουμπά χείλος πλάκας). Συμπληρώνει το red badge
 * του ribbon με το «ΤΙ φταίει», όχι μόνο «ΟΤΙ κάτι φταίει» (Revit Warnings palette).
 *
 * Delegates στο shared `ViolationKeyWarningsSection` SSoT (N.0.2/N.18 — μηδέν
 * hand-rolled twin του Wall/Stair).
 */

import React from 'react';
import type { SlabOpeningEntity } from '../../../bim/types/slab-opening-types';
import { ViolationKeyWarningsSection } from '../../structural-warnings/ViolationKeyWarningsSection';

export interface SlabOpeningWarningsSectionProps {
  readonly opening: SlabOpeningEntity;
}

export function SlabOpeningWarningsSection({
  opening,
}: SlabOpeningWarningsSectionProps): React.ReactElement | null {
  return (
    <ViolationKeyWarningsSection
      violationKeys={opening.validation?.violationKeys ?? []}
      titleKey="slabOpeningAdvancedPanel.sections.warnings.title"
    />
  );
}
