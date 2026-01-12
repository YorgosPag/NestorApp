// /home/user/studio/src/app/api/communications/webhooks/telegram/search/format.ts

import type { SearchResult, TelegramProperty } from "../shared/types";

export function getPropertyTypeInGreek(type?: string): string {
  switch (type) {
    case 'apartment': return 'Διαμέρισμα';
    case 'maisonette': return 'Μεζονέτα';
    case 'store': return 'Κατάστημα';
    default: return type || 'Ακίνητο';
  }
}

export function formatSearchResultsForTelegram(searchResult: SearchResult): string {
  if (!searchResult.success || searchResult.totalCount === 0) {
    return `🔍 Δεν βρέθηκαν ακίνητα για την αναζήτησή σας.

💡 <b>Δοκιμάστε:</b>
- "Διαμέρισμα 2 δωματίων"
- "Μεζονέτα στο κέντρο"
- "Κατάστημα για ενοικίαση"

📞 Ή επικοινωνήστε μαζί μας για προσωπική εξυπηρέτηση!`;
  }

  let text = `🔍 <b>Βρήκα ${searchResult.totalCount} ακίνητα που ταιριάζουν:</b>\n\n`;

  const displayProperties = searchResult.properties.slice(0, 3);
  displayProperties.forEach((property: TelegramProperty, index: number) => {
    text += `${index + 1}. 🏠 <b>${property.code || `ID: ${property.id.slice(-6)}`}</b>\n`;
    
    if (property.type) text += `🏠 Τύπος: ${getPropertyTypeInGreek(property.type)}\n`;
    if (property.area) text += `📐 Εμβαδόν: ${property.area} τ.μ.\n`;
    if (property.rooms) text += `🚪 Δωμάτια: ${property.rooms}\n`;
    if (property.price) text += `💰 Τιμή: €${property.price.toLocaleString('el-GR')}\n`;
    if (property.building) text += `🏢 Κτίριο: ${property.building}\n`;
    
    text += '\n';
  });

  if (searchResult.totalCount > 3) {
    text += `📋 <i>Και ${searchResult.totalCount - 3} ακόμα ακίνητα...</i>\n\n`;
  }

  text += `💬 <b>Στείλτε μας μήνυμα για περισσότερες λεπτομέρειες!</b>`;
  return text;
}
