'use client';

import { PropertiesSidebar as RefactoredPropertiesSidebar } from '@/features/properties-sidebar/PropertiesSidebar';
import type { PropertiesSidebarProps } from '@/features/properties-sidebar/types';

// This component now acts as a pass-through to the new refactored implementation.
export function PropertiesSidebar(props: PropertiesSidebarProps) {
  return <RefactoredPropertiesSidebar {...props} />;
}
