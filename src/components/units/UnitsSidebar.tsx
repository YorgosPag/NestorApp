'use client';

import { UnitsSidebar as RefactoredUnitsSidebar } from '@/features/units-sidebar/UnitsSidebar';
import type { UnitsSidebarProps } from '@/features/units-sidebar/types';

// This component now acts as a pass-through to the new refactored implementation.
export function UnitsSidebar(props: UnitsSidebarProps) {
  return <RefactoredUnitsSidebar {...props} />;
}
