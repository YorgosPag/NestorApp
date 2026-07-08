'use client';

/**
 * ADR-421 SLICE C — Opening Family Type selector (contextual Opening ribbon).
 *
 * Thin binding of the shared `createFamilyTypeSelectorWidget` factory (ADR-604 Φ4)
 * to the opening controller. Same Radix `Select` + «Duplicate» design as the wall
 * widget; all logic lives in `useOpeningFamilyTypeController` (SSoT). A Type switch
 * re-routes the opening's 2D symbol / 3D mesh / IFC family.
 *
 * @see ./create-family-type-selector-widget.tsx — shared factory (ADR-604)
 * @see ../hooks/useOpeningFamilyTypeController.ts
 */

import { createFamilyTypeSelectorWidget } from './create-family-type-selector-widget';
import { useOpeningFamilyTypeController } from '../hooks/useOpeningFamilyTypeController';

export const RibbonOpeningFamilyTypeWidget = createFamilyTypeSelectorWidget(() => {
  const c = useOpeningFamilyTypeController();
  return {
    entity: c.opening,
    types: c.openingTypes,
    currentType: c.currentType,
    canWrite: c.canWrite,
    assignType: c.assignType,
    duplicateCurrent: c.duplicateCurrent,
  };
});
