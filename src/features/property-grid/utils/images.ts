export const imageMap: Record<string, string> = {
  'Στούντιο': 'https://placehold.co/600x400.png',
  'Γκαρσονιέρα': 'https://placehold.co/600x400.png',
  'Διαμέρισμα': 'https://placehold.co/600x400.png',
  'Μεζονέτα': 'https://placehold.co/600x400.png',
  'Αποθήκη': 'https://placehold.co/600x400.png',
  'Parking': 'https://placehold.co/600x400.png',
};

export function getPropertyImage(property: any) {
  return imageMap[property?.type] || 'https://placehold.co/600x400.png';
}
