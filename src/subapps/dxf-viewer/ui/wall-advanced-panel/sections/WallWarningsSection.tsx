'use client';

/**
 * ADR-363 Phase 1D — Wall validation warnings section.
 *
 * Surfaces `WallEntity.validation.violationKeys` as a readable list, mirror
 * `StairWarningsSection` (ADR-358 Phase 7b1). Delegates the rendering to the
 * shared `ViolationKeyWarningsSection` SSoT (ADR-632 Φ5 dedup, N.0.2/N.18) —
 * before, this file hand-rolled the same list markup as the stair soft section.
 *
 * Phase 1D scope: read-only display. Auto-fix affordance (parallel to
 * stair `autoFixStairParams`) lands when wall-auto-fix engine is added.
 */

import React from 'react';
import type { WallEntity } from '../../../bim/types/wall-types';
import { ViolationKeyWarningsSection } from '../../structural-warnings/ViolationKeyWarningsSection';

export interface WallWarningsSectionProps {
  readonly wall: WallEntity;
}

export function WallWarningsSection({
  wall,
}: WallWarningsSectionProps): React.ReactElement | null {
  return (
    <ViolationKeyWarningsSection
      violationKeys={wall.validation?.violationKeys ?? []}
      titleKey="wallAdvancedPanel.sections.warnings.title"
    />
  );
}
