// /home/user/studio/src/app/api/communications/webhooks/telegram/search/criteria.ts

import type { SearchCriteria } from "../shared/types";

export function extractSearchCriteria(text: string): SearchCriteria {
  const criteria: SearchCriteria = {};
  const lowerText = text.toLowerCase();

  const priceMatch = lowerText.match(/κάτω\s+από\s+([\d.,]+)/);
  if (priceMatch) {
    criteria.maxPrice = parseFloat(priceMatch[1].replace(/[.,]/g, ''));
    if (lowerText.includes('χιλιάδες') || lowerText.includes('k')) {
      criteria.maxPrice *= 1000;
    }
  }

  const roomsMatch = lowerText.match(/(\d+)\s*(?:δωμάτια|δωματίων)/);
  if (roomsMatch) {
    criteria.rooms = parseInt(roomsMatch[1]);
  }

  if (lowerText.includes('διαμέρισμα')) {
    criteria.type = 'apartment';
  } else if (lowerText.includes('μεζονέτα')) {
    criteria.type = 'maisonette';
  } else if (lowerText.includes('κατάστημα')) {
    criteria.type = 'store';
  }

  return criteria;
}

export function applyAdvancedFilters(properties: any[], criteria: SearchCriteria): any[] {
  return properties.filter(property => {
    if (criteria.maxPrice && property.price > criteria.maxPrice) {
      return false;
    }
    if (criteria.rooms && property.rooms !== criteria.rooms) {
      return false;
    }
    return true;
  });
}
