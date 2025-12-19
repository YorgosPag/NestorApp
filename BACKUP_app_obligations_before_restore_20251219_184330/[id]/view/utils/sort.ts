
import type { ObligationSection } from '@/types/obligations';

export const sortSections = (sections: ObligationSection[]): ObligationSection[] => {
  if (!Array.isArray(sections)) {
    return [];
  }
  // Create a shallow copy before sorting to avoid mutating the original array
  return [...sections].sort((a, b) => a.order - b.order);
};
