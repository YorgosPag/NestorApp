
import type { ObligationSection } from '@/types/obligations';

export const sortSections = (sections: ObligationSection[]): ObligationSection[] => {
  if (!Array.isArray(sections)) {
    return [];
  }
  return [...sections].sort((a, b) => a.order - b.order);
};
