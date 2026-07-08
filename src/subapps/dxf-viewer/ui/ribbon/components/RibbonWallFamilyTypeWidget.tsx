'use client';

/**
 * ADR-412 Φ4 — Wall Family Type selector (contextual Wall ribbon).
 *
 * Thin binding of the shared `createFamilyTypeSelectorWidget` factory (ADR-603 Φ4)
 * to the wall controller. Radix `Select` (ADR-001) + «Duplicate» (Revit
 * clone-to-edit); all logic lives in `useWallFamilyTypeController` (SSoT).
 *
 * @see ./create-family-type-selector-widget.tsx — shared factory (ADR-603)
 * @see ../hooks/useWallFamilyTypeController.ts
 */

import { createFamilyTypeSelectorWidget } from './create-family-type-selector-widget';
import { useWallFamilyTypeController } from '../hooks/useWallFamilyTypeController';

export const RibbonWallFamilyTypeWidget = createFamilyTypeSelectorWidget(() => {
  const c = useWallFamilyTypeController();
  return {
    entity: c.wall,
    types: c.wallTypes,
    currentType: c.currentType,
    canWrite: c.canWrite,
    assignType: c.assignType,
    duplicateCurrent: c.duplicateCurrent,
  };
});
