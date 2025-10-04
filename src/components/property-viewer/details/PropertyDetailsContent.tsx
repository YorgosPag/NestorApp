'use client';

import { PropertyDetailsContent as RefactoredPropertyDetailsContent } from '@/features/property-details/PropertyDetailsContent';
import type { PropertyDetailsContentProps } from '@/features/property-details/types';

// This component now acts as a pass-through to the new refactored implementation.
export function PropertyDetailsContent(props: PropertyDetailsContentProps) {
  return <RefactoredPropertyDetailsContent {...props} />;
}
